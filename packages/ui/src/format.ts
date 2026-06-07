/** Milliseconds since meeting start → "mm:ss" (or "h:mm:ss"). */
export function formatOffset (ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = totalSeconds % 60;
  const mmss = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return hours > 0 ? `${hours}:${mmss}` : mmss;
}

export function formatDate (epochMs: number): string {
  return new Date(epochMs).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

/** Stable hue per speaker for avatar/label coloring. */
export function speakerHue (speakerId: string): number {
  let hash = 0;

  for (const char of speakerId) {
    hash = (hash * 31 + char.codePointAt(0)!) % 360;
  }

  return hash;
}
