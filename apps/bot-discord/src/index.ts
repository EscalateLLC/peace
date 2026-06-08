import { join } from 'node:path';
import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  type Guild,
  type Message,
  type VoiceBasedChannel
} from 'discord.js';
import { randomUUID } from 'node:crypto';
import { generateDependencyReport } from '@discordjs/voice';
import { createDb, findRepoRoot, getLatestArtifacts, getSegments, insertSegments, listMeetings, migrate, resolveDbPath, setMeetingVoiceChannel, updateMeetingStatus } from '@peace/db';
import { createLogger, errorFields } from '@peace/logger';
import { createLivenessController, createLiveSession } from '@peace/session';
import { createParticipationRouter, type RouterExecutor, type SpeechHandle } from '@peace/router';
import { draftResponse } from '@peace/agent';
import { getDefaultModel } from '@peace/ai';
import { createDeepgramStt, createTextToSpeech, type TtsProvider } from '@peace/transcription';
import { createDeltaServer, type DeltaInput, type DeltaServer } from '@peace/transport';
import { conversationEventSchema, speakerId, type ConversationMedium, type MeetingStatus } from '@peace/core';
import { HELP_TEXT, generateReply, matchLeaveCommand, parseIntent, type CommandIntent } from './commands';
import { chunkMessage } from './chunk';
import { createDiscordAdapter } from './discord-adapter';
import { OFFLINE_CLIP_FORMAT, loadOfflineClip } from './offline-clip';
import { toSpokenText } from './spoken-text';
import { createSpeakExecutor, type VoiceStatus } from './speak-executor';
import {
  discardMeeting,
  endMeeting,
  getActiveMeeting,
  listActiveMeetings,
  restoreMeeting,
  startMeeting,
  type ActiveMeeting
} from './state';

try {
  process.loadEnvFile(join(findRepoRoot(), '.env'));
} catch {
  // .env is optional (env may come from the shell)
}

const log = createLogger('bot-discord');
const token = process.env.DISCORD_BOT_TOKEN;

log.info('startup.config', {
  hasDiscordToken: Boolean(token),
  hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
  hasDeepgramKey : Boolean(process.env.DEEPGRAM_API_KEY),
  dbFile         : resolveDbPath(),
  logFile        : log.file,
  nodeVersion    : process.version
});

// Opus / encryption / ffmpeg availability — the usual silent killers of the
// voice handshake. One glance at this line settles "is the environment sane".
log.info('voice.dependency_report', { report: generateDependencyReport() });

if (!token) {
  log.error('startup.missing_token', { hint: 'set DISCORD_BOT_TOKEN — see .env.example' });
  process.exit(1);
}

const db = createDb();

migrate(db);

// Realtime fan-out (realtime/04). Never on the correctness path: if the port
// is taken or the server fails, the workspace falls back to polling.
const ws: DeltaServer | null = await createDeltaServer({ log }).catch((error: unknown) => {
  log.warn('ws.server_failed', errorFields(error));

  return null;
});

function publishDelta (input: DeltaInput): void {
  ws?.publish(input);
}

function publishStatus (meetingId: string, status: MeetingStatus): void {
  publishDelta({
    type   : 'meeting.status',
    payload: {
      meetingId,
      status
    }
  });
}

function publishLatestArtifacts (meetingId: string): void {
  for (const artifact of getLatestArtifacts(db, meetingId)) {
    publishDelta({
      type   : 'artifact.committed',
      payload: artifact
    });
  }
}

// The local "my backend is down" clip, read once at startup. Null → the
// liveness controller announces degradation in chat only.
const offlineClip = loadOfflineClip();

log.info('startup.offline_clip', { available: offlineClip !== null });

const REJOIN_MAX_ATTEMPTS = 3;

