import type { PlatformAdapter, PlatformHandlers } from './platform';
import { transcriptFileStream } from './transcript-file';

export interface TranscriptReplayOptions {
  content: string;
  meetingId: string;

  /**
   * Delay between emitted events in ms (0 = as fast as possible). Lets a
   * fixture simulate live arrival for transport demos and UI testing.
   */
  paceMs?: number;
}

/**
 * A transcript file wrapped as a PlatformAdapter: the "fake live platform".
 * Replaying a fixture and sitting in a real call drive the exact same session
 * orchestration — this adapter is what keeps that claim honest before a
 * second live platform (Zoom, WhatsApp…) exists.
 */
export function createTranscriptReplayAdapter (options: TranscriptReplayOptions): PlatformAdapter {
  let stopped = false;

  return {
    platform    : 'upload',
    capabilities: {
      canSpeak          : false,
      hasPerSpeakerAudio: false,
      supportsBargeIn   : false,
      canSendText       : false,
      hasTextIngress    : true,
      audioFormat       : null
    },
    egress: {
      sendText: () => Promise.reject(new Error('transcript replay cannot send text')),
      speak   : () => Promise.reject(new Error('transcript replay cannot speak')),

      abortSpeech: () => {
        throw new Error('transcript replay cannot speak');
      }
    },

    connect: async (handlers: PlatformHandlers) => {
      try {
        for await (const event of transcriptFileStream(options.content, options.meetingId)) {
          if (stopped) {
            return;
          }

          if (options.paceMs) {
            await new Promise(resolve => setTimeout(resolve, options.paceMs));
          }

          handlers.onText(event);
        }

        handlers.onClosed();
      } catch (error) {
        handlers.onError(error instanceof Error ? error : new Error(String(error)));
      }
    },

    disconnect: () => {
      stopped = true;

      return Promise.resolve();
    }
  };
}
