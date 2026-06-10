'use client';

import { type CSSProperties, type ReactNode, useState } from 'react';
import Link from 'next/link';
import { THEMES, type Theme, useTheme } from '@peace/design';
import { ChatBubble, useZoomStack, ZoomStack } from '../../_kit';

/* peace — design-system playground. A living, themeable reference: drive the
 * control bar (theme · typeface · density · motion) and watch every token +
 * control + state re-skin. Everything here authors against the --peace-* contract. */

const UI_FONTS = [
  {
    label: 'Hanken',
    value: 'var(--font-hanken), system-ui, sans-serif'
  },
  {
    label: 'Sora',
    value: 'var(--font-sora), system-ui, sans-serif'
  },
  {
    label: 'System',
    value: 'system-ui, -apple-system, sans-serif'
  },
  {
    label: 'Mono',
    value: 'var(--font-mono), ui-monospace, monospace'
  },
  {
    label: 'Arial',
    value: 'Arial, sans-serif'
  },
  {
    label: 'Verdana',
    value: 'Verdana, Geneva, sans-serif'
  },
  {
    label: 'Helvetica',
    value: '"Helvetica Neue", Helvetica, Arial, sans-serif'
  },
  {
    label: 'Tahoma',
    value: 'Tahoma, Geneva, sans-serif'
  }
];

const DISPLAY_FONTS = [
  {
    label: 'Fraunces',
    value: 'var(--font-fraunces), Georgia, serif'
  },
  {
    label: 'Newsreader',
    value: 'var(--font-newsreader), Georgia, serif'
  },
  {
    label: 'Unbounded',
    value: 'var(--font-unbounded), system-ui, sans-serif'
  },
  {
    label: 'Hanken',
    value: 'var(--font-hanken), system-ui, sans-serif'
  },
  {
    label: 'Georgia',
    value: 'Georgia, "Times New Roman", serif'
  },
  {
    label: 'Times',
    value: '"Times New Roman", Times, serif'
  },
  {
    label: 'Courier',
    value: '"Courier New", Courier, monospace'
  }
];

const SURFACES = [['field', 'base canvas'], ['panel', 'panel'], ['raised', 'raised'], ['line', 'hairline']];
const INKS = [['ink-strong', 'Aa'], ['ink', 'Aa'], ['ink-muted', 'Aa'], ['ink-faint', 'Aa']];
const KINDS = ['decision', 'action', 'question', 'topic', 'outcome'];
const CORNERS = ['sm', 'md', 'lg'];
const ELEVATIONS = [['lift', 'lift'], ['focal', 'focal'], ['drag', 'drag'], ['modal', 'modal']];
const CURSORS = ['pointer', 'zoom-in', 'zoom-out', 'grab', 'grabbing', 'col-resize', 'text'];

interface Msg { id: string; speaker: string; color: string; initials: string; time: string; text: string; bot?: boolean; interim?: boolean; grouped?: boolean }

const SAMPLE: Msg[] = [
  {
    id      : 'm1',
    speaker : 'Maya Chen',
    color   : 'var(--peace-speaker-0)',
    initials: 'MC',
    time    : '00:12',
    text    : 'Let’s lock the beta scope today — live transcript plus live decisions is the honest minimum.'
  },
  {
    id      : 'm2',
    speaker : 'Devin Okafor',
    color   : 'var(--peace-speaker-1)',
    initials: 'DO',
    time    : '00:34',
    text    : 'Agreed. The other four artifact types can generate in batch when the meeting stops.'
  },
  {
    id      : 'm3',
    speaker : 'peace',
    color   : 'var(--peace-accent)',
    initials: '✦',
    time    : '00:51',
    text    : 'Noted a decision: beta ships live transcript + live decisions; batch-generate the rest on stop.',
    bot     : true
  },
  {
    id      : 'm4',
    speaker : 'Priya Raman',
    color   : 'var(--peace-speaker-3)',
    initials: 'PR',
    time    : '01:09',
    text    : 'One open question — do we persist interim segments, or only committed ones?'
  },
  {
    id      : 'm5',
    speaker : 'Maya Chen',
    color   : 'var(--peace-speaker-0)',
    initials: 'MC',
    time    : '01:18',
    text    : 'Only committed. Interim is a render state, never a stored one.'
  },
  {
    id      : 'm6',
    speaker : 'Maya Chen',
    color   : 'var(--peace-speaker-0)',
    initials: 'MC',
    time    : '01:21',
    text    : 'It keeps the evidence links honest, too.',
    grouped : true
  }
];

