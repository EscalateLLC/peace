import { join } from 'node:path';
import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  type Message
} from 'discord.js';
import { generateDependencyReport } from '@discordjs/voice';
import { discordTextEvent } from '@peace/adapters';
import { createDb, findRepoRoot, insertSegments, migrate, resolveDbPath, updateMeetingStatus } from '@peace/db';
import { createLogger, errorFields } from '@peace/logger';
import { createDeepgramStt } from '@peace/transcription';
import { HELP_TEXT, generateReply, parseIntent, type CommandIntent } from './commands';
import { chunkMessage } from './chunk';
import { endMeeting, getActiveMeeting, startMeeting } from './state';
import { startVoiceCapture, stopVoiceCapture } from './voice';

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

async function handleStart (message: Message<true>): Promise<void> {
  if (getActiveMeeting(message.guildId, message.channelId)) {
    await message.reply('Already capturing this channel. `@peace stop` to end.');
    log.info('command.start.already_active', { channelId: message.channelId });

    return;
  }

  const { meeting } = startMeeting(db, {
    guildId      : message.guildId,
    textChannelId: message.channelId,
    title        : `#${message.channel.isTextBased() && 'name' in message.channel ? message.channel.name : 'discord'} — ${new Date().toLocaleDateString()}`
  });

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
    await startVoiceCapture(voiceChannel, {
      db,
      stt         : createDeepgramStt(),
      state,
      log         : log.child({ meetingId: state.meetingId }),
      resolveLabel: userId => message.guild.members.cache.get(userId)?.displayName ?? `user-${userId.slice(-4)}`,
      onError     : error => log.error('voice.capture_error', {
        meetingId: state.meetingId,
        ...errorFields(error)
      })
    });
  } catch (error) {
    log.error('command.join.connect_failed', {
      meetingId     : state.meetingId,
      voiceChannelId: voiceChannel.id,
      ...errorFields(error)
    });
    await message.reply(`I could not establish the voice connection: ${error instanceof Error ? error.message : 'unknown error'}`);

    return;
  }

  log.info('command.join.capture_started', {
    meetingId     : state.meetingId,
    voiceChannelId: voiceChannel.id
  });
  await message.reply(`🎙️ **peace joined ${voiceChannel.name}.** I am an AI participant — I transcribe this call and turn it into notes, decisions, and diagrams. \`@peace stop\` to end.`);
}

async function handleStop (message: Message<true>): Promise<void> {
  const state = endMeeting(db, message.guildId, message.channelId);

  if (!state) {
    await message.reply('Nothing is being captured here.');
    log.info('command.stop.nothing_active', { channelId: message.channelId });

    return;
  }

  stopVoiceCapture(message.guildId);
  log.info('command.stop.capture_ended', { meetingId: state.meetingId });
  await message.reply('⏹️ Capture ended. Generating final artifacts…');

  try {
    const startedAt = Date.now();
    const reply = await generateReply(db, state.meetingId, 'summarize');

    updateMeetingStatus(db, state.meetingId, 'complete', Date.now());
    log.info('command.stop.artifacts_generated', {
      meetingId: state.meetingId,
      ms       : Date.now() - startedAt
    });

    for (const chunk of chunkMessage(`${reply}\n\nOpen the workspace for decisions, action items, evidence links, and the diagram.`)) {
      await message.channel.send(chunk);
    }
  } catch (error) {
    updateMeetingStatus(db, state.meetingId, 'failed', Date.now());
    log.error('command.stop.generation_failed', {
      meetingId: state.meetingId,
      ...errorFields(error)
    });
    await message.reply(`Final generation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

async function handleArtifactIntent (message: Message<true>, intent: CommandIntent): Promise<void> {
  const state = getActiveMeeting(message.guildId, message.channelId);

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

  insertSegments(db, [discordTextEvent({
    meetingId  : state.meetingId,
    authorId   : message.author.id,
    authorLabel: message.member?.displayName ?? message.author.username,
    content    : message.content,
    offsetMs   : Date.now() - state.startedAt
  })]);
  log.debug('ingest.segment', {
    meetingId: state.meetingId,
    speakerId: `discord:${message.author.id}`,
    chars    : message.content.length
  });
}

client.login(token).catch((error: unknown) => {
  log.error('gateway.login_failed', errorFields(error));
  process.exit(1);
});
