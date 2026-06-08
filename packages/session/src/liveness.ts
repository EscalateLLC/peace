import type { AudioFormat, PlatformEgress } from '@peace/adapters';
import type { Logger } from '@peace/logger';

/**
 * The liveness contract (realtime/06): the platform-agnostic half of "the bot
 * must never be a silent ghost." Backend-health tracking decides *when* the
 * bot is degraded; LivenessController decides *how it announces that* through
 * whatever egress the platform offers. Both are pure of any platform SDK —
 * Discord/Zoom/phone supply the egress + clip, this logic is shared.
 */

const DEFAULT_FAILURE_THRESHOLD = 2;

export interface BackendHealthOptions {

  /** Consecutive failures before flipping to degraded. Default 2 (avoid single-blip flapping). */
  threshold?: number;
  onDegraded: () => void;
  onRecovered: () => void;
}

export interface BackendHealth {

  /** A backend call (e.g. STT) succeeded — clears the failure streak; recovers if degraded. */
  recordSuccess: () => void;

  /** A backend call threw — extends the failure streak; degrades at the threshold. */
  recordFailure: () => void;
  readonly degraded: boolean;
}

/**
 * Consecutive-failure state machine over backend calls. Flips degraded after
 * `threshold` failures in a row, recovers on the first success after that.
 * Edge-triggered: the callbacks fire only on transitions.
 */
export function createBackendHealth (options: BackendHealthOptions): BackendHealth {
  const threshold = options.threshold ?? DEFAULT_FAILURE_THRESHOLD;
  let consecutiveFailures = 0;
  let degraded = false;

  return {
    get degraded () {
      return degraded;
    },

    recordSuccess: () => {
      consecutiveFailures = 0;

      if (degraded) {
        degraded = false;
        options.onRecovered();
      }
    },

    recordFailure: () => {
      consecutiveFailures++;

      if (!degraded && consecutiveFailures >= threshold) {
        degraded = true;
        options.onDegraded();
      }
    }
  };
}

export interface LivenessControllerDeps {
  egress: Pick<PlatformEgress, 'speak' | 'sendText'>;

  /** True while a live voice connection exists (announce in voice vs. only chat). */
  isInVoice: () => boolean;

  /**
   * Pre-rendered local "my connection dropped" clip as PCM frames, or null if
   * unavailable. Local on purpose: cloud TTS is unreachable in this state.
   */
  degradedClip: (() => AsyncIterable<Buffer>) | null;
  clipFormat: AudioFormat;
  degradedChatMessage: string;
  recoveredChatMessage?: string;
  log: Logger;
}

export interface LivenessController {
  onDegraded: () => void;
  onRecovered: () => void;
}

/**
 * Announces degradation in-band: a local voice clip in the call (if in voice)
 * plus a chat message — once per degradation episode, so a flaky backend
 * doesn't spam. The voice clip needs no network (it's local audio + the
 * platform's own encoder), which is the whole point.
 */
export function createLivenessController (deps: LivenessControllerDeps): LivenessController {
  let announced = false;

  return {
    onDegraded: () => {
      if (announced) {
        return;
      }

      announced = true;
      deps.log.warn('liveness.degraded_announced', { inVoice: deps.isInVoice() });

      deps.egress.sendText(deps.degradedChatMessage).catch((error: unknown) => {
        deps.log.warn('liveness.announce_chat_failed', { error: String(error) });
      });

      if (deps.isInVoice() && deps.degradedClip) {
        deps.egress.speak(deps.degradedClip(), deps.clipFormat).catch((error: unknown) => {
          deps.log.warn('liveness.announce_voice_failed', { error: String(error) });
        });
      }
    },

    onRecovered: () => {
      if (!announced) {
        return;
      }

      announced = false;
      deps.log.info('liveness.recovered', {});

      if (deps.recoveredChatMessage) {
        deps.egress.sendText(deps.recoveredChatMessage).catch(() => undefined);
      }
    }
  };
}
