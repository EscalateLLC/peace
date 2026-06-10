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

/* Direction A — Calm Observatory.
 * Near-black indigo depth, one luminous aurora-teal accent, glass panels,
 * calm settle motion. The current zinc/emerald MVP is this direction's
 * unstyled ancestor; this is its intentional form. */

const HUES = [165, 210, 285, 45, 330, 120, 255, 20];

function speakerColor (speakerId: string): string {
  if (speakerId === 'peace') {
    return 'var(--a-bot)';
  }

  return `oklch(0.74 0.105 ${HUES[speakerSlot(speakerId)]})`;
}

export default function CalmObservatory () {
  const { highlighted, highlight, clear, containerRef } = useEvidenceHighlight();

  return (
    <div
      className="a-root"
      onClick={event => {
        if (!(event.target instanceof Element) || !event.target.closest('[data-chip]')) {
          clear();
        }
      }}
    >
      <style>{CSS}</style>

      <header className="a-topbar">
        <Link
          href="/mockups"
          className="a-back"
        >
          ← directions
        </Link>
        <div className="a-title">
          <span className="a-live-dot" />
          {MEETING.title}
        </div>
        <div className="a-now">
          <NowSpeaking />
          <BotState />
        </div>
        <span className="a-meta">{SEGMENTS.length} segments · {MEETING.platform}</span>
      </header>

      <main className="a-panes">
        <section
          className="a-pane a-transcript"
          ref={containerRef}
        >
          <div className="a-pane-label">transcript</div>
          {SEGMENTS.map((seg, i) => (
            <div
              key={seg.id}
              data-seg={seg.id}
              data-on={highlighted.has(seg.id) || undefined}
              className={`a-seg${seg.bot ? ' a-seg-bot' : ''}${seg.interim ? ' a-seg-interim' : ''}`}
              style={{ animationDelay: `${i * 55}ms` }}
            >
              <div className="a-seg-head">
                <span
                  className="a-speaker"
                  style={{ color: speakerColor(seg.speakerId) }}
                >
                  {seg.bot && <span className="a-bot-glyph" />}
                  {seg.speaker}
                </span>
                <span className="a-ts">{offset(seg.t)}</span>
                {seg.confidence !== undefined && seg.confidence < 0.7 && (
                  <span
                    className="a-low"
                    title={`transcription confidence ${Math.round(seg.confidence * 100)}%`}
                  >
                    ~
                  </span>
                )}
              </div>
              <p className="a-text">
                {seg.text}
                {seg.interim && <span className="a-caret" />}
              </p>
            </div>
          ))}
        </section>

        <section className="a-pane a-artifacts">
          <div className="a-tabs">
            <button className="a-tab a-tab-on">Decisions</button>
            <button className="a-tab">Actions</button>
            <button className="a-tab">Questions</button>
            <button className="a-tab">Key points</button>
            <button className="a-tab">Summary</button>
          </div>

          <div className="a-artifact-body">
            {DECISIONS.map(d => (
              <article
                key={d.id}
                className={`a-card${d.provisional ? ' a-card-forming' : ''}`}
              >
                {d.provisional && <span className="a-forming-tag">forming</span>}
                <p className="a-card-title">{d.text}</p>
                {d.rationale && <p className="a-card-sub">{d.rationale}</p>}
                <Evidence
                  ids={d.evidence}
                  onHighlight={highlight}
                />
              </article>
            ))}

            <div className="a-divider">actions</div>
            {ACTIONS.map(a => (
              <article
                key={a.id}
                className={`a-card${a.provisional ? ' a-card-forming' : ''}`}
              >
                {a.provisional && <span className="a-forming-tag">forming</span>}
                <p className="a-card-title a-card-title-sm">{a.text}</p>
                <div className="a-pillrow">
                  {a.assignee && <span className="a-pill">@{a.assignee}</span>}
                  {a.due && <span className="a-pill">due {a.due}</span>}
                  <Evidence
                    ids={a.evidence}
                    onHighlight={highlight}
                  />
                </div>
              </article>
            ))}

            <div className="a-divider">open questions</div>
            {QUESTIONS.map(q => (
              <article
                key={q.id}
                className="a-card a-card-quiet"
              >
                <p className="a-card-title a-card-title-sm">{q.text}</p>
                <Evidence
                  ids={q.evidence}
                  onHighlight={highlight}
                />
              </article>
            ))}

            <div className="a-divider">key points</div>
            {KEY_POINTS.map(k => (
              <article
                key={k.id}
                className="a-card a-card-quiet"
              >
                <p className="a-card-title a-card-title-sm">{k.text}</p>
                <Evidence
                  ids={k.evidence}
                  onHighlight={highlight}
                />
              </article>
            ))}
          </div>
        </section>

        <section className="a-pane a-diagram">
          <div className="a-pane-label">diagram</div>
          <DecisionDiagram />
        </section>
      </main>
    </div>
  );
}

