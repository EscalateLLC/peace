import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findRepoRoot } from '@peace/logger';
import { createDeepgramTts } from '@peace/transcription';
import { upmixMonoToStereo } from '../src/discord-adapter';

/**
 * Renders the offline-degraded clip ONCE (online) via Aura and writes it as
 * 48kHz stereo s16le PCM, so the bot can play it locally with no network when
 * its backend is down. Re-run if the wording or voice changes.
 */
const MESSAGE = 'Heads up — I have lost my connection to my services, so I cannot take notes right now. Feel free to remove me from the call, and I will rejoin automatically when I am back online.';

try {
  process.loadEnvFile(join(findRepoRoot(), '.env'));
} catch {
  // env may come from the shell
}

const tts = createDeepgramTts();
const { audio, format } = await tts.synthesize(MESSAGE);
const chunks: Buffer[] = [];

for await (const chunk of audio) {
  chunks.push(chunk);
}

const mono = Buffer.concat(chunks);
const stereo = format.channels === 1 ? upmixMonoToStereo(mono) : mono;
const outDir = join(import.meta.dirname, '..', 'assets');

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'offline-degraded.pcm'), stereo);

const seconds = stereo.length / (48000 * 2 * 2);

console.log(`wrote assets/offline-degraded.pcm — ${stereo.length} bytes (~${seconds.toFixed(1)}s stereo 48k)`);
