/** Tiny className joiner — drops falsy parts. Keeps the kit dependency-free. */
export function cx (...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