function NowSpeaking () {
  const speaker = SPEAKERS.find(s => s.id === MEETING.speakingId);

  if (!speaker) {
    return null;
  }

  return (
    <span className="a-now-speaking">
      <span
        className="a-now-ring"
        style={{ color: speakerColor(speaker.id) }}
      />
      {speaker.short} speaking
    </span>
  );
}

function BotState () {
  return (
    <span className="a-botstate">
      <span className="a-botstate-glyph" />
      peace · listening
    </span>
  );
}

function Evidence ({ ids, onHighlight }: { ids: string[]; onHighlight: (ids: string[]) => void }) {
  return (
    <button
      data-chip
      type="button"
      className="a-evidence"
      onClick={() => onHighlight(ids)}
      title={`${ids.length} source segment${ids.length === 1 ? '' : 's'}`}
    >
      <span className="a-evidence-mark" />
      {ids.length} cited
    </button>
  );
}

function DecisionDiagram () {
  return (
    <svg
      className="a-graph"
      viewBox="0 0 300 360"
      role="img"
      aria-label="decision flow"
    >
      <defs>
        <linearGradient
          id="a-edge"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="0"
            stopColor="oklch(0.6 0.12 165)"
            stopOpacity="0.55"
          />
          <stop
            offset="1"
            stopColor="oklch(0.6 0.12 165)"
            stopOpacity="0.12"
          />
        </linearGradient>
      </defs>

      <path
        className="a-edge"
        d="M150 64 L150 150"
      />
      <path
        className="a-edge"
        d="M150 184 L88 264"
      />
      <path
        className="a-edge"
        d="M150 184 L212 264"
      />

      <GraphNode
        x={150}
        y={42}
        w={150}
        label="Ship live transcription?"
      />
      <GraphNode
        x={150}
        y={167}
        w={170}
        label="Live transcript + decisions"
        accent
      />
      <GraphNode
        x={88}
        y={290}
        w={96}
        label="Batch: 4 types"
        small
      />
      <GraphNode
        x={212}
        y={290}
        w={96}
        label="Load-test path"
        small
        pulse
      />
    </svg>
  );
}

function GraphNode ({ x, y, w, label, accent, small, pulse }: { x: number; y: number; w: number; label: string; accent?: boolean; small?: boolean; pulse?: boolean }) {
  const h = small ? 38 : 44;

  return (
    <g className={pulse ? 'a-node a-node-pulse' : 'a-node'}>
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={10}
        className={accent ? 'a-node-box a-node-box-accent' : 'a-node-box'}
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        className={small ? 'a-node-label a-node-label-sm' : 'a-node-label'}
      >
        {label}
      </text>
    </g>
  );
}

