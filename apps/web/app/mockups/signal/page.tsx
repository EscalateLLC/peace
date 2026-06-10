'use client';

import Link from 'next/link';
import { useEvidenceHighlight } from '../_shared';
import {
  ACTIONS,
  DECISIONS,
  KEY_POINTS,
  MEETING,
  QUESTIONS,
  SEGMENTS,
  SPEAKERS,
  offset,
  speakerSlot
} from '../_data';

/* Direction C — Expressive Signal.
 * Voices are colored signals weaving through a dark violet field; insight
 * crystallizes out of the flow. Per-speaker hue identity (name, rail, live
 * ribbon), kinetic interim type, a white-hot crystallization flash. Bot is the
 * one desaturated hue — present, but staff, not cast. Idle = still. */

const HUES = [200, 330, 122, 58, 270, 16, 162, 300];

function hue (speakerId: string): number {
  return HUES[speakerSlot(speakerId)] ?? 200;
}

function speakerColor (speakerId: string): string {
  if (speakerId === 'peace') {
    return 'oklch(0.72 0.03 280)';
  }

  return `oklch(0.76 0.17 ${hue(speakerId)})`;
}

export default function ExpressiveSignal () {
  const { highlighted, highlight, clear, containerRef } = useEvidenceHighlight();

  return (
    <div
      className="c-root"
      onClick={event => {
        if (!(event.target instanceof Element) || !event.target.closest('[data-chip]')) {
          clear();
        }
      }}
    >
      <style>{CSS}</style>

      <header className="c-bar">
        <Link
          href="/mockups"
          className="c-back"
        >
          ← directions
        </Link>
        <div className="c-title">{MEETING.title}</div>
        <div className="c-roster">
          {SPEAKERS.map(s => {
            const speaking = s.id === MEETING.speakingId;

            return (
              <span
                key={s.id}
                className={`c-chip${speaking ? ' c-chip-on' : ''}`}
                style={{ '--hue': speakerColor(s.id) } as React.CSSProperties}
              >
                {s.short}
                {speaking && <Ribbon active />}
              </span>
            );
          })}
          <span
            className="c-chip c-chip-bot"
            style={{ '--hue': speakerColor('peace') } as React.CSSProperties}
          >
            peace
            <Ribbon state="listening" />
          </span>
        </div>
      </header>

      <main className="c-panes">
        <section
          className="c-pane c-transcript"
          ref={containerRef}
        >
          {SEGMENTS.map(seg => (
            <div
              key={seg.id}
              data-seg={seg.id}
              data-on={highlighted.has(seg.id) || undefined}
              className={`c-seg${seg.bot ? ' c-seg-bot' : ''}${seg.interim ? ' c-seg-interim' : ''}`}
              style={{ '--hue': speakerColor(seg.speakerId) } as React.CSSProperties}
            >
              <span className="c-rail" />
              <div className="c-seg-body">
                <div className="c-seg-head">
                  <span className="c-name">{seg.speaker}</span>
                  <span className="c-ts">{offset(seg.t)}</span>
                </div>
                <p className="c-text">
                  {seg.interim ? seg.text.split(' ').map((w, i) => (
                    <span
                      key={i}
                      className="c-word"
                      style={{ animationDelay: `${i * 28}ms` }}
                    >
                      {w}{' '}
                    </span>
                  )) : seg.text}
                </p>
              </div>
            </div>
          ))}
        </section>

        <section className="c-pane c-signal">
          <div className="c-signal-label">signal condensing</div>
          {DECISIONS.map(d => (
            <article
              key={d.id}
              className={`c-crystal${d.provisional ? ' c-crystal-new' : ''}`}
            >
              <div className="c-crystal-kind">decision</div>
              <p className="c-crystal-text">{d.text}</p>
              {d.rationale && <p className="c-crystal-sub">{d.rationale}</p>}
              <Evidence
                ids={d.evidence}
                onHighlight={highlight}
              />
            </article>
          ))}

          <div className="c-mini-h">actions</div>
          {ACTIONS.map(a => (
            <article
              key={a.id}
              className={`c-mini${a.provisional ? ' c-mini-forming' : ''}`}
            >
              <p className="c-mini-text">{a.text}</p>
              <div className="c-mini-meta">
                {a.assignee && <span className="c-tag">{a.assignee}</span>}
                {a.due && <span className="c-tag">{a.due}</span>}
                <Evidence
                  ids={a.evidence}
                  onHighlight={highlight}
                />
              </div>
            </article>
          ))}

          <div className="c-mini-h">questions · key points</div>
          {[...QUESTIONS, ...KEY_POINTS].map(item => (
            <article
              key={item.id}
              className="c-mini c-mini-quiet"
            >
              <p className="c-mini-text">{item.text}</p>
              <Evidence
                ids={item.evidence}
                onHighlight={highlight}
              />
            </article>
          ))}
        </section>

        <section className="c-pane c-diagram">
          <div className="c-signal-label">flow</div>
          <SignalFlow />
        </section>
      </main>
    </div>
  );
}

