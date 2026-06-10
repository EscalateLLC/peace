'use client';

import { type CSSProperties, useState } from 'react';
import Link from 'next/link';
import { ChatBubble } from '../../_kit';

/* peace kit — a living reference for the intent-compatible controls. Shows the
 * opinionated default look and proves the override story (retheme via vars,
 * restyle via parts, merge via className). Dogfoods theme.css (--pk-*). */

interface Msg { id: string; speaker: string; color: string; initials: string; time: string; text: string; bot?: boolean; interim?: boolean; grouped?: boolean }

const CY = 'oklch(0.8 0.13 205)';
const AM = 'oklch(0.8 0.13 75)';
const VI = 'oklch(0.78 0.13 285)';
const PEACE = 'oklch(0.74 0.03 205)';

const SAMPLE: Msg[] = [
  {
    id      : 'm1',
    speaker : 'Maya Chen',
    color   : CY,
    initials: 'MC',
    time    : '00:12',
    text    : 'Let’s lock the beta scope today — I think live transcript plus live decisions is the honest minimum.'
  },
  {
    id      : 'm2',
    speaker : 'Devin Okafor',
    color   : AM,
    initials: 'DO',
    time    : '00:34',
    text    : 'Agreed. The other four artifact types can generate in batch when the meeting stops.'
  },
  {
    id      : 'm3',
    speaker : 'peace',
    color   : PEACE,
    initials: '✦',
    time    : '00:51',
    text    : 'Noted a decision: beta ships live transcript + live decisions; batch-generate the rest on stop.',
    bot     : true
  },
  {
    id      : 'm4',
    speaker : 'Priya Raman',
    color   : VI,
    initials: 'PR',
    time    : '01:09',
    text    : 'One open question — do we persist interim segments, or only committed ones?'
  },
  {
    id      : 'm5',
    speaker : 'Maya Chen',
    color   : CY,
    initials: 'MC',
    time    : '01:18',
    text    : 'Only committed. Interim is a render state, never a stored one.'
  },
  {
    id      : 'm6',
    speaker : 'Maya Chen',
    color   : CY,
    initials: 'MC',
    time    : '01:21',
    text    : 'It keeps the evidence links honest, too.',
    grouped : true
  }
];

const RETHEME: CSSProperties = {
  '--pk-accent'    : 'oklch(0.82 0.16 30)',
  '--pk-ink-strong': 'oklch(0.97 0.02 60)',
  '--pk-ink'       : 'oklch(0.9 0.03 60)',
  '--pk-ink-muted' : 'oklch(0.7 0.04 55)',
  '--pk-ink-faint' : 'oklch(0.58 0.04 50)'
} as CSSProperties;

const LIGHT: CSSProperties = {
  '--pk-panel'     : 'oklch(0.97 0.005 250)',
  '--pk-accent'    : 'oklch(0.55 0.16 265)',
  '--pk-ink-strong': 'oklch(0.22 0.02 265)',
  '--pk-ink'       : 'oklch(0.34 0.02 265)',
  '--pk-ink-muted' : 'oklch(0.5 0.02 265)',
  '--pk-ink-faint' : 'oklch(0.62 0.02 265)'
} as CSSProperties;

export default function KitDemo () {
  const [sel, setSel] = useState<string | null>('m2');

  const bubble = (m: Msg, density: 'compact' | 'comfortable', extra: Record<string, unknown> = {}) => (
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
      grouped={m.grouped}
      selected={sel === m.id}
      onActivate={() => setSel(prev => (prev === m.id ? null : m.id))}
      {...extra}
    >
      {m.text}
    </ChatBubble>
  );

  return (
    <div className="kit-root">
      <style>{CSS}</style>

      <header className="kit-head">
        <Link
          href="/mockups"
          className="kit-back"
        >
          ‹ mockups
        </Link>
        <div className="kit-title">
          <span className="kit-eyebrow">peace · kit</span>
          <h1 className="kit-h1">ChatBubble</h1>
          <p className="kit-lede">
            A transcript message as a <code>content</code> control — it highlights and
            <em> zooms for legibility</em> on hover (never maximizing its surface) and runs its own
            action on click. Ships an opinionated default look that is a suggestion, not a contract.
          </p>
          <span className="kit-badge">{'data-intent="content"'}</span>
        </div>
      </header>

      <section className="kit-sec">
        <div className="kit-sec-head">
          <span className="kit-num">01</span>
          <h2>Default — compact</h2>
          <p>The dense feed. Hover a message to zoom it for legibility; click to select.</p>
        </div>
        <div className="kit-stage kit-feed">{SAMPLE.map(m => bubble(m, 'compact'))}</div>
      </section>

      <section className="kit-sec">
        <div className="kit-sec-head">
          <span className="kit-num">02</span>
          <h2>Default — comfortable</h2>
          <p>The reading view. Avatars appear, type breathes, same-speaker runs group together.</p>
        </div>
        <div className="kit-stage kit-read">{SAMPLE.map(m => bubble(m, 'comfortable'))}</div>
      </section>

      <section className="kit-sec">
        <div className="kit-sec-head">
          <span className="kit-num">03</span>
          <h2>States</h2>
          <p>Streaming (caret), bot turns, and the cross-link selected highlight.</p>
        </div>
        <div className="kit-grid">
          <figure className="kit-cell">
            <div className="kit-stage">
              {bubble({
                id      : 'st-interim',
                speaker : 'Priya Raman',
                color   : VI,
                initials: 'PR',
                time    : '02:03',
                text    : 'Pulling the Q3 numbers now',
                interim : true
              }, 'comfortable')}
            </div>
            <figcaption>interim — writing caret</figcaption>
          </figure>
          <figure className="kit-cell">
            <div className="kit-stage">
              {bubble(SAMPLE[2]!, 'comfortable')}
            </div>
            <figcaption>{'variant="bot"'}</figcaption>
          </figure>
        </div>
      </section>

      <section className="kit-sec">
        <div className="kit-sec-head">
          <span className="kit-num">04</span>
          <h2>Overrideable — the default is a suggestion</h2>
          <p>Same component, transparent at every layer. Nothing is hashed or locked.</p>
        </div>
        <div className="kit-grid kit-grid-3">
          <figure className="kit-cell">
            <div
              className="kit-stage"
              style={RETHEME}
            >{SAMPLE.slice(0, 3).map(m => bubble(m, 'comfortable'))}</div>
            <figcaption>retheme — set <code>--pk-*</code> on a wrapper</figcaption>
          </figure>

          <figure className="kit-cell">
            <div className="kit-stage kit-restyle">{SAMPLE.slice(0, 3).map(m => bubble(m, 'comfortable'))}</div>
            <figcaption>restyle — target <code>.pk-bubble</code> / <code>data-part</code></figcaption>
          </figure>

          <figure className="kit-cell">
            <div
              className="kit-stage"
              style={LIGHT}
            >{SAMPLE.slice(0, 3).map(m => bubble(m, 'comfortable', { className: 'kit-card' }))}</div>
            <figcaption>retheme (light) + merge <code>className</code></figcaption>
          </figure>
        </div>
      </section>
    </div>
  );
}