const CSS = `
.a-root {
  --a-void: oklch(0.13 0.012 264);
  --a-base: oklch(0.165 0.014 264);
  --a-raised: oklch(0.205 0.016 264);
  --a-hair: oklch(1 0 0 / 0.06);
  --a-ink-strong: oklch(0.94 0.01 264);
  --a-ink: oklch(0.78 0.012 264);
  --a-ink-muted: oklch(0.58 0.014 264);
  --a-ink-faint: oklch(0.44 0.014 264);
  --a-accent: oklch(0.82 0.16 165);
  --a-accent-dim: oklch(0.6 0.12 165);
  --a-accent-glow: oklch(0.82 0.16 165 / 0.16);
  --a-forming: oklch(0.78 0.1 85);
  --a-bot: oklch(0.7 0.03 200);

  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  font-family: var(--font-hanken), system-ui, sans-serif;
  color: var(--a-ink);
  background:
    radial-gradient(1200px 800px at 18% -10%, oklch(0.2 0.04 200 / 0.18), transparent 60%),
    radial-gradient(1000px 700px at 100% 110%, oklch(0.18 0.05 280 / 0.22), transparent 55%),
    var(--a-void);
  letter-spacing: 0.01em;
}

.a-topbar {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 0 20px;
  height: 52px;
  border-bottom: 1px solid var(--a-hair);
  background: oklch(0.15 0.014 264 / 0.6);
  backdrop-filter: blur(12px);
  flex-shrink: 0;
}
.a-back {
  font-size: 12px;
  color: var(--a-ink-muted);
  text-decoration: none;
  transition: color 180ms;
}
.a-back:hover { color: var(--a-ink); }
.a-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--a-ink-strong);
}
.a-live-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--a-accent);
  box-shadow: 0 0 0 0 var(--a-accent-glow);
  animation: a-pulse 2.4s ease-in-out infinite;
}
@keyframes a-pulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--a-accent-glow); }
  50% { box-shadow: 0 0 0 6px transparent; }
}
.a-now { display: flex; align-items: center; gap: 16px; margin-left: 8px; }
.a-now-speaking, .a-botstate {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 12px; color: var(--a-ink-muted);
}
.a-now-ring {
  width: 8px; height: 8px; border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 10px 1px currentColor;
  animation: a-breathe 1.6s ease-in-out infinite;
}
@keyframes a-breathe { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
.a-botstate-glyph {
  width: 14px; height: 8px;
  background:
    radial-gradient(circle 2px at 3px 4px, var(--a-bot) 96%, transparent),
    radial-gradient(circle 2px at 11px 4px, var(--a-bot) 96%, transparent);
  opacity: 0.7;
}
.a-meta { margin-left: auto; font-size: 11px; color: var(--a-ink-faint); font-family: var(--font-mono); }

.a-panes {
  display: grid;
  grid-template-columns: 1fr 1.18fr 0.92fr;
  flex: 1;
  min-height: 0;
}
.a-pane { min-height: 0; overflow-y: auto; padding: 16px 14px 40px; }
.a-pane + .a-pane { border-left: 1px solid var(--a-hair); }
.a-pane-label {
  font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--a-ink-faint); margin: 2px 4px 14px;
}

/* transcript */
.a-seg {
  padding: 8px 10px; border-radius: 10px;
  animation: a-rise 360ms cubic-bezier(0.2,0,0,1) both;
  transition: background 200ms;
}
.a-seg[data-on] {
  background: var(--a-accent-glow);
  box-shadow: inset 0 0 0 1px oklch(0.82 0.16 165 / 0.35);
}
.a-seg:not([data-on]):hover { background: oklch(1 0 0 / 0.025); }
@keyframes a-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.a-seg-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 3px; }
.a-speaker { font-size: 12px; font-weight: 650; display: inline-flex; align-items: center; gap: 6px; }
.a-bot-glyph {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--a-bot); box-shadow: 0 0 8px 1px var(--a-bot);
}
.a-ts { font-family: var(--font-mono); font-size: 10px; color: var(--a-ink-faint); }
.a-low { font-size: 11px; color: var(--a-ink-faint); }
.a-text { font-size: 14px; line-height: 1.56; color: var(--a-ink); }
.a-seg-bot .a-text { color: var(--a-ink-muted); font-style: italic; }
.a-seg-interim .a-text { color: var(--a-ink-muted); opacity: 0.72; }
.a-caret {
  display: inline-block; width: 7px; height: 1.05em; margin-left: 2px;
  vertical-align: -2px; background: var(--a-accent); opacity: 0.8;
  animation: a-blink 1.1s steps(2) infinite; border-radius: 1px;
}
@keyframes a-blink { 50% { opacity: 0; } }

/* artifacts */
.a-tabs { display: flex; gap: 2px; margin: 0 0 14px; }
.a-tab {
  font-size: 12px; padding: 5px 11px; border-radius: 8px;
  color: var(--a-ink-muted); background: transparent; border: 0; cursor: pointer;
  transition: color 160ms, background 160ms;
}
.a-tab:hover { color: var(--a-ink); }
.a-tab-on { color: var(--a-ink-strong); background: oklch(1 0 0 / 0.05); }
.a-artifact-body { display: flex; flex-direction: column; gap: 10px; }
.a-divider {
  font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--a-ink-faint); margin: 14px 2px 2px;
}
.a-card {
  position: relative;
  padding: 13px 14px; border-radius: 12px;
  background: var(--a-raised);
  border: 1px solid var(--a-hair);
  box-shadow: 0 1px 0 oklch(1 0 0 / 0.03) inset;
  animation: a-rise 420ms cubic-bezier(0.2,0,0,1) both;
}
.a-card-quiet { background: oklch(0.18 0.014 264 / 0.5); }
.a-card-forming {
  border-color: oklch(0.78 0.1 85 / 0.4);
  animation: a-rise 420ms cubic-bezier(0.2,0,0,1) both, a-settle 1500ms ease-out 200ms;
}
@keyframes a-settle {
  0% { box-shadow: 0 0 0 1px oklch(0.82 0.16 165 / 0.5), 0 0 30px oklch(0.82 0.16 165 / 0.28); }
  100% { box-shadow: 0 0 0 0 transparent, 0 0 0 transparent; }
}
.a-forming-tag {
  position: absolute; top: 11px; right: 12px;
  font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--a-forming);
  padding: 2px 7px; border-radius: 999px;
  border: 1px solid oklch(0.78 0.1 85 / 0.35);
  animation: a-shimmer 2s ease-in-out infinite;
}
@keyframes a-shimmer { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
.a-card-title { font-size: 14px; line-height: 1.45; color: var(--a-ink-strong); font-weight: 550; padding-right: 56px; }
.a-card-title-sm { font-size: 13.5px; font-weight: 450; color: var(--a-ink); padding-right: 0; }
.a-card-sub { margin-top: 6px; font-size: 12.5px; line-height: 1.5; color: var(--a-ink-muted); }
.a-pillrow { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin-top: 9px; }
.a-pill {
  font-size: 11px; padding: 2px 8px; border-radius: 999px;
  background: oklch(1 0 0 / 0.05); color: var(--a-ink-muted);
}
.a-evidence {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 9px;
  font-size: 11px; font-family: var(--font-mono);
  color: var(--a-accent-dim);
  background: transparent; border: 1px solid oklch(0.6 0.12 165 / 0.3);
  border-radius: 999px; padding: 2px 9px 2px 7px; cursor: pointer;
  transition: all 160ms;
}
.a-pillrow .a-evidence { margin-top: 0; }
.a-evidence:hover {
  color: var(--a-accent); border-color: oklch(0.82 0.16 165 / 0.55);
  background: var(--a-accent-glow);
}
.a-evidence-mark { width: 5px; height: 5px; border-radius: 50%; background: currentColor; box-shadow: 0 0 6px currentColor; }

/* diagram */
.a-graph { width: 100%; height: auto; margin-top: 6px; }
.a-edge { fill: none; stroke: url(#a-edge); stroke-width: 1.5; }
.a-node-box { fill: var(--a-raised); stroke: var(--a-hair); stroke-width: 1; }
.a-node-box-accent { fill: oklch(0.22 0.04 165); stroke: oklch(0.82 0.16 165 / 0.45); }
.a-node-label { fill: var(--a-ink); font-family: var(--font-hanken); font-size: 11px; font-weight: 500; }
.a-node-label-sm { font-size: 9.5px; fill: var(--a-ink-muted); }
.a-node-pulse .a-node-box { animation: a-nodepulse 2200ms ease-out 400ms; }
@keyframes a-nodepulse {
  0% { stroke: oklch(0.82 0.16 165 / 0.8); }
  100% { stroke: var(--a-hair); }
}
`;
