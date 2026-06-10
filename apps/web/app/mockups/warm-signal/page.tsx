'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useEvidenceHighlight } from '../_shared';
import {
  ACTIONS,
  DECISIONS,
  KEY_POINTS,
  MEETING,
  QUESTIONS,
  SEGMENTS,
  SPEAKERS,
  speakerSlot
} from '../_data';

/* Direction D — Warm Signal (hybrid: warm editorial × expressive signal).
 * A living manuscript read by lamplight. Warm-dark paper, Fraunces serif prose,
 * the meeting typesetting itself — but alive: each voice owns a warm jewel hue
 * (rail + name), the speaker ribbon shows who holds the floor, and a forming
 * decision *inks* from italic to roman while an ember settle-glow cools around
 * it. Editorial trust + signal energy, warm throughout. */

const HUES = [68, 28, 158, 205, 338, 98, 262, 12];

function jewel (speakerId: string): string {
  return `oklch(0.74 0.13 ${HUES[speakerSlot(speakerId)]})`;
}

function speakerColor (speakerId: string): string {
  return speakerId === 'peace' ? 'oklch(0.66 0.04 70)' : jewel(speakerId);
}

export default function WarmSignal () {
  const { highlighted, highlight, clear, containerRef } = useEvidenceHighlight();

  return (
    <div
      className="d-root"
      onClick={event => {
        if (!(event.target instanceof Element) || !event.target.closest('[data-chip]')) {
          clear();
        }
      }}
    >
      <style>{CSS}</style>

      <header className="d-mast">
        <Link
          href="/mockups"
          className="d-back"
        >
          ← directions
        </Link>
        <div className="d-mast-center">
          <div className="d-kicker">
            <span className="d-ember" />
            LIVE TRANSCRIPT
          </div>
          <h1 className="d-mast-title">{MEETING.title}</h1>
        </div>
        <div className="d-now">
          <NowSpeaking />
          <div className="d-botline">
            <span className="d-bot-quill" />
            peace · listening
          </div>
        </div>
      </header>

      <div className="d-hr" />

      <main className="d-spread">
        <article
          className="d-column d-transcript"
          ref={containerRef}
        >
          <div className="d-col-head">The Conversation</div>
          {SEGMENTS.map(seg => (
            <div
              key={seg.id}
              data-seg={seg.id}
              data-on={highlighted.has(seg.id) || undefined}
              className={`d-line${seg.bot ? ' d-line-bot' : ''}${seg.interim ? ' d-line-interim' : ''}`}
              style={{ '--hue': speakerColor(seg.speakerId) } as React.CSSProperties}
            >
              <span className="d-rail" />
              <div className="d-line-body">
                <span className="d-speaker">{seg.speaker}</span>
                <span className="d-utt">
                  {seg.text}
                  {seg.interim && <span className="d-quill-caret" />}
                </span>
              </div>
            </div>
          ))}
        </article>

        <aside className="d-column d-record">
          <div className="d-col-head">The Record</div>

          <section className="d-sec">
            <h2 className="d-sec-h">Decisions</h2>
            {DECISIONS.map(d => (
              <Decision
                key={d.id}
                decision={d}
                onHighlight={highlight}
              />
            ))}
          </section>

          <section className="d-sec">
            <h2 className="d-sec-h">Action items</h2>
            <ul className="d-checklist">
              {ACTIONS.map(a => (
                <li
                  key={a.id}
                  className={`d-check${a.provisional ? ' d-check-forming' : ''}`}
                >
                  <span className="d-box" />
                  <div className="d-check-body">
                    <span className="d-check-text">{a.text}</span>
                    <span className="d-check-meta">
                      {a.assignee && <em>{a.assignee}</em>}
                      {a.due && <> · due {a.due}</>}
                      <Marker
                        ids={a.evidence}
                        onHighlight={highlight}
                      />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div className="d-two">
            <section className="d-sec">
              <h2 className="d-sec-h">Questions</h2>
              {QUESTIONS.map(q => (
                <p
                  key={q.id}
                  className="d-note"
                >
                  {q.text}
                  <Marker
                    ids={q.evidence}
                    onHighlight={highlight}
                  />
                </p>
              ))}
            </section>
            <section className="d-sec">
              <h2 className="d-sec-h">In the margins</h2>
              {KEY_POINTS.map(k => (
                <p
                  key={k.id}
                  className="d-note"
                >
                  {k.text}
                  <Marker
                    ids={k.evidence}
                    onHighlight={highlight}
                  />
                </p>
              ))}
            </section>
          </div>

          <figure className="d-figure">
            <FlowFigure />
            <figcaption>Fig. 1 — the scope decision, as resolved.</figcaption>
          </figure>
        </aside>
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
    <div
      className="d-speaking"
      style={{ '--hue': speakerColor(speaker.id) } as React.CSSProperties}
    >
      <span className="d-ribbon">
        {[0, 1, 2, 3, 4].map(i => (
          <span
            key={i}
            className="d-ribbon-bar"
            style={{ animationDelay: `${i * 90}ms` }}
          />
        ))}
      </span>
      {speaker.short} speaking
    </div>
  );
}

function Decision ({ decision, onHighlight }: { decision: typeof DECISIONS[number]; onHighlight: (ids: string[]) => void }) {
  const [inked, setInked] = useState(!decision.provisional);

  useEffect(() => {
    if (decision.provisional) {
      const timer = setTimeout(() => setInked(true), 1700);

      return () => clearTimeout(timer);
    }
  }, [decision.provisional]);

  return (
    <blockquote className={`d-pull${decision.provisional ? ' d-pull-live' : ''}${inked ? ' d-inked' : ' d-inking'}`}>
      <p className="d-pull-text">{decision.text}</p>
      {decision.rationale && <p className="d-pull-rationale">{decision.rationale}</p>}
      <footer>
        {!inked && <span className="d-setting">inking…</span>}
        <Marker
          ids={decision.evidence}
          onHighlight={onHighlight}
        />
      </footer>
    </blockquote>
  );
}

function Marker ({ ids, onHighlight }: { ids: string[]; onHighlight: (ids: string[]) => void }) {
  return (
    <button
      data-chip
      type="button"
      className="d-marker"
      onClick={() => onHighlight(ids)}
      title={`${ids.length} source segment${ids.length === 1 ? '' : 's'}`}
    >
      {ids.length}
    </button>
  );
}

function FlowFigure () {
  return (
    <svg
      viewBox="0 0 280 250"
      className="d-fig-svg"
      role="img"
      aria-label="decision flow"
    >
      <line
        className="d-fig-line"
        x1="140"
        y1="46"
        x2="140"
        y2="96"
      />
      <line
        className="d-fig-line"
        x1="140"
        y1="130"
        x2="80"
        y2="186"
      />
      <line
        className="d-fig-line"
        x1="140"
        y1="130"
        x2="200"
        y2="186"
      />
      <FigNode
        x={140}
        y={28}
        label="Ship live?"
      />
      <FigNode
        x={140}
        y={113}
        label="Transcript + decisions live"
        accent
      />
      <FigNode
        x={80}
        y={204}
        label="4 types batch"
        small
      />
      <FigNode
        x={200}
        y={204}
        label="Load-test"
        small
      />
    </svg>
  );
}

function FigNode ({ x, y, label, accent, small }: { x: number; y: number; label: string; accent?: boolean; small?: boolean }) {
  return (
    <g>
      <rect
        x={x - (small ? 50 : 78)}
        y={y - 15}
        width={small ? 100 : 156}
        height={30}
        rx={4}
        className={accent ? 'd-fig-box d-fig-box-accent' : 'd-fig-box'}
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        className="d-fig-label"
      >
        {label}
      </text>
    </g>
  );
}

const CSS = `
.d-root {
  --d-field: oklch(0.165 0.011 64);
  --d-base: oklch(0.195 0.013 60);
  --d-raised: oklch(0.23 0.015 56);
  --d-hair: oklch(0.85 0.04 70 / 0.1);
  --d-ink-strong: oklch(0.94 0.014 78);
  --d-ink: oklch(0.82 0.016 72);
  --d-ink-muted: oklch(0.62 0.018 66);
  --d-ink-faint: oklch(0.47 0.018 62);
  --d-accent: oklch(0.79 0.14 72);
  --d-ember: oklch(0.66 0.16 48);
  --d-ember-glow: oklch(0.74 0.15 58 / 0.22);

  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  font-family: var(--font-fraunces), Georgia, serif;
  color: var(--d-ink);
  background:
    radial-gradient(1100px 700px at 78% -12%, oklch(0.26 0.05 64 / 0.5), transparent 56%),
    radial-gradient(900px 600px at 6% 110%, oklch(0.2 0.04 40 / 0.5), transparent 52%),
    var(--d-field);
}

.d-mast {
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
  padding: 15px 28px 11px; flex-shrink: 0;
}
.d-back {
  font-family: var(--font-hanken), sans-serif;
  font-size: 12px; color: var(--d-ink-muted); text-decoration: none; transition: color 160ms;
}
.d-back:hover { color: var(--d-accent); }
.d-mast-center { text-align: center; }
.d-kicker {
  display: inline-flex; align-items: center; gap: 7px;
  font-family: var(--font-hanken), sans-serif;
  font-size: 10px; letter-spacing: 0.24em; font-weight: 600; color: var(--d-accent);
}
.d-ember {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--d-ember);
  box-shadow: 0 0 10px 1px var(--d-ember);
  animation: d-ember 2.6s ease-in-out infinite;
}
@keyframes d-ember { 0%,100% { opacity: 0.65; box-shadow: 0 0 8px 0 var(--d-ember); } 50% { opacity: 1; box-shadow: 0 0 14px 2px var(--d-ember); } }
.d-mast-title {
  font-size: 32px; font-weight: 500; line-height: 1.06; margin: 5px 0 0;
  color: var(--d-ink-strong); letter-spacing: -0.015em;
  font-optical-sizing: auto;
}
.d-now { justify-self: end; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.d-speaking {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--font-hanken), sans-serif; font-size: 12px; font-weight: 500;
  color: var(--hue);
}
.d-ribbon { display: inline-flex; align-items: center; gap: 2px; height: 14px; }
.d-ribbon-bar { width: 2px; height: 4px; border-radius: 2px; background: currentColor; animation: d-wave 720ms ease-in-out infinite; }
@keyframes d-wave { 0%,100% { height: 3px; } 50% { height: 13px; } }
.d-botline {
  display: inline-flex; align-items: center; gap: 7px;
  font-family: var(--font-hanken), sans-serif; font-size: 11px; color: var(--d-ink-muted);
}
.d-bot-quill {
  width: 2.5px; height: 16px; border-radius: 2px; transform: rotate(22deg);
  background: linear-gradient(var(--d-ink-faint), var(--d-accent));
}

.d-hr { height: 1px; margin: 0 28px; background: linear-gradient(90deg, transparent, var(--d-accent), transparent); opacity: 0.4; flex-shrink: 0; }

.d-spread { display: grid; grid-template-columns: 1.35fr 1fr; flex: 1; min-height: 0; }
.d-column { min-height: 0; overflow-y: auto; padding: 22px 0 60px; }
.d-transcript { padding-left: 28px; padding-right: 36px; }
.d-record { padding-left: 30px; padding-right: 28px; border-left: 1px solid var(--d-hair); }
.d-col-head {
  font-family: var(--font-hanken), sans-serif;
  font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--d-ink-muted);
  margin-bottom: 18px;
}

/* transcript */
.d-line {
  display: flex; gap: 13px; padding: 4px 6px 4px 0; margin-bottom: 13px;
  border-radius: 4px; transition: background 200ms;
  animation: d-rise 360ms cubic-bezier(0.2,0,0,1) both;
}
@keyframes d-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.d-line[data-on] { background: color-mix(in oklch, var(--hue) 14%, transparent); }
.d-line:not([data-on]):hover { background: oklch(1 0 0 / 0.02); }
.d-rail {
  flex-shrink: 0; width: 2.5px; border-radius: 3px; align-self: stretch;
  background: var(--hue); opacity: 0.85;
  box-shadow: 0 0 9px -2px var(--hue);
}
.d-line-bot .d-rail { box-shadow: none; opacity: 0.5; }
.d-line-body { font-size: 17px; line-height: 1.6; }
.d-speaker {
  font-family: var(--font-fraunces), serif;
  font-variant: small-caps; text-transform: lowercase;
  font-size: 14px; font-weight: 600; letter-spacing: 0.03em;
  color: var(--hue); margin-right: 9px;
}
.d-line-bot .d-utt { font-style: italic; color: var(--d-ink-muted); }
.d-line-interim .d-utt { font-style: italic; color: var(--d-ink-faint); }
.d-quill-caret {
  display: inline-block; width: 12px; height: 1.5px; margin-left: 4px; vertical-align: middle;
  background: var(--d-accent); border-radius: 1px;
  animation: d-write 1.2s ease-in-out infinite;
}
@keyframes d-write { 0%,100% { width: 5px; opacity: 0.4; } 50% { width: 14px; opacity: 0.95; } }

/* record */
.d-sec { margin-bottom: 24px; }
.d-two { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.d-sec-h {
  font-family: var(--font-hanken), sans-serif;
  font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--d-accent); font-weight: 600; margin-bottom: 11px;
  padding-bottom: 5px; border-bottom: 1px solid var(--d-hair);
}

/* decisions — inking pull-quotes with ember settle */
.d-pull { border-left: 2px solid var(--d-accent); padding: 1px 0 5px 15px; margin: 0 0 15px; border-radius: 2px; }
.d-pull-text {
  font-size: 19px; line-height: 1.38; font-weight: 500; color: var(--d-ink-strong);
  letter-spacing: -0.01em; transition: color 800ms ease;
}
.d-pull-rationale { font-size: 14px; line-height: 1.5; margin-top: 7px; color: var(--d-ink-muted); font-style: italic; }
.d-pull footer { display: flex; align-items: center; gap: 9px; margin-top: 9px; font-family: var(--font-hanken), sans-serif; }
.d-inking .d-pull-text { font-style: italic; color: var(--d-ink-faint); }
.d-inked .d-pull-text { font-style: normal; }
.d-pull-live.d-inked {
  animation: d-settle 1600ms ease-out;
}
@keyframes d-settle {
  0% { box-shadow: -2px 0 0 var(--d-accent), 0 0 34px var(--d-ember-glow); background: linear-gradient(90deg, var(--d-ember-glow), transparent 70%); }
  100% { box-shadow: -2px 0 0 transparent, 0 0 0 transparent; background: transparent; }
}
.d-setting {
  font-family: var(--font-hanken), sans-serif;
  font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--d-ember); font-weight: 600;
  animation: d-flicker 1.6s ease-in-out infinite;
}
@keyframes d-flicker { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }

/* checklist */
.d-checklist { list-style: none; display: flex; flex-direction: column; gap: 11px; }
.d-check { display: flex; gap: 10px; }
.d-box { flex-shrink: 0; width: 14px; height: 14px; margin-top: 4px; border: 1.5px solid var(--d-ink-faint); border-radius: 3px; }
.d-check-forming .d-box { border-style: dashed; border-color: var(--d-accent); }
.d-check-body { font-family: var(--font-hanken), sans-serif; }
.d-check-text { font-size: 13.5px; line-height: 1.4; color: var(--d-ink-strong); display: block; }
.d-check-forming .d-check-text { font-style: italic; color: var(--d-ink-muted); }
.d-check-meta { font-size: 11.5px; color: var(--d-ink-muted); display: inline-flex; align-items: center; gap: 4px; margin-top: 3px; }
.d-check-meta em { font-style: normal; font-weight: 600; color: var(--d-ink); }

/* notes */
.d-note { font-size: 15px; line-height: 1.5; color: var(--d-ink); margin-bottom: 10px; font-style: italic; }

/* evidence marker */
.d-marker {
  vertical-align: super; font-family: var(--font-hanken), sans-serif;
  font-size: 9.5px; font-weight: 600; color: var(--d-accent);
  background: oklch(0.79 0.14 72 / 0.12); border: 0; border-radius: 4px;
  padding: 1px 5px; margin-left: 5px; cursor: pointer; line-height: 1; transition: all 160ms;
}
.d-marker:hover { background: var(--d-accent); color: var(--d-field); }

/* figure */
.d-figure { margin-top: 6px; }
.d-fig-svg { width: 100%; height: auto; background: oklch(0.21 0.014 58 / 0.6); border: 1px solid var(--d-hair); border-radius: 5px; padding: 10px; }
.d-fig-line { stroke: var(--d-ink-faint); stroke-width: 1; }
.d-fig-box { fill: var(--d-base); stroke: var(--d-ink-muted); stroke-width: 1; }
.d-fig-box-accent { fill: oklch(0.79 0.14 72 / 0.1); stroke: var(--d-accent); }
.d-fig-label { font-family: var(--font-hanken), sans-serif; font-size: 9.5px; fill: var(--d-ink-strong); }
.d-figure figcaption {
  font-family: var(--font-fraunces), serif; font-style: italic;
  font-size: 12px; color: var(--d-ink-muted); margin-top: 8px; text-align: center;
}
`;
