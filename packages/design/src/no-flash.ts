import { DEFAULT_THEME, STORAGE_KEY, THEMES } from './types';

/**
 * Blocking script to inline in `<head>` (before any paint) so the right theme is
 * on `<html data-theme>` immediately — no flash of the default. Reads the stored
 * preference; `"auto"`/unset picks light→cloud, dark→tron from the OS.
 *
 *   <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
 */
export const NO_FLASH_SCRIPT = [
  '(function(){try{',
  `var k=${JSON.stringify(STORAGE_KEY)},ok=${JSON.stringify([...THEMES])},d=${JSON.stringify(DEFAULT_THEME)};`,
  'var t=localStorage.getItem(k);',
  'if(!t||t===\'auto\'){t=matchMedia(\'(prefers-color-scheme: light)\').matches?\'cloud\':d;}',
  'if(ok.indexOf(t)<0){t=d;}',
  'document.documentElement.setAttribute(\'data-theme\',t);',
  '}catch(e){}})();'
].join('');
