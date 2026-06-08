/**
 * Wake-phrase address detection — the B1 slice of the participation router's
 * H3 heuristic (router/02): does this utterance address the bot by name? Pure
 * and platform-agnostic. Lives in core so both the session adapters and the
 * router can use it without dragging in heavier packages.
 */

const WAKE_WORD = 'peace';
const FILLERS = new Set(['hey', 'ok', 'okay', 'yo', 'hi', 'hello', 'um', 'so']);

export interface WakeMatch {
  matched: boolean;

  /** Text after the wake word — fed to intent parsing ("peace, what did we decide" → "what did we decide"). */
  query: string;
}

/**
 * Match the wake word as the first meaningful token (optionally after one
 * filler like "hey"/"ok"). Position-anchored so "world peace" mid-sentence
 * doesn't trigger. Case/punctuation-insensitive.
 */
export function matchWakePhrase (text: string): WakeMatch {
  const cleaned = text.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .trim();
  const tokens = cleaned.split(/\s+/u).filter(Boolean);

  if (tokens.length === 0) {
    return {
      matched: false,
      query  : ''
    };
  }

  let wakeIndex = -1;

  if (tokens[0] === WAKE_WORD) {
    wakeIndex = 0;
  } else if (tokens.length > 1 && FILLERS.has(tokens[0] ?? '') && tokens[1] === WAKE_WORD) {
    wakeIndex = 1;
  }

  if (wakeIndex === -1) {
    return {
      matched: false,
      query  : ''
    };
  }

  const rest = tokens.slice(wakeIndex + 1);

  // Drop a leading "bot" ("peace bot, summarize").
  if (rest[0] === 'bot') {
    rest.shift();
  }

  return {
    matched: true,
    query  : rest.join(' ')
  };
}
