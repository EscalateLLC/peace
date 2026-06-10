/** The shipped themes. Default = `tron` (the digital/neon look). */
export const THEMES = ['tron', 'cloud', 'confluence', 'dreadnought', 'platinum', 'royalty', 'bubble'] as const;

export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = 'tron';

/** localStorage key for the persisted theme preference. */
export const STORAGE_KEY = 'peace-theme';
