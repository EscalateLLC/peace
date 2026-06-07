const DISCORD_MESSAGE_LIMIT = 2000;

/**
 * Split a reply into Discord-sized messages, preferring line boundaries and
 * never splitting inside a fenced code block (fences are re-opened/closed
 * across chunk boundaries).
 */
export function chunkMessage (text: string, limit: number = DISCORD_MESSAGE_LIMIT): string[] {
  if (text.length <= limit) {
    return [text];
  }

  const chunks: string[] = [];
  let current = '';
  let inFence = false;

  for (const line of text.split('\n')) {
    const fenceToggles = line.trimStart().startsWith('```');

    // +4 leaves room for a closing fence if we have to break inside one.
    if (current.length + line.length + 4 > limit && current.length > 0) {
      chunks.push(inFence ? `${current}\n\`\`\`` : current);
      current = inFence ? '```\n' : '';
    }

    current = current.length > 0 ? `${current}\n${line}` : line;

    if (fenceToggles) {
      inFence = !inFence;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current);
  }

  return chunks;
}
