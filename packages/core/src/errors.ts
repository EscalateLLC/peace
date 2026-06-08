/**
 * The error-boundary vocabulary. External-IO seams (TTS/STT/LLM) throw a
 * PeaceError so the boundaries above them can classify, translate, and surface
 * without sniffing message strings. A code answers three questions at once:
 * what failed, whether to retry, and what is safe to show a human.
 *
 * Lives in @peace/core (zod-only) so every layer — adapters, session, router,
 * apps — can import it without dragging in a vendor SDK. Only the `tts.*` codes
 * are wired today; `stt.*`/`llm.*` are reserved so those seams adopt the same
 * vocabulary later without another shape change.
 */
export type PeaceErrorCode =
  | 'tts.auth' // 401/402/403 — key/billing; NOT retryable, must surface
  | 'tts.rate_limited' // 429 — retryable after backoff
  | 'tts.transient' // 5xx / network — retryable
  | 'tts.unavailable' // no TTS provider configured at all
  | 'stt.unavailable'
  | 'llm.unavailable'
  | 'unknown';

export interface PeaceErrorOptions {

  /** Engineering-facing message (logs); may include vendor detail. Never shown raw to users. */
  message: string;

  /** Human-safe message — shown in chat / the workspace banner. No secrets, no stack noise. */
  userMessage: string;

  /** True if the same call could succeed on retry (transient/rate-limited). Default false. */
  retryable?: boolean;

  /** The underlying error, kept for logging/debugging. */
  cause?: unknown;
}

/**
 * A classified, surfaceable domain error. `message` is for logs; `userMessage`
 * is for humans; `code` drives boundary decisions (retry, fall back, announce).
 */
export class PeaceError extends Error {
  readonly code: PeaceErrorCode;

  readonly userMessage: string;

  readonly retryable: boolean;

  constructor (code: PeaceErrorCode, options: PeaceErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = 'PeaceError';
    this.code = code;
    this.userMessage = options.userMessage;
    this.retryable = options.retryable ?? false;
  }
}

export function isPeaceError (error: unknown): error is PeaceError {
  return error instanceof PeaceError;
}

/**
 * Normalize anything thrown into a PeaceError so a boundary always has a code
 * and a user-safe message. A PeaceError passes through unchanged; everything
 * else becomes `unknown` with a generic, non-leaking userMessage.
 */
export function asPeaceError (error: unknown): PeaceError {
  if (isPeaceError(error)) {
    return error;
  }

  return new PeaceError('unknown', {
    message    : error instanceof Error ? error.message : String(error),
    userMessage: 'Something went wrong.',
    cause      : error
  });
}
