/**
 * @peace/design — the design system: the `--peace-*` token contract, the themes,
 * and the runtime theme switcher. Import the styles once at the app root:
 *
 *   import '@peace/design/styles';
 *
 * and inline `NO_FLASH_SCRIPT` in <head> + wrap the tree in <ThemeProvider>.
 */

export * from './types';

export * from './themes';

export * from './no-flash';

export * from './theme-provider';

export * from './theme-toggle';