function Ribbon ({ active, state }: { active?: boolean; state?: 'listening' }) {
  const bars = [0, 1, 2, 3, 4];

  return (
    <span className={`c-ribbon${active ? ' c-ribbon-active' : ''}${state === 'listening' ? ' c-ribbon-flat' : ''}`}>
      {bars.map(i => (
        <span
          key={i}
          className="c-ribbon-bar"
          style={{ animationDelay: `${i * 90}ms` }}
        />
      ))}
    </span>
  );
}

function Evidence ({ ids, onHighlight }: { ids: string[]; onHighlight: (ids: string[]) => void }) {
  return (
    <button
      data-chip
      type="button"
      className="c-evidence"
      onClick={() => onHighlight(ids)}
      title={`${ids.length} source segment${ids.length === 1 ? '' : 's'}`}
    >
      ◆ {ids.length}
    </button>
  );
}

function SignalFlow () {
  return (
    <svg
      viewBox="0 0 280 340"
      className="c-flow"
      role="img"
      aria-label="decision flow"
    >
      <defs>
        <linearGradient
          id="c-grad"
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop
            offset="0"
            stopColor="oklch(0.76 0.17 200)"
          />
          <stop
            offset="1"
            stopColor="oklch(0.76 0.17 330)"
          />
        </linearGradient>
      </defs>
      <path
        className="c-flow-edge"
        d="M140 60 L140 138"
      />
      <path
        className="c-flow-edge"
        d="M140 174 L80 250"
      />
      <path
        className="c-flow-edge"
        d="M140 174 L200 250"
      />
      <FlowNode
        x={140}
        y={40}
        w={156}
        label="Ship live transcription?"
      />
      <FlowNode
        x={140}
        y={156}
        w={172}
        label="Live transcript + decisions"
        accent
      />
      <FlowNode
        x={80}
        y={272}
        w={104}
        label="4 types → batch"
        small
      />
      <FlowNode
        x={200}
        y={272}
        w={104}
        label="Load-test path"
        small
        pulse
      />
    </svg>
  );
}

function FlowNode ({ x, y, w, label, accent, small, pulse }: { x: number; y: number; w: number; label: string; accent?: boolean; small?: boolean; pulse?: boolean }) {
  const h = small ? 38 : 46;

  return (
    <g className={pulse ? 'c-node c-node-pulse' : 'c-node'}>
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={14}
        className={accent ? 'c-node-box c-node-box-accent' : 'c-node-box'}
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        className={small ? 'c-node-label c-node-label-sm' : 'c-node-label'}
      >
        {label}
      </text>
    </g>
  );
}