const CSS = `
.kit-root { position: absolute; inset: 0; overflow-y: auto; background: var(--pk-field); color: var(--pk-ink); font-family: var(--pk-font-sans); padding: 0 0 80px; }
.kit-head { max-width: 980px; margin: 0 auto; padding: 40px 32px 8px; }
.kit-back { font-family: var(--pk-font-mono); font-size: 11px; letter-spacing: 0.06em; color: var(--pk-ink-faint); text-decoration: none; }
.kit-back:hover { color: var(--pk-accent); }
.kit-title { margin-top: 26px; }
.kit-eyebrow { font-family: var(--pk-font-mono); font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--pk-accent); }
.kit-h1 { font-family: var(--pk-font-serif); font-size: 52px; font-weight: 400; letter-spacing: -0.02em; color: var(--pk-ink-strong); margin: 8px 0 0; }
.kit-lede { max-width: 60ch; font-size: 15px; line-height: 1.6; color: var(--pk-ink-muted); margin: 14px 0 0; }
.kit-lede code, .kit-badge, .kit-num { font-family: var(--pk-font-mono); }
.kit-lede code { color: var(--pk-ink); font-size: 13px; }
.kit-badge { display: inline-block; margin-top: 16px; font-size: 11px; letter-spacing: 0.04em; color: var(--pk-accent); border: 1px solid var(--pk-line); border-radius: 999px; padding: 3px 10px; }

.kit-sec { max-width: 980px; margin: 0 auto; padding: 40px 32px 0; }
.kit-sec-head { display: flex; flex-direction: column; gap: 2px; margin-bottom: 16px; }
.kit-num { font-size: 11px; letter-spacing: 0.1em; color: var(--pk-ink-faint); }
.kit-sec-head h2 { font-family: var(--pk-font-serif); font-size: 22px; font-weight: 500; color: var(--pk-ink-strong); margin: 2px 0 0; }
.kit-sec-head p { font-size: 13.5px; color: var(--pk-ink-muted); margin: 4px 0 0; max-width: 64ch; }

.kit-stage { background: var(--pk-panel); border: 1px solid var(--pk-line); border-radius: 16px; padding: 10px; display: flex; flex-direction: column; gap: 2px; }
.kit-feed { padding: 12px 8px; }
.kit-read { padding: 18px; align-items: center; gap: 0; }
.kit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.kit-grid-3 { grid-template-columns: repeat(3, 1fr); }
.kit-cell { margin: 0; }
.kit-cell figcaption { font-family: var(--pk-font-mono); font-size: 11px; color: var(--pk-ink-faint); margin-top: 8px; text-align: center; }
.kit-cell figcaption code { color: var(--pk-ink-muted); }
.kit-grid .kit-stage { min-height: 100%; }

/* restyle specimen — target the kit's STABLE classes/parts (transparent, not hashed) */
.kit-restyle .pk-bubble { background: var(--pk-raised); border: 1px solid var(--pk-line); border-radius: 14px; padding: 12px 14px; }
.kit-restyle .pk-bubble:hover { transform: none; box-shadow: none; background: var(--pk-raised); border-color: color-mix(in oklch, var(--pk-accent) 50%, transparent); }
.kit-restyle [data-part="name"] { text-transform: uppercase; letter-spacing: 0.12em; }
.kit-restyle [data-part="text"] { font-family: var(--pk-font-serif); font-style: italic; }

/* className merge specimen */
.kit-card.pk-bubble { background: var(--pk-panel); border: 1px solid color-mix(in oklch, var(--pk-accent) 30%, transparent); border-radius: 12px; }

@media (max-width: 720px) { .kit-grid, .kit-grid-3 { grid-template-columns: 1fr; } }
`;
