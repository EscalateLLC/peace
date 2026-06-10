import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json';

// sass resolves a relative loadPath against the working directory, which for this
// package's test run (`pnpm --filter @peace/design test`) is packages/design.
const compile = (body: string) => compileString(body, { loadPaths: ['src/styles'] }).css;

describe('@peace/design exports', () => {
  it('exposes the ./mixins subpath for SCSS consumers', () => {
    expect(pkg.exports['./mixins']).toBe('./src/styles/mixins/_index.scss');
  });
});

describe('interactive() mixin', () => {
  const css = compile('@use \'mixins\' as m;\n.demo { @include m.interactive(); }');

  it('lays down a resting themed surface that animates the interaction props', () => {
    expect(css).toMatch(/\.demo\s*\{[\s\S]*var\(--peace-panel\)/);
    expect(css).toContain('border: var(--peace-border-width) solid var(--peace-line)');
    expect(css).toContain(
      'transition-property: background-color, border-color, box-shadow, transform'
    );
  });

  it('drives hover, keyboard focus, and selected each from the --peace-* tokens', () => {
    expect(css).toContain('.demo:hover');
    expect(css).toContain('var(--peace-hover-glow)');
    expect(css).toContain('.demo:focus-visible');
    expect(css).toContain('var(--peace-focus-ring)');
    expect(css).toMatch(/\.demo\[data-selected\]/);
    expect(css).toContain('var(--peace-selected-glow)');
  });

  it('threads through a custom bg, corner size, and selected selector', () => {
    const custom = compile(
      '@use \'mixins\' as m;\n.tab { @include m.interactive($bg: var(--peace-raised), $size: sm, $selected: \'&[aria-pressed="true"]\'); }'
    );

    expect(custom).toContain('background: var(--peace-raised)');
    expect(custom).toContain('var(--peace-corner-clip-sm)');
    expect(custom).toContain('.tab[aria-pressed=true]');
    expect(custom).not.toContain('.tab[data-selected]');
  });
});