const CSS = `
.c-root {
  --c-field: oklch(0.15 0.03 290);
  --c-base: oklch(0.19 0.035 290);
  --c-raised: oklch(0.23 0.04 290);
  --c-ink-strong: oklch(0.96 0.012 290);
  --c-ink: oklch(0.82 0.02 290);
  --c-ink-muted: oklch(0.62 0.03 290);
  --c-ink-faint: oklch(0.48 0.03 290);
  --c-crystal: oklch(0.93 0.06 290);

  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  font-family: var(--font-sora), system-ui, sans-serif;
  color: var(--c-ink);
  background:
    radial-gradient(900px 600px at 12% 8%, oklch(0.2 0.06 250 / 0.5), transparent 55%),
    linear-gradient(160deg, oklch(0.17 0.05 290), oklch(0.145 0.04 225) 58%, oklch(0.15 0.045 295));
  animation: c-field 22s ease-in-out infinite;
}
@keyframes c-field { 0%,100% { background-position: 0 0; } 50% { background-position: 0 -1%; } }

.c-bar {
  display: flex; align-items: center; gap: 18px;
  padding: 0 22px; height: 56px;
  border-bottom: 1px solid oklch(1 0 0 / 0.06);
  background: oklch(0.16 0.035 290 / 0.55);
  backdrop-filter: blur(14px);
  flex-shrink: 0;
}
.c-back { font-size: 12px; color: var(--c-ink-muted); text-decoration: none; transition: color 160ms; }
.c-back:hover { color: var(--c-ink); }
.c-title {
  font-family: var(--font-unbounded), sans-serif;
  font-size: 14px; font-weight: 600; color: var(--c-ink-strong);
  letter-spacing: -0.01em;
}
.c-roster { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.c-chip {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 12px; font-weight: 500;
  color: var(--hue);
  padding: 4px 11px 4px 10px; border-radius: 999px;
  border: 1px solid color-mix(in oklch, var(--hue) 35%, transparent);
  background: color-mix(in oklch, var(--hue) 9%, transparent);
  transition: all 200ms;
}
.c-chip-on {
  box-shadow: 0 0 18px -4px var(--hue);
  border-color: color-mix(in oklch, var(--hue) 60%, transparent);
}
.c-chip-bot { color: var(--hue); opacity: 0.85; }

.c-ribbon { display: inline-flex; align-items: center; gap: 2px; height: 13px; }
.c-ribbon-bar {
  width: 2px; height: 4px; border-radius: 2px;
  background: currentColor; opacity: 0.85;
}
.c-ribbon-active .c-ribbon-bar { animation: c-wave 700ms ease-in-out infinite; }
@keyframes c-wave { 0%,100% { height: 3px; } 50% { height: 12px; } }
.c-ribbon-flat .c-ribbon-bar { height: 2px; opacity: 0.5; }

.c-panes { display: grid; grid-template-columns: 1fr 1.12fr 0.86fr; flex: 1; min-height: 0; }
.c-pane { min-height: 0; overflow-y: auto; padding: 16px 16px 44px; }
.c-pane + .c-pane { border-left: 1px solid oklch(1 0 0 / 0.05); }

/* transcript — braided rails */
.c-seg {
  position: relative; display: flex; gap: 12px;
  padding: 7px 8px 7px 0; border-radius: 10px;
  animation: c-rise 380ms cubic-bezier(0.2,0,0,1) both;
  transition: background 200ms;
}
.c-seg[data-on] { background: color-mix(in oklch, var(--hue) 14%, transparent); }
.c-seg:not([data-on]):hover { background: oklch(1 0 0 / 0.025); }
@keyframes c-rise { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: none; } }
.c-rail {
  flex-shrink: 0; width: 3px; border-radius: 3px; align-self: stretch;
  background: var(--hue);
  box-shadow: 0 0 10px -1px var(--hue);
}
.c-seg-bot .c-rail { box-shadow: none; opacity: 0.6; }
.c-seg-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 2px; }
.c-name { font-size: 12px; font-weight: 600; color: var(--hue); }
.c-ts { font-family: var(--font-mono); font-size: 10px; color: var(--c-ink-faint); }
.c-text { font-size: 14px; line-height: 1.5; color: var(--c-ink); }
.c-seg-bot .c-text { color: var(--c-ink-muted); }
.c-seg-interim .c-text { color: var(--c-ink-muted); }
.c-word { display: inline-block; animation: c-word 320ms ease both; }
@keyframes c-word { from { opacity: 0; transform: translateY(4px); filter: blur(2px); } to { opacity: 1; transform: none; filter: none; } }

/* signal center */
.c-signal-label, .c-mini-h {
  font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--c-ink-faint); margin: 2px 2px 14px;
}
.c-mini-h { margin-top: 22px; }
.c-crystal {
  position: relative; overflow: hidden;
  padding: 15px 16px; border-radius: 16px; margin-bottom: 12px;
  background: var(--c-raised);
  border: 1px solid oklch(1 0 0 / 0.08);
}
.c-crystal-new {
  border-image: linear-gradient(120deg, oklch(0.76 0.17 200), oklch(0.76 0.17 330)) 1;
  animation: c-crystallize 900ms cubic-bezier(0.2,0,0,1) both;
}
@keyframes c-crystallize {
  0% { transform: scale(0.96); opacity: 0; box-shadow: 0 0 0 1px var(--c-crystal), 0 0 60px oklch(0.93 0.06 290 / 0.6); }
  60% { box-shadow: 0 0 0 1px oklch(0.93 0.06 290 / 0.4), 0 0 30px oklch(0.93 0.06 290 / 0.25); }
  100% { transform: none; opacity: 1; box-shadow: 0 0 0 1px transparent; }
}
.c-crystal-kind {
  font-family: var(--font-unbounded), sans-serif;
  font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--c-ink-muted); margin-bottom: 8px;
}
.c-crystal-text {
  font-size: 16px; line-height: 1.36; font-weight: 600; color: var(--c-ink-strong);
  letter-spacing: -0.01em;
}
.c-crystal-sub { font-size: 13px; line-height: 1.5; color: var(--c-ink-muted); margin-top: 8px; }

.c-mini {
  padding: 11px 13px; border-radius: 12px; margin-bottom: 9px;
  background: oklch(0.21 0.035 290 / 0.7);
  border: 1px solid oklch(1 0 0 / 0.05);
}
.c-mini-quiet { background: oklch(0.19 0.03 290 / 0.5); }
.c-mini-forming { border-color: oklch(0.76 0.12 60 / 0.4); border-style: dashed; }
.c-mini-text { font-size: 13.5px; line-height: 1.4; color: var(--c-ink); }
.c-mini-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
.c-tag {
  font-size: 11px; padding: 1px 8px; border-radius: 999px;
  background: oklch(1 0 0 / 0.06); color: var(--c-ink-muted);
}

.c-evidence {
  display: inline-flex; align-items: center; gap: 4px; margin-top: 10px;
  font-family: var(--font-mono); font-size: 11px;
  color: var(--c-crystal);
  background: oklch(0.93 0.06 290 / 0.08);
  border: 1px solid oklch(0.93 0.06 290 / 0.2);
  border-radius: 999px; padding: 2px 10px; cursor: pointer;
  transition: all 160ms;
}
.c-mini-meta .c-evidence, .c-mini .c-evidence { margin-top: 0; }
.c-mini .c-evidence { margin-top: 8px; }
.c-evidence:hover { background: oklch(0.93 0.06 290 / 0.18); box-shadow: 0 0 14px -3px var(--c-crystal); }

/* flow */
.c-flow { width: 100%; height: auto; margin-top: 4px; }
.c-flow-edge { fill: none; stroke: url(#c-grad); stroke-width: 1.5; opacity: 0.5; }
.c-node-box { fill: var(--c-raised); stroke: oklch(1 0 0 / 0.1); stroke-width: 1; }
.c-node-box-accent { fill: oklch(0.24 0.05 290); stroke: url(#c-grad); stroke-width: 1.5; }
.c-node-label { fill: var(--c-ink); font-family: var(--font-sora), sans-serif; font-size: 11px; font-weight: 500; }
.c-node-label-sm { font-size: 9.5px; fill: var(--c-ink-muted); }
.c-node-pulse .c-node-box { animation: c-nodepulse 2400ms ease-out 500ms; }
@keyframes c-nodepulse { 0% { stroke: var(--c-crystal); } 100% { stroke: oklch(1 0 0 / 0.1); } }
`;
