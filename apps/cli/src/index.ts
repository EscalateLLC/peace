import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createTranscriptReplayAdapter, parseTranscript } from '@peace/adapters';
import { getDefaultModel } from '@peace/ai';
import { parseArtifactContent, type Artifact, type ConversationEvent } from '@peace/core';
import {
  createDb,
  createMeeting,
  findRepoRoot,
  getArtifactVersions,
  getLatestArtifacts,
  getMeeting,
  insertSegments,
  listMeetings,
  migrate,
  updateMeetingStatus
} from '@peace/db';
import { createLogger, errorFields } from '@peace/logger';
import { createAiGenerator, runPipeline } from '@peace/pipeline';
import { createLiveSession } from '@peace/session';
import { createDeltaServer, type DeltaServer } from '@peace/transport';

loadEnv();

const log = createLogger('cli');

const [command, ...args] = process.argv.slice(2);

try {
  await dispatch();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

async function dispatch (): Promise<void> {
  switch (command) {
    case 'replay':
      replay(requireArg('replay <file>'));
      break;

    case 'replay-live':
      await replayLive(requireArg('replay-live <file> [--ws] [--pace <ms>]'), args.slice(1));
      break;

    case 'run':
      await run(requireArg('run <file> [title]'), args[1]);
      break;

    case 'show':
      show(requireArg('show <meetingId>'));
      break;

    case 'seed-demo': {
      const { seedDemo } = await import('./seed-demo');
      const meetingId = seedDemo();

      console.log(`demo meeting seeded: ${meetingId}`);
      console.log(`show it: pnpm --filter @peace/cli start show ${meetingId}`);
      break;
    }

    case 'meetings':
      for (const meeting of listMeetings(createDb())) {
        console.log(`${meeting.id}  [${meeting.status.padEnd(10)}] ${meeting.title}`);
      }

      break;

    default:
      console.log('peace cli');
      console.log('  replay <file>          parse a transcript file and print normalized ConversationEvents');
      console.log('  replay-live <file> [--ws] [--pace <ms>]');
      console.log('                         drive a transcript through the live session orchestrator;');
      console.log('                         --ws streams deltas to the workspace, --pace spaces events out');
      console.log('  run <file> [title]     ingest a transcript, run the pipeline, persist artifacts');
      console.log('  show <meetingId>       print latest artifacts (with evidence) for a meeting');
      console.log('  meetings               list meetings');
      console.log('  seed-demo              seed a fully-populated demo meeting (no LLM calls)');
      process.exit(command ? 1 : 0);
  }
}

function replay (file: string): void {
  const events = parseTranscript(readFileSync(file, 'utf8'), 'replay');

  printEvents(events);
}

/**
 * The seam proof: a transcript file wrapped as a fake live platform, driven
 * through the same session orchestrator (and database commit path) a real
 * call uses. Output is line-identical to `replay` by construction.
 *
 * --ws hosts the realtime fan-out while replaying and --pace <ms> spaces the
 * events out — together they live-stream a fixture into the workspace, which
 * is both the demo and the transport test harness (realtime/04).
 */
async function replayLive (file: string, flags: string[] = []): Promise<void> {
  const useWs = flags.includes('--ws');
  const paceFlag = flags.indexOf('--pace');
  const paceMs = paceFlag >= 0 ? Number(flags[paceFlag + 1]) : 0;

  const db = createDb();

  migrate(db);

  const meeting = createMeeting(db, {
    title    : `replay-live ${basename(file)}`,
    platform : 'upload',
    startedAt: Date.now()
  });

  let ws: DeltaServer | null = null;

  if (useWs) {
    ws = await createDeltaServer({ log });
    console.log(`live fan-out: ws://localhost:${ws.port} — workspace: http://localhost:3000/meeting/${meeting.id}`);
  }

  log.info('session.replay_started', {
    meetingId: meeting.id,
    file,
    ws       : useWs,
    paceMs
  });

  const session = createLiveSession({
    adapter: createTranscriptReplayAdapter({
      content  : readFileSync(file, 'utf8'),
      meetingId: meeting.id,
      paceMs
    }),
    batchStt : null,
    stt      : null,
    db,
    meetingId: meeting.id,
    startedAt: Date.now(),
    log,
    onDelta  : delta => ws?.publish(delta)
  });

  const events: ConversationEvent[] = [];
  const consuming = (async () => {
    for await (const event of session.events()) {
      events.push(event);
    }
  })();

  await session.start();
  await session.stop();
  await consuming;
  updateMeetingStatus(db, meeting.id, 'complete', Date.now());
  ws?.publish({
    type   : 'meeting.status',
    payload: {
      meetingId: meeting.id,
      status   : 'complete'
    }
  });

  printEvents(events);
  log.info('session.replay_completed', {
    meetingId: meeting.id,
    events   : events.length
  });
  console.log(`\npersisted as meeting ${meeting.id} — run artifacts: pnpm --filter @peace/cli start show ${meeting.id}`);

  if (ws) {
    // Let the last frames flush before tearing the socket down.
    await new Promise(resolve => setTimeout(resolve, 500));
    await ws.close();
  }
}

function printEvents (events: ConversationEvent[]): void {
  for (const event of events) {
    console.log(`${formatMs(event.tStart).padStart(8)}  ${event.speakerLabel.padEnd(12)} ${event.text}`);
  }

  console.log(`\n${events.length} events from ${new Set(events.map(event => event.speakerId)).size} speakers`);
}

async function run (file: string, title?: string): Promise<void> {
  const db = createDb();

  migrate(db);

  const meeting = createMeeting(db, {
    title    : title ?? basename(file),
    platform : 'upload',
    startedAt: Date.now()
  });

  updateMeetingStatus(db, meeting.id, 'processing');
  insertSegments(db, parseTranscript(readFileSync(file, 'utf8'), meeting.id));
  console.log(`meeting ${meeting.id} created, running pipeline…`);
  log.info('pipeline.run_started', {
    meetingId: meeting.id,
    file
  });

  const startedAt = Date.now();

  try {
    const result = await runPipeline(db, meeting.id, createAiGenerator(getDefaultModel()));

    updateMeetingStatus(db, meeting.id, 'complete', Date.now());
    log.info('pipeline.run_completed', {
      meetingId   : meeting.id,
      ms          : Date.now() - startedAt,
      windows     : result.extraction.stats.windows,
      droppedItems: result.extraction.stats.droppedItems
    });
    console.log(`windows: ${result.extraction.stats.windows}, dropped (no evidence): ${result.extraction.stats.droppedItems}`);

    for (const artifact of result.artifacts) {
      console.log(`  ${artifact.type.padEnd(15)} v${artifact.version}  ${artifact.title}`);
    }

    console.log(`\nshow it: pnpm --filter @peace/cli start show ${meeting.id}`);
  } catch (error) {
    updateMeetingStatus(db, meeting.id, 'failed', Date.now());
    log.error('pipeline.run_failed', {
      meetingId: meeting.id,
      ms       : Date.now() - startedAt,
      ...errorFields(error)
    });
    throw error;
  }
}

function show (meetingId: string): void {
  const db = createDb();
  const meeting = getMeeting(db, meetingId);

  if (!meeting) {
    throw new Error(`no meeting ${meetingId}`);
  }

  console.log(`# ${meeting.title} [${meeting.status}]\n`);

  for (const artifact of getLatestArtifacts(db, meetingId)) {
    const versions = getArtifactVersions(db, meetingId, artifact.type).length;

    console.log(`## ${artifact.title} (${artifact.type} v${artifact.version}${versions > 1 ? ` of ${versions}` : ''})`);
    printArtifact(artifact);
    console.log('');
  }
}

function printArtifact (artifact: Artifact): void {
  const parsed = parseArtifactContent(artifact.type, artifact.content);

  switch (parsed.type) {
    case 'summary':
      console.log(parsed.content.markdown);
      break;

    case 'diagram':
      console.log(parsed.content.mermaid);
      console.log(`evidence: ${Object.entries(parsed.content.nodeEvidence).map(([node, ids]) => `${node}→[${ids.join(', ')}]`)
        .join(' ')}`);
      break;

    case 'action-items':
      for (const item of parsed.content.items) {
        console.log(`- [ ] ${item.description}${item.assignee ? ` — ${item.assignee}` : ''}${item.dueDate ? ` (due ${item.dueDate})` : ''}${item.uncertain ? ' ⚠ uncertain' : ''}`);
        console.log(`      evidence: ${item.sourceSegmentIds.join(', ')}`);
      }

      break;

    case 'decisions':
      for (const item of parsed.content.items) {
        console.log(`- ${item.description}${item.rationale ? ` — ${item.rationale}` : ''}${item.uncertain ? ' ⚠ uncertain' : ''}`);
        console.log(`      evidence: ${item.sourceSegmentIds.join(', ')}`);
      }

      break;

    case 'open-questions':
      for (const item of parsed.content.items) {
        console.log(`- ${item.question}${item.uncertain ? ' ⚠ uncertain' : ''}  [${item.sourceSegmentIds.join(', ')}]`);
      }

      break;

    case 'key-points':
      for (const item of parsed.content.items) {
        console.log(`- ${item.point}${item.uncertain ? ' ⚠ uncertain' : ''}  [${item.sourceSegmentIds.join(', ')}]`);
      }

      break;

    default:
      console.log(JSON.stringify(parsed, null, 2));
  }
}

function requireArg (usage: string): string {
  const value = args[0];

  if (!value) {
    console.error(`usage: ${usage}`);
    process.exit(1);
  }

  return value;
}

function formatMs (ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);

  return `[${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}]`;
}

function loadEnv (): void {
  try {
    process.loadEnvFile(join(findRepoRoot(), '.env'));
  } catch {
    // .env is optional
  }
}
