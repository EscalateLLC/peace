/** Spoken replies are capped — the full text still goes to chat when relevant. */
const MAX_SPOKEN_CHARS = 600;

/**
 * Pronunciation lexicon: a JSON map of word/name → phonetic respelling, applied
 * case-insensitively on word boundaries before synthesis. Fixes TTS
 * mispronunciations (esp. names ElevenLabs/Aura garble) with no code change —
 * respelling is the only reliable, provider-agnostic lever (eleven_turbo_v2_5
 * does not honor SSML <phoneme> tags). Set it in `.env`, e.g.:
 *   PEACE_TTS_LEXICON={"Xsno":"Ex-no","Sachit":"Suh-cheet"}
 */
export type Lexicon = [RegExp, string][];

/** Parse PEACE_TTS_LEXICON (a JSON map) into word-boundary respelling rules; [] on absent/invalid. */
export function buildLexicon (raw: string | undefined): Lexicon {
  if (!raw) {
    return [];
  }

  try {
    const map = JSON.parse(raw) as Record<string, string>;

    return Object.entries(map).map(([word, say]): [RegExp, string] => [
      new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\b`, 'giu'),
      say
    ]);
  } catch {
    return [];
  }
}

/** Apply a pronunciation lexicon (respell names the TTS engine garbles). */
export function applyLexicon (text: string, lexicon: Lexicon): string {
  return lexicon.reduce((acc, [pattern, say]) => acc.replace(pattern, say), text);
}

const LEXICON = buildLexicon(process.env.PEACE_TTS_LEXICON);

/**
 * Markdown → speakable plain text. Reading bullets and asterisks aloud is
 * miserable, so strip formatting, drop code/mermaid blocks, and truncate at a
 * sentence boundary. (The agent is told to return plain speech already; this
 * is the safety net + length cap.)
 */
export function toSpokenText (markdown: string): string {
  let text = applyLexicon(markdown, LEXICON)
    .replace(/```[\s\S]*?```/gu, ' ')
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/\*\*([^*]+)\*\*/gu, '$1')
    .replace(/\*([^*]+)\*/gu, '$1')
    .replace(/_([^_]+)_/gu, '$1')
    .replace(/^#{1,6}\s*/gmu, '')
    .replace(/^\s*[-*]\s+/gmu, '')
    .replace(/\[[ x]\]\s*/giu, '')
    .replace(/\(v\d+\)/gu, '')

    // em/en dashes read awkwardly (and tripped some TTS engines) — make them a pause.
    .replace(/\s*[—–]\s*/gu, ', ')
    .replace(/\s+/gu, ' ')
    .trim();

  if (text.length > MAX_SPOKEN_CHARS) {
    const cut = text.slice(0, MAX_SPOKEN_CHARS);
    const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));

    text = `${lastStop > 200 ? cut.slice(0, lastStop + 1) : cut} …`;
  }

  return text;
}