function Section ({ num, title, blurb, wide, children }: { num: string; title: string; blurb: string; wide?: boolean; children: ReactNode }) {
  return (
    <section className={`sc-sec${wide ? ' sc-sec-wide' : ''}`}>
      <div className="sc-sec-head">
        <span className="sc-num">{num}</span>
        <h2>{title}</h2>
        <p>{blurb}</p>
      </div>
      {children}
    </section>
  );
}

export default function KitPlayground () {
  const { theme, setTheme } = useTheme();
  const [uiFont, setUiFont] = useState(UI_FONTS[0]!.value);
  const [displayFont, setDisplayFont] = useState(DISPLAY_FONTS[0]!.value);
  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');
  const [motion, setMotion] = useState(true);
  const [sel, setSel] = useState<string | null>('m2');
  const [card, setCard] = useState(1);
  const zoom = useZoomStack();

  const rootStyle = {
    '--peace-font-sans' : uiFont,
    '--peace-font-serif': displayFont,
    ...motion ? {} : { '--peace-motion-scale': '0' }
  } as CSSProperties;

  const openModal = () => zoom.zoom({
    key : 'card-zoom',
    body: (
      <div className="sc-modal">
        <span className="sc-eyebrow">zoom modal · ZoomStack</span>
        <h3>Decision — beta scope locked</h3>
        <p>The modal card takes the theme’s corner + elevation: bevel + heavy glow in tron, soft radius in cloud, a flat square sheet in confluence.</p>
        <div className="sc-row">
          <button
            type="button"
            className="sc-btn sc-btn-primary">Approve</button>
          <button
            type="button"
            className="sc-btn">Edit</button>
          <button
            type="button"
            className="sc-btn sc-btn-ghost"
            onClick={() => zoom.pop()}>Close</button>
        </div>
      </div>
    )
  });

  return (
    <div
      className="sc-root"
      style={rootStyle}>
      <style>{CSS}</style>

      <header className="sc-bar">
        <div className="sc-bar-l">
          <Link
            href="/mockups"
            className="sc-back">‹ mockups</Link>
          <span className="sc-wordmark">peace<span>· design system</span></span>
        </div>

        <div className="sc-controls">
          <div className="sc-ctl">
            <label>Theme</label>
            <div className="sc-seg">
              {THEMES.map(t => (
                <button
                  key={t}
                  type="button"
                  data-on={theme === t || undefined}
                  onClick={() => setTheme(t as Theme)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="sc-ctl">
            <label>UI font</label>
            <select
              className="sc-select"
              value={uiFont}
              onChange={e => setUiFont(e.target.value)}>
              {UI_FONTS.map(f => <option
                key={f.label}
                value={f.value}>{f.label}</option>)}
            </select>
          </div>

          <div className="sc-ctl">
            <label>Display</label>
            <select
              className="sc-select"
              value={displayFont}
              onChange={e => setDisplayFont(e.target.value)}>
              {DISPLAY_FONTS.map(f => <option
                key={f.label}
                value={f.value}>{f.label}</option>)}
            </select>
          </div>

          <div className="sc-ctl">
            <label>Density</label>
            <div className="sc-seg">
              <button
                type="button"
                data-on={density === 'compact' || undefined}
                onClick={() => setDensity('compact')}>compact</button>
              <button
                type="button"
                data-on={density === 'comfortable' || undefined}
                onClick={() => setDensity('comfortable')}>cozy</button>
            </div>
          </div>

          <div className="sc-ctl">
            <label>Motion</label>
            <div className="sc-seg">
              <button
                type="button"
                data-on={motion || undefined}
                onClick={() => setMotion(true)}>on</button>
              <button
                type="button"
                data-on={!motion || undefined}
                onClick={() => setMotion(false)}>off</button>
            </div>
          </div>
        </div>
      </header>

      <main className="sc-main">
        <div className="sc-intro">
          <span className="sc-eyebrow">peace · kit</span>
          <h1 className="sc-h1">Design system</h1>
          <p className="sc-lede">
            One <code>--peace-*</code> token contract, swappable themes. Drive the bar above — every
            surface, control, and state below re-skins live: colors, corners (bevel ↔ round ↔ square),
            elevation, highlights, cursors, motion, type.
          </p>
        </div>

        <Section
          num="01"
          title="Color"
          blurb="Surfaces, accents, the ink ramp, semantic kinds, and the speaker palette — all themed tokens.">
          <div className="sc-swatches">
            {SURFACES.map(([k, label]) => (
              <div
                key={k}
                className="sc-swatch">
                <span
                  className="sc-chip-color"
                  style={{ background: `var(--peace-${k})` }} />
                <span className="sc-swatch-name">{k}</span>
                <span className="sc-swatch-sub">{label}</span>
              </div>
            ))}
            {['accent', 'accent-2', 'danger', 'positive'].map(k => (
              <div
                key={k}
                className="sc-swatch">
                <span
                  className="sc-chip-color"
                  style={{ background: `var(--peace-${k})` }} />
                <span className="sc-swatch-name">{k}</span>
              </div>
            ))}
          </div>

          <div className="sc-ink-row">
            {INKS.map(([k, glyph]) => (
              <div
                key={k}
                className="sc-ink"
                style={{ color: `var(--peace-${k})` }}>
                <span className="sc-ink-glyph">{glyph}</span>
                <span className="sc-swatch-name">{k}</span>
              </div>
            ))}
          </div>

          <div className="sc-kinds">
            {KINDS.map(k => (
              <span
                key={k}
                className="sc-chip"
                style={{ ['--c' as string]: `var(--peace-kind-${k})` }}>{k}</span>
            ))}
            <span className="sc-divider" />
            {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
              <span
                key={i}
                className="sc-speaker"
                style={{ background: `var(--peace-speaker-${i})` }} />
            ))}
          </div>
        </Section>

        <Section
          num="02"
          title="Type"
          blurb="Display rides --peace-font-serif; UI + labels ride --peace-font-sans / -mono. Switch them in the bar.">
          <div className="sc-type">
            <div className="sc-type-display">Conversations become evidence.</div>
            <div className="sc-type-h">A structured, evidence-linked artifact</div>
            <p className="sc-type-body">Body copy in the UI typeface — readable at length, with the theme’s ink and measure. Decisions, action items, and open questions stay linked to the transcript segments that justify them.</p>
            <div className="sc-type-label">label · monospace · 0.1em</div>
          </div>
        </Section>

        <Section
          num="03"
          title="Shape & elevation"
          blurb="The corner keystone (one mixin, runtime bevel↔radius↔square) and the elevation scale.">
          <div className="sc-grid-auto">
            {CORNERS.map(s => (
              <figure
                key={s}
                className="sc-tile">
                <span
                  className="sc-shape"
                  style={{
                    borderRadius: `var(--peace-corner-radius-${s})`,
                    clipPath    : `var(--peace-corner-clip-${s})`
                  }} />
                <figcaption>corner · {s}</figcaption>
              </figure>
            ))}
            {ELEVATIONS.map(([k, label]) => (
              <figure
                key={k}
                className="sc-tile">
                <span
                  className="sc-elev"
                  style={{ boxShadow: `var(--peace-shadow-${k})` }} />
                <figcaption>shadow · {label}</figcaption>
              </figure>
            ))}
          </div>
        </Section>

        <Section
          num="04"
          title="Buttons"
          blurb="Primary, secondary, ghost, danger — with hover, focus-ring, active, and disabled states.">
          <div className="sc-row">
            <button
              type="button"
              className="sc-btn sc-btn-primary">Primary</button>
            <button
              type="button"
              className="sc-btn">Secondary</button>
            <button
              type="button"
              className="sc-btn sc-btn-ghost">Ghost</button>
            <button
              type="button"
              className="sc-btn sc-btn-danger">Danger</button>
            <button
              type="button"
              className="sc-btn"
              disabled>Disabled</button>
          </div>
          <p className="sc-hint">Tab to a button for the themed focus ring · hover for the highlight recipe.</p>
        </Section>

        <Section
          num="05"
          title="Inputs & controls"
          blurb="Text field (focus ring), select, switch, and chips — every state token-driven.">
          <div className="sc-row sc-row-wrap">
            <input
              className="sc-input"
              placeholder="Search the transcript…" />
            <select className="sc-select sc-select-lg">
              <option>All artifacts</option>
              <option>Decisions</option>
              <option>Action items</option>
            </select>
            <button
              type="button"
              className="sc-switch"
              data-on={motion || undefined}
              role="switch"
              aria-checked={motion}
              onClick={() => setMotion(m => !m)}
            >
              <span className="sc-switch-dot" />
            </button>
            <span className="sc-badge"><span className="sc-led" />live</span>
          </div>
        </Section>

        <Section
          num="06"
          title="Cards & states"
          blurb="Hover lift + the selected highlight (glow-border / soft-tint / side-bar by theme). Click to select.">
          <div className="sc-cards">
            {[0, 1, 2].map(i => (
              <button
                key={i}
                type="button"
                className="sc-card"
                data-selected={card === i || undefined}
                onClick={() => setCard(i)}
              >
                <span
                  className="sc-card-kind"
                  style={{ ['--c' as string]: `var(--peace-kind-${KINDS[i]})` }}>{KINDS[i]}</span>
                <span className="sc-card-title">{['Lock the beta scope', 'Pull Q3 numbers', 'Persist interim?'][i]}</span>
                <span className="sc-card-sub">linked to 3 segments</span>
              </button>
            ))}
          </div>
        </Section>

        <Section
          num="07"
          title="Cursors"
          blurb="Tokenized cursors — hover each cell. A theme could swap any for a custom image without touching components.">
          <div className="sc-cursors">
            {CURSORS.map(c => (
              <div
                key={c}
                className="sc-cursor"
                style={{ cursor: `var(--peace-cursor-${c})` }}>{c}</div>
            ))}
          </div>
        </Section>

        <Section
          num="08"
          title="ChatBubble + zoom"
          wide
          blurb="The kit's content control — hover zooms it for legibility (never maximizing), click selects, click the modal to drill in.">
          <div className="sc-bubbles">
            <div className="sc-stage sc-feed">
              {SAMPLE.map(m => (
                <ChatBubble
                  key={m.id}
                  data-seg={m.id}
                  speaker={m.speaker}
                  speakerColor={m.color}
                  initials={m.initials}
                  time={m.time}
                  variant={m.bot ? 'bot' : 'default'}
                  density={density}
                  interim={m.interim}
                  grouped={density === 'comfortable' ? m.grouped : undefined}
                  selected={sel === m.id}
                  onActivate={() => setSel(prev => (prev === m.id ? null : m.id))}
                >
                  {m.text}
                </ChatBubble>
              ))}
            </div>
            <div className="sc-stage sc-modal-launch">
              <span className="sc-eyebrow">interaction</span>
              <p>The ZoomStack modal inherits the theme’s corner + elevation.</p>
              <button
                type="button"
                className="sc-btn sc-btn-primary"
                onClick={openModal}>Open zoom modal</button>
            </div>
          </div>
        </Section>
      </main>

      <ZoomStack
        stack={zoom.stack}
        onPop={zoom.pop} />
    </div>
  );
}

const CSS = `
.sc-root { position: absolute; inset: 0; overflow-y: auto; background: var(--peace-field); color: var(--peace-ink); font-family: var(--peace-font-sans); }

/* ── control bar ─────────────────────────────────────────── */
.sc-bar { position: sticky; top: 0; z-index: 50; display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; padding: 12px 24px; background: color-mix(in oklch, var(--peace-panel) 86%, transparent); backdrop-filter: blur(14px); border-bottom: var(--peace-border-width) solid var(--peace-line); }
.sc-bar-l { display: flex; align-items: center; gap: 16px; }
.sc-back { font-family: var(--peace-font-mono); font-size: 11px; color: var(--peace-ink-faint); text-decoration: none; }
.sc-back:hover { color: var(--peace-accent); }
.sc-wordmark { font-family: var(--peace-font-mono); font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: var(--peace-ink-strong); display: flex; gap: 7px; align-items: baseline; }
.sc-wordmark span { font-weight: 400; color: var(--peace-ink-faint); letter-spacing: 0.14em; }

.sc-controls { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.sc-ctl { display: flex; flex-direction: column; gap: 5px; }
.sc-ctl > label { font-family: var(--peace-font-mono); font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--peace-ink-faint); }

.sc-seg { display: inline-flex; border: var(--peace-border-width) solid var(--peace-line); border-radius: var(--peace-corner-radius-sm); clip-path: var(--peace-corner-clip-sm); overflow: hidden; background: var(--peace-field); }
.sc-seg button { font-family: var(--peace-font-mono); font-size: 11px; letter-spacing: 0.04em; padding: 5px 11px; border: 0; background: transparent; color: var(--peace-ink-muted); cursor: var(--peace-cursor-pointer); transition: background calc(var(--peace-dur-1) * var(--peace-motion-scale)) var(--peace-ease), color calc(var(--peace-dur-1) * var(--peace-motion-scale)) var(--peace-ease); }
.sc-seg button:hover { color: var(--peace-ink); background: var(--peace-hover-bg); }
.sc-seg button:focus-visible { outline: none; box-shadow: var(--peace-focus-ring); }
.sc-seg button[data-on] { background: var(--peace-accent); color: var(--peace-on-accent); }

.sc-select { font-family: var(--peace-font-sans); font-size: 12px; padding: 6px 10px; background: var(--peace-field); color: var(--peace-ink); border: var(--peace-border-width) solid var(--peace-line); border-radius: var(--peace-corner-radius-sm); clip-path: var(--peace-corner-clip-sm); cursor: var(--peace-cursor-pointer); }
.sc-select:focus-visible { outline: none; box-shadow: var(--peace-focus-ring); }
.sc-select-lg { font-size: 13px; padding: 8px 12px; }

/* ── layout ──────────────────────────────────────────────── */
.sc-main { max-width: 1080px; margin: 0 auto; padding: 8px 32px 120px; }
.sc-intro { padding: 48px 0 12px; }
.sc-eyebrow { font-family: var(--peace-font-mono); font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--peace-accent); }
.sc-h1 { font-family: var(--peace-font-serif); font-size: 54px; font-weight: 400; letter-spacing: -0.02em; color: var(--peace-ink-strong); margin: 10px 0 0; }
.sc-lede { max-width: 64ch; font-size: 15.5px; line-height: 1.62; color: var(--peace-ink-muted); margin: 16px 0 0; }
.sc-lede code { font-family: var(--peace-font-mono); font-size: 13px; color: var(--peace-ink); }

.sc-sec { padding: 44px 0 0; border-top: var(--peace-border-width) solid var(--peace-line); margin-top: 44px; }
.sc-sec:first-of-type { border-top: 0; margin-top: 0; }
.sc-sec-head { margin-bottom: 22px; }
.sc-num { font-family: var(--peace-font-mono); font-size: 11px; letter-spacing: 0.1em; color: var(--peace-ink-faint); }
.sc-sec-head h2 { font-family: var(--peace-font-serif); font-size: 26px; font-weight: 500; color: var(--peace-ink-strong); margin: 4px 0 0; }
.sc-sec-head p { font-size: 14px; line-height: 1.55; color: var(--peace-ink-muted); margin: 6px 0 0; max-width: 70ch; }

.sc-row { display: flex; align-items: center; gap: 12px; }
.sc-row-wrap { flex-wrap: wrap; }
.sc-hint, .sc-tile figcaption, figcaption { font-family: var(--peace-font-mono); font-size: 11px; color: var(--peace-ink-faint); }
.sc-hint { margin: 14px 0 0; }

/* ── color ───────────────────────────────────────────────── */
.sc-swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(116px, 1fr)); gap: 12px; }
.sc-swatch { display: flex; flex-direction: column; gap: 6px; }
.sc-chip-color { height: 56px; border: var(--peace-border-width) solid var(--peace-line); border-radius: var(--peace-corner-radius-md); clip-path: var(--peace-corner-clip-md); }
.sc-swatch-name { font-family: var(--peace-font-mono); font-size: 11px; color: var(--peace-ink); }
.sc-swatch-sub { font-family: var(--peace-font-mono); font-size: 10px; color: var(--peace-ink-faint); }
.sc-ink-row { display: flex; gap: 26px; margin-top: 22px; }
.sc-ink { display: flex; align-items: baseline; gap: 8px; }
.sc-ink-glyph { font-family: var(--peace-font-serif); font-size: 30px; font-weight: 600; }
.sc-kinds { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 24px; }
.sc-divider { width: 1px; height: 20px; background: var(--peace-line); margin: 0 6px; }
.sc-speaker { width: 22px; height: 22px; border-radius: 50%; }

.sc-chip { font-family: var(--peace-font-mono); font-size: 11px; letter-spacing: 0.04em; padding: 3px 10px; border-radius: 999px; color: var(--c); border: 1px solid color-mix(in oklch, var(--c) 42%, transparent); background: color-mix(in oklch, var(--c) 14%, transparent); }

/* ── type ────────────────────────────────────────────────── */
.sc-type { display: flex; flex-direction: column; gap: 12px; }
.sc-type-display { font-family: var(--peace-font-serif); font-size: 44px; font-weight: 400; letter-spacing: -0.02em; line-height: 1.05; color: var(--peace-ink-strong); }
.sc-type-h { font-family: var(--peace-font-sans); font-size: 22px; font-weight: 600; color: var(--peace-ink-strong); }
.sc-type-body { font-size: 16px; line-height: 1.62; color: var(--peace-ink); max-width: 64ch; margin: 0; }
.sc-type-label { font-family: var(--peace-font-mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--peace-ink-muted); }

/* ── shape + elevation ───────────────────────────────────── */
.sc-grid-auto { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 18px; }
.sc-tile { margin: 0; display: flex; flex-direction: column; gap: 10px; align-items: center; }
.sc-tile figcaption { text-align: center; }
.sc-shape { width: 100%; height: 84px; background: var(--peace-raised); border: var(--peace-border-width) solid var(--peace-line); }
.sc-elev { width: 100%; height: 84px; background: var(--peace-panel); border: var(--peace-border-width) solid var(--peace-line); border-radius: var(--peace-corner-radius-md); clip-path: var(--peace-corner-clip-md); }

/* ── buttons ─────────────────────────────────────────────── */
.sc-btn { font-family: var(--peace-font-sans); font-size: 13px; font-weight: 600; padding: 9px 17px; color: var(--peace-ink); background: var(--peace-raised); border: var(--peace-border-width) solid var(--peace-line); border-radius: var(--peace-corner-radius-md); clip-path: var(--peace-corner-clip-md); cursor: var(--peace-cursor-pointer); transition: background calc(var(--peace-dur-2) * var(--peace-motion-scale)) var(--peace-ease), transform calc(var(--peace-dur-1) * var(--peace-motion-scale)) var(--peace-ease), box-shadow calc(var(--peace-dur-2) * var(--peace-motion-scale)) var(--peace-ease); }
.sc-btn:hover { background: var(--peace-hover-bg); border-color: var(--peace-hover-border); box-shadow: var(--peace-hover-glow); transform: var(--peace-hover-lift); }
.sc-btn:active { transform: translateY(1px); }
.sc-btn:focus-visible { outline: none; box-shadow: var(--peace-focus-ring); }
.sc-btn:disabled { opacity: 0.42; cursor: not-allowed; }
.sc-btn-primary { background: var(--peace-accent); color: var(--peace-on-accent); border-color: transparent; box-shadow: var(--peace-glow-accent); }
.sc-btn-primary:hover { background: color-mix(in oklch, var(--peace-accent) 88%, var(--peace-ink-strong)); }
.sc-btn-ghost { background: transparent; border-color: transparent; color: var(--peace-ink-muted); }
.sc-btn-ghost:hover { color: var(--peace-ink); }
.sc-btn-danger { color: var(--peace-danger); border-color: color-mix(in oklch, var(--peace-danger) 45%, transparent); background: color-mix(in oklch, var(--peace-danger) 10%, transparent); }
.sc-btn-danger:hover { background: color-mix(in oklch, var(--peace-danger) 18%, transparent); border-color: var(--peace-danger); }

/* ── inputs ──────────────────────────────────────────────── */
.sc-input { font-family: var(--peace-font-sans); font-size: 13px; padding: 9px 13px; min-width: 240px; background: var(--peace-field); color: var(--peace-ink); border: var(--peace-border-width) solid var(--peace-line); border-radius: var(--peace-corner-radius-sm); clip-path: var(--peace-corner-clip-sm); cursor: var(--peace-cursor-text); }
.sc-input::placeholder { color: var(--peace-ink-faint); }
.sc-input:focus-visible { outline: none; border-color: var(--peace-accent); box-shadow: var(--peace-focus-ring); }

.sc-switch { width: 42px; height: 24px; padding: 0; border: var(--peace-border-width) solid var(--peace-line); border-radius: 999px; background: var(--peace-field); cursor: var(--peace-cursor-pointer); position: relative; transition: background calc(var(--peace-dur-2) * var(--peace-motion-scale)) var(--peace-ease), box-shadow calc(var(--peace-dur-2) * var(--peace-motion-scale)) var(--peace-ease); }
.sc-switch:hover { box-shadow: var(--peace-hover-glow); }
.sc-switch:focus-visible { outline: none; box-shadow: var(--peace-focus-ring); }
.sc-switch[data-on] { background: var(--peace-accent); border-color: transparent; }
.sc-switch-dot { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: var(--peace-ink-strong); transition: transform calc(var(--peace-dur-2) * var(--peace-motion-scale)) var(--peace-ease); }
.sc-switch[data-on] .sc-switch-dot { transform: translateX(18px); background: var(--peace-on-accent); }

.sc-badge { display: inline-flex; align-items: center; gap: 7px; font-family: var(--peace-font-mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--peace-ink-muted); border: var(--peace-border-width) solid var(--peace-line); border-radius: 999px; padding: 4px 11px; }
.sc-led { width: 7px; height: 7px; border-radius: 50%; background: var(--peace-positive); box-shadow: var(--peace-glow-accent); animation: peace-pulse 1.6s ease-in-out infinite; }

/* ── cards ───────────────────────────────────────────────── */
.sc-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
.sc-card { display: flex; flex-direction: column; gap: 7px; align-items: flex-start; text-align: left; padding: 16px; background: var(--peace-panel); color: var(--peace-ink); border: var(--peace-border-width) solid var(--peace-line); border-radius: var(--peace-corner-radius-md); clip-path: var(--peace-corner-clip-md); cursor: var(--peace-cursor-pointer); transition: background calc(var(--peace-dur-2) * var(--peace-motion-scale)) var(--peace-ease), border-color calc(var(--peace-dur-2) * var(--peace-motion-scale)) var(--peace-ease), box-shadow calc(var(--peace-dur-2) * var(--peace-motion-scale)) var(--peace-ease), transform calc(var(--peace-dur-2) * var(--peace-motion-scale)) var(--peace-ease); }
.sc-card:hover { background: var(--peace-hover-bg); border-color: var(--peace-hover-border); box-shadow: var(--peace-hover-glow); transform: var(--peace-hover-lift); }
.sc-card:focus-visible { outline: none; box-shadow: var(--peace-focus-ring); }
.sc-card[data-selected] { background: var(--peace-selected-bg); border-color: var(--peace-selected-border); box-shadow: var(--peace-selected-glow); }
.sc-card-kind { font-family: var(--peace-font-mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--c); }
.sc-card-title { font-family: var(--peace-font-sans); font-size: 15px; font-weight: 600; color: var(--peace-ink-strong); }
.sc-card-sub { font-size: 12px; color: var(--peace-ink-faint); }

/* ── cursors ─────────────────────────────────────────────── */
.sc-cursors { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
.sc-cursor { display: flex; align-items: center; justify-content: center; height: 56px; font-family: var(--peace-font-mono); font-size: 11px; color: var(--peace-ink-muted); background: var(--peace-panel); border: var(--peace-border-width) solid var(--peace-line); border-radius: var(--peace-corner-radius-sm); clip-path: var(--peace-corner-clip-sm); }
.sc-cursor:hover { color: var(--peace-accent); border-color: var(--peace-hover-border); box-shadow: var(--peace-hover-glow); }

/* ── bubbles + modal ─────────────────────────────────────── */
.sc-bubbles { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; align-items: start; }
.sc-stage { background: var(--peace-panel); border: var(--peace-border-width) solid var(--peace-line); border-radius: var(--peace-corner-radius-lg); clip-path: var(--peace-corner-clip-lg); box-shadow: var(--peace-shadow-focal); padding: 14px; }
.sc-feed { display: flex; flex-direction: column; gap: 2px; }
.sc-modal-launch { display: flex; flex-direction: column; gap: 14px; align-items: flex-start; }
.sc-modal-launch p { font-size: 13.5px; line-height: 1.5; color: var(--peace-ink-muted); margin: 0; }
.sc-modal { padding: 28px; display: flex; flex-direction: column; gap: 12px; }
.sc-modal h3 { font-family: var(--peace-font-serif); font-size: 26px; font-weight: 500; color: var(--peace-ink-strong); margin: 4px 0 0; }
.sc-modal p { font-size: 14.5px; line-height: 1.6; color: var(--peace-ink-muted); margin: 0; }

@media (max-width: 820px) {
  .sc-bubbles { grid-template-columns: 1fr; }
  .sc-controls { width: 100%; }
}
`;