function wait (ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Send a (chunked) message to a channel by id; best-effort, never throws. */
async function sendToChannel (channelId: string, text: string): Promise<void> {
  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (channel?.isSendable()) {
    for (const chunk of chunkMessage(text)) {
      await channel.send(chunk).catch(() => undefined);
    }
  }
}

/** A voice channel still has at least one non-bot participant. */
function voiceChannelHasHumans (channel: VoiceBasedChannel): boolean {
  return [...channel.members.values()].some(member => !member.user.bot);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.once(Events.ClientReady, readyClient => {
  log.info('gateway.ready', {
    tag         : readyClient.user.tag,
    clientUserId: readyClient.user.id,
    guilds      : readyClient.guilds.cache.map(guild => `${guild.id}:${guild.name}`)
  });
  console.log(`peace is online as ${readyClient.user.tag} — logs: ${log.file}`);

  recoverOrphanedMeetings().catch((error: unknown) => {
    log.error('recovery.failed', errorFields(error));
  });
});

/**
 * Defensive lifecycle, part 1: meetings whose process died mid-capture. Their
 * DB rows are stuck 'live' while the in-memory map starts empty — without
 * this, the bot answers "@peace stop" with "Nothing is being captured here"
 * about a meeting it was visibly part of moments ago. Restore-as-active
 * policy: transcript-bearing meetings come back (text capture resumes,
 * `@peace join` reattaches voice); empty husks from failed joins are marked
 * failed and forgotten.
 */
async function recoverOrphanedMeetings (): Promise<void> {
  const orphans = listMeetings(db).filter(meeting => meeting.status === 'live' && meeting.platform === 'discord');

  for (const meeting of orphans) {
    const segments = getSegments(db, meeting.id).length;

    if (segments === 0) {
      updateMeetingStatus(db, meeting.id, 'failed', Date.now());
      publishStatus(meeting.id, 'failed');
      log.info('recovery.meeting_discarded', {
        meetingId: meeting.id,
        reason   : 'no segments'
      });
      continue;
    }

    const state = restoreMeeting(meeting);

    if (!state) {
      updateMeetingStatus(db, meeting.id, 'failed', Date.now());
      publishStatus(meeting.id, 'failed');
      log.warn('recovery.meeting_discarded', {
        meetingId  : meeting.id,
        reason     : 'unparseable externalRef',
        externalRef: meeting.externalRef
      });
      continue;
    }

    try {
      const channel = await client.channels.fetch(state.textChannelId);

      if (!channel?.isSendable() || !('guild' in channel)) {
        throw new Error('channel unavailable or not a guild text channel');
      }

      const guild = channel.guild as Guild;

      await attachSession(guild, state);
      log.info('recovery.meeting_restored', {
        meetingId: meeting.id,
        segments
      });

      // If it was a voice meeting and people are still in the channel,
      // auto-rejoin the call; otherwise resume text-only with a prompt.
      const rejoined = state.voiceChannelId ? await tryRecoveryRejoin(state, guild) : false;

      await channel.send(rejoined ? '🔁 **I was interrupted, but I\'m back** — rejoined the call, and the transcript so far is safe. `@peace stop` to finalize.' : '🔁 **I was interrupted, but this meeting is recovered.** The transcript so far is safe. Keep talking here, `@peace join` to bring me back into voice, or `@peace stop` to finalize.');
    } catch (error) {
      // The transcript exists and is not a failure: close the meeting out so
      // the workspace shows it normally (artifacts can still be generated
      // from there); only the *continuation* is impossible without a channel.
      discardMeeting(db, state.guildId, state.textChannelId);
      updateMeetingStatus(db, meeting.id, 'complete', Date.now());
      publishStatus(meeting.id, 'complete');
      log.warn('recovery.meeting_closed_unreachable', {
        meetingId: meeting.id,
        segments,
        ...errorFields(error)
      });
    }
  }
}

/**
 * Restart auto-rejoin (realtime/06): the meeting was in voice when the process
 * died and people are still there → rejoin silently. Returns whether it
 * rejoined so the recovery message can be phrased accordingly.
 */
async function tryRecoveryRejoin (state: ActiveMeeting, guild: Guild): Promise<boolean> {
  if (!state.voiceChannelId || !state.adapter || !process.env.DEEPGRAM_API_KEY) {
    return false;
  }

  const channel = guild.channels.cache.get(state.voiceChannelId) ?? await guild.channels.fetch(state.voiceChannelId).catch(() => null);

  if (!channel || channel.type !== ChannelType.GuildVoice || !voiceChannelHasHumans(channel)) {
    return false;
  }

  try {
    await state.adapter.joinVoice(channel);
    setMeetingVoiceChannel(db, state.meetingId, channel.id);
    log.info('recovery.voice_rejoined', {
      meetingId     : state.meetingId,
      voiceChannelId: channel.id
    });

    return true;
  } catch (error) {
    log.warn('recovery.voice_rejoin_failed', {
      meetingId: state.meetingId,
      ...errorFields(error)
    });

    return false;
  }
}

/**
 * Defensive lifecycle, part 2: leave cleanly when the process is told to die.
 * Sessions stop (the bot exits voice instead of haunting the call), channels
 * get told why, and meetings stay 'live' on purpose — shutdown is a pause;
 * the recovery sweep above resumes them on the next boot.
 */
let shuttingDown = false;

async function shutdown (signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  const states = listActiveMeetings();

  log.info('shutdown.initiated', {
    signal,
    activeMeetings: states.length
  });

  for (const state of states) {
    try {
      const channel = await client.channels.fetch(state.textChannelId).catch(() => null);

      if (channel?.isSendable()) {
        await channel.send('⏸️ **Going offline for a moment** (service restarting). The transcript is safe — I\'ll recover this meeting when I\'m back.');
      }

      state.router?.stop();
      await state.session?.stop();
      log.info('shutdown.meeting_paused', { meetingId: state.meetingId });
    } catch (error) {
      log.error('shutdown.meeting_error', {
        meetingId: state.meetingId,
        ...errorFields(error)
      });
    }
  }

  await ws?.close().catch(() => undefined);
  await client.destroy().catch(() => undefined);
  log.info('shutdown.completed', { signal });
  process.exit(0);
}

process.on('SIGINT', () => {
  shutdown('SIGINT').catch(() => process.exit(1));
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch(() => process.exit(1));
});

client.on(Events.MessageCreate, message => {
  handleMessage(message).catch((error: unknown) => {
    log.error('handler.failed', {
      channelId: message.channelId,
      ...errorFields(error)
    });
    message.reply(`Something went wrong: ${error instanceof Error ? error.message : 'unknown error'}`).catch(() => undefined);
  });
});

/**
 * The bot is addressed either via a user mention (<@id>) or via its managed
 * role (<@&roleId>) — Discord's autocomplete often resolves "@peace" to the
 * role pill, which looks identical in the client.
 */
function resolveMention (message: Message<true>): 'user' | 'role' | null {
  if (client.user && message.mentions.users.has(client.user.id)) {
    return 'user';
  }

  const botRole = message.guild.members.me?.roles.botRole;

  if (botRole && message.mentions.roles.has(botRole.id)) {
    return 'role';
  }

  return null;
}

async function handleMessage (message: Message): Promise<void> {
  if (!message.inGuild()) {
    return;
  }

  // The single most useful line for debugging "the bot did nothing":
  // exactly what arrived, what it mentioned, and how it was routed.
  log.debug('message.received', {
    guildId         : message.guildId,
    channelId       : message.channelId,
    channelType     : message.channel.type,
    authorId        : message.author.id,
    authorTag       : message.author.tag,
    authorIsBot     : message.author.bot,
    contentPreview  : message.content.slice(0, 120),
    contentLength   : message.content.length,
    mentionedUserIds: [...message.mentions.users.keys()],
    mentionedRoleIds: [...message.mentions.roles.keys()],
    clientUserId    : client.user?.id ?? null
  });

  if (message.author.bot) {
    return;
  }

  const mentionedVia = resolveMention(message);

  if (!mentionedVia) {
    ingestText(message);

    return;
  }

  const text = message.content.replaceAll(/<@[!&]?\d+>/gu, '').trim();
  const intent = parseIntent(text);

  log.info('message.routed', {
    channelId: message.channelId,
    mentionedVia,
    text     : text.slice(0, 120),
    intent
  });

  if (intent === 'start') {
    await handleStart(message);
  } else if (intent === 'join') {
    await handleJoin(message);
  } else if (intent === 'stop') {
    await handleStop(message);
  } else if (intent && intent !== 'help') {
    await handleArtifactIntent(message, intent);
  } else {
    await message.reply(HELP_TEXT);
    log.info('command.help.replied', { channelId: message.channelId });
  }
}

/** Turn current voice health into a self-awareness note for the agent (undefined when all is well). */
function voiceOperationalNote (status: VoiceStatus): string | undefined {
  if (status === 'backup') {
    return 'You are currently speaking through your backup voice because your main voice service is unavailable. If asked why you sound different, you may say so briefly.';
  }

  if (status === 'down') {
    return 'Your voice output is currently failing, so your replies are being delivered as text in the chat.';
  }

  return undefined;
}

/** The provider createTextToSpeech prefers, so the boundary can spot a fallback switch. */
function pickPrimaryProvider (): TtsProvider | null {
  if (process.env.ELEVENLABS_API_KEY) {
    return 'elevenlabs';
  }

  if (process.env.DEEPGRAM_API_KEY) {
    return 'deepgram';
  }

  return null;
}

/**
 * Attach the platform seam to a meeting (fresh or recovered): the Discord
 * adapter feeds a platform-agnostic live session, which owns STT and
 * persistence. The gateway router below only ever talks to the adapter.
 */
async function attachSession (guild: Guild, state: ActiveMeeting): Promise<void> {
  const childLog = log.child({ meetingId: state.meetingId });
  const hasDeepgram = Boolean(process.env.DEEPGRAM_API_KEY);
  const model = process.env.ANTHROPIC_API_KEY ? getDefaultModel() : null;
  const tts = createTextToSpeech(); // ElevenLabs if configured, else Aura, else null

  // Mirrors createTextToSpeech's preference order — lets the boundary tell a
  // backup-voice synthesis apart from the primary so it can announce a switch.
  const primaryProvider = pickPrimaryProvider();

  // Identity bridge: the router speaks in candidate ids; the adapter in its own
  // speech handles. These maps translate between them (and back, when the
  // adapter reports finished/aborted).
  const egressHandleByCandidate = new Map<string, SpeechHandle>();
  const candidateByEgressHandle = new Map<string, string>();

  const adapter = createDiscordAdapter({
    log           : childLog,
    resolveLabel  : userId => guild.members.cache.get(userId)?.displayName ?? `user-${userId.slice(-4)}`,
    sendChat      : text => sendToChannel(state.textChannelId, text),
    onVoiceDropped: () => {
      autoRejoinVoice(state, guild).catch((error: unknown) => childLog.error('voice.auto_rejoin_error', errorFields(error)));
    },
    onSpeechFinished: handle => {
      const candidateId = candidateByEgressHandle.get(handle.id);

      candidateByEgressHandle.delete(handle.id);

      if (candidateId) {
        egressHandleByCandidate.delete(candidateId);
        state.router?.submit({
          type: 'speech.finished',
          candidateId,
          at  : Date.now()
        });
      }
    },
    onSpeechAborted: (handle, reason) => {
      const candidateId = candidateByEgressHandle.get(handle.id);

      candidateByEgressHandle.delete(handle.id);

      if (candidateId) {
        egressHandleByCandidate.delete(candidateId);
        state.router?.submit({
          type: 'speech.aborted',
          candidateId,
          reason,
          at  : Date.now()
        });
      }
    }
  });

  // The liveness contract: announce backend degradation in-band (local voice
  // clip in the call + chat), once per episode. Independent of TTS — the clip
  // is pre-rendered and local.
  const liveness = createLivenessController({
    egress              : adapter.egress,
    isInVoice           : adapter.inVoice,
    degradedClip        : offlineClip,
    clipFormat          : OFFLINE_CLIP_FORMAT,
    degradedChatMessage : '⚠️ I just lost my connection to my services — I can\'t take notes right now. Remove me if you like; I\'ll recover automatically when I\'m back.',
    recoveredChatMessage: '✅ Reconnected — I\'m capturing again.',
    log                 : childLog
  });

  // Surface an operational notice to the workspace banner (and, since it rides
  // the same channel, anywhere else subscribed). meetingId/at stamped here.
  const publishNotice = (notice: { severity: 'info' | 'warning' | 'error'; code: string; message: string }): void => {
    publishDelta({
      type   : 'meeting.notice',
      payload: {
        meetingId: state.meetingId,
        at       : Date.now(),
        ...notice
      }
    });
  };

  // Register-or-discard invariant: persist a peace turn ONLY when it was
  // actually delivered — on speech.finished (voice) or on the text-fallback
  // path (text). Persisted with the `peace` namespace so it grounds the agent
  // (and shows in the workspace) but is excluded from artifact extraction.
  const registerTurn = (candidate: { text?: string }, medium: ConversationMedium): void => {
    const tStart = Math.max(0, Date.now() - state.startedAt);
    const event = conversationEventSchema.parse({
      id          : randomUUID(),
      meetingId   : state.meetingId,
      speakerId   : speakerId('peace', state.meetingId),
      speakerLabel: 'peace',
      text        : candidate.text ?? '',
      tStart,
      tEnd        : tStart,
      confidence  : 1,
      source      : {
        platform: 'discord',
        medium
      }
    });

    insertSegments(db, [event]);
    publishDelta({
      type   : 'segment.committed',
      payload: event
    });
  };

  // Latest voice health, so the agent can be told (e.g. "you're on backup voice").
  let voiceStatus: VoiceStatus = 'primary';

  // The voice boundary: voice → backup voice → text + notice, never silence.
  const speakExecutor = createSpeakExecutor({
    tts,
    primaryProvider,
    egress  : adapter.egress,
    toSpokenText,
    onSpoken: (candidateId, handle) => {
      egressHandleByCandidate.set(candidateId, handle);
      candidateByEgressHandle.set(handle.id, candidateId);
    },
    registerText : candidate => registerTurn(candidate, 'text'),
    publishNotice,
    onVoiceStatus: status => {
      voiceStatus = status;
    },
    log: childLog
  });

  const executor: RouterExecutor = {
    speak      : speakExecutor.speak,
    abortSpeech: (handle, reason) => {
      const egressHandle = egressHandleByCandidate.get(handle.id);

      if (egressHandle) {
        adapter.egress.abortSpeech(egressHandle, reason);
      }
    },
    registerTurn: candidate => registerTurn(candidate, 'voice'),
    isInVoice   : adapter.inVoice
  };

  // No `&& tts` guard: with no voice configured the router still runs — the
  // speak boundary degrades each reply to text instead of going silent.
  const router = model ? createParticipationRouter({
    meetingId: state.meetingId,
    executor,
    log      : childLog,
    draft    : async request => {
      const decision = await draftResponse({
        db,
        meetingId      : state.meetingId,
        model,
        addressedBy    : request.addressedBy,
        query          : request.query,
        mode           : request.mode,
        operationalNote: voiceOperationalNote(voiceStatus),
        log            : childLog
      });

      // The agent decided to leave (e.g. "you can head out now") — honor it
      // outside the router, exactly like the deterministic voice command does.
      if (decision.kind === 'leave') {
        requestVoiceLeave(state, decision.goodbye || undefined).catch((error: unknown) => childLog.error('command.voice_leave.error', errorFields(error)));

        return {
          kind  : 'silent',
          reason: 'leaving'
        };
      }

      if (decision.kind === 'speak') {
        if (decision.postToChat) {
          adapter.egress.sendText(decision.text).catch(() => undefined);
        }

        return {
          kind: 'speak',
          text: decision.text
        };
      }

      return {
        kind  : 'silent',
        reason: decision.reason
      };
    }
  }) : null;

  const session = createLiveSession({
    adapter,
    batchStt          : hasDeepgram ? createDeepgramStt() : null,
    stt               : null,
    db,
    meetingId         : state.meetingId,
    startedAt         : state.startedAt,
    log               : childLog,
    onDelta           : publishDelta,
    onBackendDegraded : liveness.onDegraded,
    onBackendRecovered: liveness.onRecovered,
    onSpeaking        : (speaker, voiceState) => router?.submit({
      type: voiceState === 'start' ? 'speaker.start' : 'speaker.stop',
      speaker,
      at  : Date.now()
    })
  });

  // Wired onto the state before start(): the adapter only emits once
  // connect() registers handlers, so nothing can slip through early.
  state.adapter = adapter;
  state.session = session;
  state.router = router;
  await session.start();
  router?.start();

  // Feed committed human utterances into the router; intercept the spoken
  // "peace, stop" control intent (a command, not conversational participation).
  if (router) {
    const activeRouter = router;

    const feed = async () => {
      for await (const event of session.events()) {
        // Deterministic fast-path: an explicit spoken "leave" command directed
        // at the bot exits immediately, without an LLM round-trip. Fuzzier
        // requests still reach the agent, which has its own leave_call tool.
        if (event.source.medium === 'voice' && matchLeaveCommand(event.text)) {
          childLog.info('command.voice_leave.spoken', { meetingId: state.meetingId });
          requestVoiceLeave(state).catch((error: unknown) => childLog.error('command.voice_leave.error', errorFields(error)));
          continue;
        }

        activeRouter.submit({
          type: 'utterance.committed',
          event,
          at  : Date.now()
        });
      }
    };

    feed().catch((error: unknown) => childLog.error('router.feed_error', errorFields(error)));
  }
}

/**
 * Auto-rejoin after a permanent voice drop (process alive). Rejoin only if
 * humans remain in the channel — otherwise the bot would haunt an empty call.
 * Bounded retries with backoff; on give-up, fall back to a chat prompt.
 */
async function autoRejoinVoice (state: ActiveMeeting, guild: Guild): Promise<void> {
  if (!state.voiceChannelId || !state.adapter) {
    return;
  }

  const channel = guild.channels.cache.get(state.voiceChannelId) ?? await guild.channels.fetch(state.voiceChannelId).catch(() => null);

  if (!channel || channel.type !== ChannelType.GuildVoice) {
    return;
  }

  if (!voiceChannelHasHumans(channel)) {
    log.info('voice.auto_rejoin_skipped', {
      meetingId: state.meetingId,
      reason   : 'channel empty'
    });
    await sendToChannel(state.textChannelId, '🔌 I dropped from voice and everyone has left — say `@peace join` to bring me back.');

    return;
  }

  for (let attempt = 1; attempt <= REJOIN_MAX_ATTEMPTS; attempt++) {
    try {
      log.info('voice.auto_rejoin_attempt', {
        meetingId: state.meetingId,
        attempt
      });
      await state.adapter.joinVoice(channel);
      log.info('voice.auto_rejoin_succeeded', {
        meetingId: state.meetingId,
        attempt
      });
      await sendToChannel(state.textChannelId, '🔁 Reconnected to voice.');

      return;
    } catch (error) {
      log.warn('voice.auto_rejoin_failed', {
        meetingId: state.meetingId,
        attempt,
        ...errorFields(error)
      });
      await wait(attempt * 1500);
    }
  }

  log.warn('voice.auto_rejoin_gave_up', { meetingId: state.meetingId });
  await sendToChannel(state.textChannelId, '🔌 I lost the voice connection and couldn\'t rejoin — say `@peace join` to bring me back.');
}

async function handleStart (message: Message<true>): Promise<void> {
  if (getActiveMeeting(message.guildId, message.channelId)) {
    await message.reply('Already capturing this channel. `@peace stop` to end.');
    log.info('command.start.already_active', { channelId: message.channelId });

    return;
  }

  const { meeting, state } = startMeeting(db, {
    guildId      : message.guildId,
    textChannelId: message.channelId,
    title        : `#${message.channel.isTextBased() && 'name' in message.channel ? message.channel.name : 'discord'} — ${new Date().toLocaleDateString()}`
  });

  await attachSession(message.guild, state);
  log.info('command.start.meeting_created', {
    channelId: message.channelId,
    meetingId: meeting.id
  });
  await message.reply('🟢 **peace is capturing this channel.** I am an AI note-taker; messages here become part of the meeting transcript. `@peace stop` to end, `@peace help` for commands.');
}

async function handleJoin (message: Message<true>): Promise<void> {
  const voiceChannel = message.member?.voice.channel;

  log.info('command.join.requested', {
    channelId       : message.channelId,
    memberId        : message.member?.id ?? null,
    voiceChannelId  : voiceChannel?.id ?? null,
    voiceChannelType: voiceChannel?.type ?? null
  });

  if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
    await message.reply('Join a voice channel first, then `@peace join`.');
    log.info('command.join.no_voice_channel', { channelId: message.channelId });

    return;
  }

  if (!process.env.DEEPGRAM_API_KEY) {
    await message.reply('DEEPGRAM_API_KEY is not configured — voice transcription is disabled.');
    log.warn('command.join.missing_deepgram_key', { channelId: message.channelId });

    return;
  }

  const existing = getActiveMeeting(message.guildId, message.channelId);
  const { state } = existing ? { state: existing } : startMeeting(db, {
    guildId       : message.guildId,
    textChannelId : message.channelId,
    title         : `${voiceChannel.name} — ${new Date().toLocaleDateString()}`,
    voiceChannelId: voiceChannel.id
  });

  state.voiceChannelId = voiceChannel.id;

  try {
    if (!state.adapter) {
      await attachSession(message.guild, state);
    }

    await state.adapter?.joinVoice(voiceChannel);
  } catch (error) {
    log.error('command.join.connect_failed', {
      meetingId     : state.meetingId,
      voiceChannelId: voiceChannel.id,
      ...errorFields(error)
    });

    // A meeting born from this failed join is an empty husk: roll it back
    // instead of leaving a zombie 'live' row (it would otherwise haunt the
    // workspace and the recovery sweep). Pre-existing text meetings survive.
    if (!existing) {
      await state.session?.stop().catch(() => undefined);
      discardMeeting(db, message.guildId, message.channelId);
      publishStatus(state.meetingId, 'failed');
      log.info('command.join.meeting_rolled_back', { meetingId: state.meetingId });
    }

    await message.reply(`I could not establish the voice connection: ${error instanceof Error ? error.message : 'unknown error'}`);

    return;
  }

  // Persist the voice channel so a process restart can auto-rejoin this call.
  setMeetingVoiceChannel(db, state.meetingId, voiceChannel.id);
  log.info('command.join.capture_started', {
    meetingId     : state.meetingId,
    voiceChannelId: voiceChannel.id
  });
  await message.reply(`🎙️ **peace joined ${voiceChannel.name}.** I am an AI participant — I transcribe this call and turn it into notes, decisions, and diagrams. I may speak when addressed — say "peace, …" or mention me. \`@peace stop\` to end.`);
}

/**
 * Defensive lifecycle, part 3: commands never trust the in-memory map alone.
 * If this process forgot a meeting (restart race, recovery miss) but the DB
 * says it's live in this channel, restore it on the spot instead of telling
 * the user "Nothing is being captured here" about their own meeting.
 */
async function resolveActiveMeeting (message: Message<true>): Promise<ActiveMeeting | undefined> {
  const inMemory = getActiveMeeting(message.guildId, message.channelId);

  if (inMemory) {
    return inMemory;
  }

  const ref = `${message.guildId}/${message.channelId}`;
  const orphan = listMeetings(db).find(meeting => meeting.status === 'live' && meeting.platform === 'discord' && meeting.externalRef === ref);

  if (!orphan) {
    return undefined;
  }

  const state = restoreMeeting(orphan);

  if (!state) {
    return undefined;
  }

  await attachSession(message.guild, state);
  log.info('recovery.meeting_restored', {
    meetingId: state.meetingId,
    trigger  : 'command'
  });

  return state;
}

async function handleStop (message: Message<true>): Promise<void> {
  const resolved = await resolveActiveMeeting(message);
  const state = resolved ? endMeeting(db, message.guildId, message.channelId) : undefined;

  if (!state) {
    await message.reply('Nothing is being captured here.');
    log.info('command.stop.nothing_active', { channelId: message.channelId });

    return;
  }

  state.router?.stop();
  await state.session?.stop();
  publishStatus(state.meetingId, 'processing');
  log.info('command.stop.capture_ended', { meetingId: state.meetingId });
  await message.reply('⏹️ Capture ended. Generating final artifacts…');
  await finalizeMeeting(state);
}

/**
 * Generate final artifacts and post them, flipping the meeting to complete (or
 * failed). Shared by `@peace stop` (text) and "peace, stop" (voice).
 */
async function finalizeMeeting (state: ActiveMeeting): Promise<void> {
  try {
    const startedAt = Date.now();
    const reply = await generateReply(db, state.meetingId, 'summarize');

    updateMeetingStatus(db, state.meetingId, 'complete', Date.now());
    publishLatestArtifacts(state.meetingId);
    publishStatus(state.meetingId, 'complete');
    log.info('command.stop.artifacts_generated', {
      meetingId: state.meetingId,
      ms       : Date.now() - startedAt
    });
    await sendToChannel(state.textChannelId, `${reply}\n\nOpen the workspace for decisions, action items, evidence links, and the diagram.`);
  } catch (error) {
    updateMeetingStatus(db, state.meetingId, 'failed', Date.now());
    publishStatus(state.meetingId, 'failed');
    log.error('command.stop.generation_failed', {
      meetingId: state.meetingId,
      ...errorFields(error)
    });
    await sendToChannel(state.textChannelId, `Final generation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

/** Meetings currently tearing down via a spoken leave (guards double-trigger). */
const leaving = new Set<string>();

/**
 * "peace, stop/leave" spoken in the call: acknowledge in voice, leave, then
 * finalize. The headline control-flow fix — peace must obey when told to go,
 * not silently route the command to the artifact pipeline.
 */
async function requestVoiceLeave (state: ActiveMeeting, goodbye?: string): Promise<void> {
  if (leaving.has(state.meetingId)) {
    return;
  }

  leaving.add(state.meetingId);

  try {
    const removed = endMeeting(db, state.guildId, state.textChannelId);

    if (!removed) {
      return;
    }

    state.router?.stop();
    await speakGoodbye(state, goodbye); // plays before we disconnect
    await state.session?.stop(); // leaves voice
    publishStatus(state.meetingId, 'processing');
    log.info('command.voice_leave.requested', { meetingId: state.meetingId });
    await sendToChannel(state.textChannelId, '⏹️ Left the call (you asked me to in voice). Generating final artifacts…');
    await finalizeMeeting(state);
  } finally {
    leaving.delete(state.meetingId);
  }
}

/** Best-effort spoken sign-off before disconnecting; never blocks the leave. */
async function speakGoodbye (state: ActiveMeeting, line?: string): Promise<void> {
  const tts = createTextToSpeech();

  if (!tts || !state.adapter?.inVoice()) {
    return;
  }

  try {
    const { audio, format } = await tts.synthesize(line?.trim() || 'Okay, I\'ll head out now — I\'ll drop the notes here in chat.');

    await state.adapter.egress.speak(audio, {
      sampleRate: format.sampleRate,
      channels  : format.channels,
      encoding  : 'pcm-s16le'
    });
    await wait(4500); // let the sign-off finish before the connection is destroyed
  } catch (error) {
    log.warn('voice.goodbye_failed', {
      meetingId: state.meetingId,
      ...errorFields(error)
    });
  }
}

async function handleArtifactIntent (message: Message<true>, intent: CommandIntent): Promise<void> {
  const state = await resolveActiveMeeting(message);

  if (!state) {
    await message.reply('No active meeting here — `@peace start` or `@peace join` first.');
    log.info('command.artifact.no_active_meeting', {
      channelId: message.channelId,
      intent
    });

    return;
  }

  await message.channel.sendTyping();

  const startedAt = Date.now();
  const reply = await generateReply(db, state.meetingId, intent);

  publishLatestArtifacts(state.meetingId);
  log.info('command.artifact.generated', {
    meetingId: state.meetingId,
    intent,
    ms       : Date.now() - startedAt,
    chars    : reply.length
  });

  for (const chunk of chunkMessage(reply)) {
    await message.channel.send(chunk);
  }
}

function ingestText (message: Message<true>): void {
  if (message.author.bot || message.content.trim().length === 0) {
    return;
  }

  const state = getActiveMeeting(message.guildId, message.channelId);

  if (!state) {
    return;
  }

  // Through the platform seam: adapter normalizes, session commits + logs
  // (session.committed with medium 'text').
  state.adapter?.ingestMessage({
    meetingId  : state.meetingId,
    authorId   : message.author.id,
    authorLabel: message.member?.displayName ?? message.author.username,
    content    : message.content,
    offsetMs   : Date.now() - state.startedAt
  });
}

client.login(token).catch((error: unknown) => {
  log.error('gateway.login_failed', errorFields(error));
  process.exit(1);
});
