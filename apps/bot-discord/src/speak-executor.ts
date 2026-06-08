import type { PlatformEgress, SpeechHandle } from '@peace/adapters';
import { asPeaceError, PeaceError, type MeetingNotice } from '@peace/core';
import { errorFields, type Logger } from '@peace/logger';
import type { Candidate } from '@peace/router';
import type { TextToSpeech, TtsProvider } from '@peace/transcription';

/** A notice the executor wants surfaced; the bot stamps meetingId/at. */
export type NoticeInput = Pick<MeetingNotice, 'severity' | 'code' | 'message'>;

/** Current voice-output health, reported up so the agent can be made self-aware. */
export type VoiceStatus = 'primary' | 'backup' | 'down';

export interface SpeakExecutorDeps {

  /** Composite TTS (ElevenLabs → Aura), or null when nothing is configured. */
  tts: TextToSpeech | null;

  /** The provider we expect normally — so a result from any other one reads as a fallback switch. */
  primaryProvider: TtsProvider | null;
  egress: Pick<PlatformEgress, 'speak' | 'sendText'>;
  toSpokenText: (markdown: string) => string;

  /** Wire the adapter's speech handle to the candidate (the bot owns the id maps). */
  onSpoken: (candidateId: string, handle: SpeechHandle) => void;

  /** Persist a turn that was delivered as TEXT (not voice) — the register-or-discard invariant, text branch. */
  registerText: (candidate: Candidate) => void;

  /** Surface an operational notice to the workspace banner. */
  publishNotice: (notice: NoticeInput) => void;

  /** Report the current voice health so the bot can inform participants + the agent. */
  onVoiceStatus?: (status: VoiceStatus) => void;
  log: Logger;
}

/**
 * The voice boundary: turn a drafted candidate into delivered communication,
 * and NEVER let a TTS failure become silence. The degradation ladder:
 *
 *   primary voice → backup voice (handled inside the composite TTS)
 *                 → text in chat + an operational notice
 *
 * On total failure it still delivers the answer as text, registers that turn
 * (it *was* delivered), surfaces a notice, then throws so the router treats
 * voice as not-delivered (no in-flight speech, no wait for a `speech.finished`
 * that will never arrive). Switch/failure notices fire once per episode so a
 * persistently-down provider doesn't spam the channel or the banner.
 */
export function createSpeakExecutor (deps: SpeakExecutorDeps): { speak: (candidate: Candidate) => Promise<SpeechHandle> } {
  let switchAnnounced = false;
  let failureAnnounced = false;

  async function speak (candidate: Candidate): Promise<SpeechHandle> {
    const spoken = deps.toSpokenText(candidate.text ?? '');

    try {
      if (!deps.tts) {
        throw new PeaceError('tts.unavailable', {
          message    : 'no TTS provider configured',
          userMessage: 'No voice service is configured.'
        });
      }

      const result = await deps.tts.synthesize(spoken);
      const egressHandle = await deps.egress.speak(result.audio, {
        sampleRate: result.format.sampleRate,
        channels  : result.format.channels,
        encoding  : 'pcm-s16le'
      });

      // Voice worked → the failure episode (if any) is over.
      failureAnnounced = false;

      // Announce a fallback-voice switch once per episode; reset when back on primary.
      const onBackup = Boolean(result.provider && deps.primaryProvider && result.provider !== deps.primaryProvider);

      if (onBackup) {
        deps.onVoiceStatus?.('backup');

        if (!switchAnnounced) {
          switchAnnounced = true;
          deps.log.warn('voice.provider_switched', { provider: result.provider });
          deps.publishNotice({
            severity: 'warning',
            code    : 'tts.transient',
            message : 'My main voice cut out — switched to my backup voice.'
          });

          // Tell the people in the call, not just the workspace banner.
          await deps.egress.sendText('⚠️ My main voice cut out — I\'m on my backup voice for now.').catch((sendError: unknown) => {
            deps.log.warn('voice.switch_announce_failed', errorFields(sendError));
          });
        }
      } else if (result.provider === deps.primaryProvider) {
        switchAnnounced = false;
        deps.onVoiceStatus?.('primary');
      }

      // The router speaks in candidate ids; the bot keeps the candidate↔egress
      // handle maps (abortSpeech / speech.finished translate through them).
      deps.onSpoken(candidate.id, egressHandle);

      return { id: candidate.id };
    } catch (error) {
      const peaceError = asPeaceError(error);

      deps.log.error('voice.tts_failed', {
        candidateId: candidate.id,
        code       : peaceError.code,
        ...errorFields(error)
      });
      deps.onVoiceStatus?.('down');

      // Degrade to text so the user still gets the answer — never silence.
      const text = candidate.text?.trim() ?? '';

      if (text.length > 0) {
        await deps.egress.sendText(`[voice unavailable — replying in text]\n${text}`).catch((sendError: unknown) => {
          deps.log.warn('voice.text_fallback_failed', errorFields(sendError));
        });
        deps.registerText(candidate);
      }

      // One notice per failure episode (avoid banner/chat spam while a provider is down).
      if (!failureAnnounced) {
        failureAnnounced = true;
        deps.publishNotice({
          severity: 'error',
          code    : peaceError.code,
          message : `${peaceError.userMessage} Peace replied in text instead.`
        });
      }

      // Tell the router voice was NOT delivered.
      throw peaceError;
    }
  }

  return { speak };
}
