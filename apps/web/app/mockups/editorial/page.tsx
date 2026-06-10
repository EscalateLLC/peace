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

/* Direction B — Warm Editorial.
 * A beautifully typeset living document writing itself: paper-warm light
 * surfaces, serif prose, the transcript as an interview and decisions as
 * pull-quotes. Provisional text is italic pencil that *inks* to roman on
 * commit — the typographic state change IS the live grammar. */

const HUES = [28, 200, 150, 300, 95, 255, 340, 60];

function underline (speakerId: string): string {
  return `oklch(0.6 0.13 ${HUES[speakerSlot(speakerId)]})`;
}

export default function WarmEditorial () {
  const { highlighted, highlight, clear, containerRef } = useEvidenceHighlight();

  return (
    <div
      className="b-root"
      onClick={event => {
        if (!(event.target instanceof Element) || !event.target.closest('[data-chip]')) {
          clear();
        }
      }}
    >
      <style>{CSS}</style>

      <header className="b-masthead">
        <Link
          href="/mockups"
          className="b-back"
        >
          ← directions
        </Link>
        <div className="b-mast-center">
          <div className="b-kicker">
            <span className="b-rec" />
            LIVE · RECORDING
          </div>
          <h1 className="b-mast-title">{MEETING.title}</h1>
          <div className="b-dateline">
            {SPEAKERS.map(s => s.short).join(' · ')} &nbsp;—&nbsp; elapsed {MEETING.elapsed}
          </div>
        </div>
        <BotMargin />
      </header>

      <div className="b-rule" />

      <main className="b-spread">
        <article
          className="b-column b-transcript"
          ref={containerRef}
        >
          <div className="b-col-head">The Conversation</div>
          {SEGMENTS.map(seg => (
            <p
              key={seg.id}
              data-seg={seg.id}
              data-on={highlighted.has(seg.id) || undefined}
              className={`b-line${seg.bot ? ' b-line-bot' : ''}${seg.interim ? ' b-line-interim' : ''}`}
            >
              <span
                className="b-speaker"
                style={{ '--ul': underline(seg.speakerId) } as React.CSSProperties}
              >
                {seg.speaker}
              </span>
              <span className="b-utt">
                {seg.text}
                {seg.interim && <span className="b-pencil-caret" />}
              </span>
            </p>
          ))}
        </article>

        <aside className="b-column b-record">
          <div className="b-col-head">The Record</div>

          <section className="b-sec">
            <h2 className="b-sec-h">Decisions</h2>
            {DECISIONS.map(d => (
              <Decision
                key={d.id}
                decision={d}
                onHighlight={highlight}
              />
            ))}
          </section>

          <section className="b-sec">
            <h2 className="b-sec-h">Action items</h2>
            <ul className="b-checklist">
              {ACTIONS.map(a => (
                <li
                  key={a.id}
                  className={`b-check${a.provisional ? ' b-check-forming' : ''}`}
                >
                  <span className="b-box" />
                  <div>
                    <span className="b-check-text">{a.text}</span>
                    <span className="b-check-meta">
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

          <section className="b-sec">
            <h2 className="b-sec-h">Open questions</h2>
            {QUESTIONS.map(q => (
              <p
                key={q.id}
                className="b-margin-note"
              >
                {q.text}
                <Marker
                  ids={q.evidence}
                  onHighlight={highlight}
                />
              </p>
            ))}
          </section>

          <section className="b-sec">
            <h2 className="b-sec-h">In the margins</h2>
            {KEY_POINTS.map(k => (
              <p
                key={k.id}
                className="b-margin-note"
              >
                {k.text}
                <Marker
                  ids={k.evidence}
                  onHighlight={highlight}
                />
              </p>
            ))}
          </section>

          <figure className="b-figure">
            <FlowFigure />
            <figcaption>Fig. 1 — the scope decision, as resolved.</figcaption>
          </figure>
        </aside>
      </main>
    </div>
  );
}

function Decision ({ decision, onHighlight }: { decision: typeof DECISIONS[number]; onHighlight: (ids: string[]) => void }) {
  // The live grammar: a freshly-extracted decision arrives as italic pencil,
  // then "inks" to roman a beat later — confirmation made typographic.
  const [inked, setInked] = useState(!decision.provisional);

  useEffect(() => {
    if (decision.provisional) {
      const timer = setTimeout(() => setInked(true), 1600);

      return () => clearTimeout(timer);
    }
  }, [decision.provisional]);

  return (
    <blockquote className={`b-pull${decision.provisional ? ' b-pull-live' : ''}${inked ? ' b-inked' : ' b-inking'}`}>
      <p className="b-pull-text">{decision.text}</p>
      {decision.rationale && <p className="b-pull-rationale">{decision.rationale}</p>}
      <footer>
        {!inked && <span className="b-setting">setting…</span>}
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
      className="b-marker"
      onClick={() => onHighlight(ids)}
      title={`${ids.length} source segment${ids.length === 1 ? '' : 's'}`}
    >
      {ids.length}
    </button>
  );
}

function BotMargin () {
  return (
    <div className="b-botmargin">
      <span className="b-bot-pencil" />
      <div>
        <div className="b-bot-name">peace</div>
        <div className="b-bot-doing">listening, pencil in hand</div>
      </div>
    </div>
  );
}

function FlowFigure () {
  return (
    <svg
      viewBox="0 0 260 250"
      className="b-fig-svg"
      role="img"
      aria-label="decision flow"
    >
      <line
        className="b-fig-line"
        x1="130"
        y1="46"
        x2="130"
        y2="96"
      />
      <line
        className="b-fig-line"
        x1="130"
        y1="130"
        x2="74"
        y2="186"
      />
      <line
        className="b-fig-line"
        x1="130"
        y1="130"
        x2="186"
        y2="186"
      />
      <FigNode
        x={130}
        y={28}
        label="Ship live?"
      />
      <FigNode
        x={130}
        y={113}
        label="Transcript + decisions live"
        accent
      />
      <FigNode
        x={74}
        y={204}
        label="4 types batch"
        small
      />
      <FigNode
        x={186}
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
        x={x - (small ? 48 : 72)}
        y={y - 15}
        width={small ? 96 : 144}
        height={30}
        rx={3}
        className={accent ? 'b-fig-box b-fig-box-accent' : 'b-fig-box'}
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        className="b-fig-label"
      >
        {label}
      </text>
    </g>
  );
}

const CSS = `
.b-root {
  --b-page: oklch(0.965 0.009 85);
  --b-base: oklch(0.982 0.007 85);
  --b-raised: oklch(1 0 0);
  --b-tint: oklch(0.935 0.013 85);
  --b-ink-strong: oklch(0.24 0.018 60);
  --b-ink: oklch(0.33 0.014 60);
  --b-ink-muted: oklch(0.52 0.011 60);
  --b-ink-faint: oklch(0.68 0.009 60);
  --b-accent: oklch(0.55 0.19 35);
  --b-accent-wash: oklch(0.7 0.16 60 / 0.28);

  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  font-family: var(--font-newsreader), Georgia, serif;
  color: var(--b-ink);
  background:
    radial-gradient(1400px 900px at 80% -20%, oklch(0.99 0.02 70 / 0.7), transparent 55%),
    var(--b-page);
}

.b-masthead {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 16px 28px 12px;
  flex-shrink: 0;
}
.b-back {
  font-family: var(--font-hanken), sans-serif;
  font-size: 12px; letter-spacing: 0.02em;
  color: var(--b-ink-muted); text-decoration: none;
  transition: color 160ms;
}
.b-back:hover { color: var(--b-accent); }
.b-mast-center { text-align: center; }
.b-kicker {
  display: inline-flex; align-items: center; gap: 7px;
  font-family: var(--font-hanken), sans-serif;
  font-size: 10.5px; letter-spacing: 0.22em; font-weight: 600;
  color: var(--b-accent);
}
.b-rec {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--b-accent);
  box-shadow: 0 0 0 0 oklch(0.55 0.19 35 / 0.4);
  animation: b-rec 2s ease-in-out infinite;
}
@keyframes b-rec { 0%,100% { box-shadow: 0 0 0 0 oklch(0.55 0.19 35 / 0.4); } 50% { box-shadow: 0 0 0 5px transparent; } }
.b-mast-title {
  font-size: 30px; font-weight: 500; line-height: 1.1; margin: 4px 0 2px;
  color: var(--b-ink-strong); letter-spacing: -0.01em;
}
.b-dateline {
  font-family: var(--font-hanken), sans-serif;
  font-size: 11.5px; color: var(--b-ink-muted); letter-spacing: 0.02em;
}
.b-botmargin {
  justify-self: end;
  display: inline-flex; align-items: center; gap: 9px;
  font-family: var(--font-hanken), sans-serif;
}
.b-bot-pencil {
  width: 3px; height: 26px; border-radius: 2px;
  background: linear-gradient(var(--b-ink-faint), var(--b-ink-muted));
  transform: rotate(24deg);
  position: relative;
}
.b-bot-pencil::after {
  content: ''; position: absolute; bottom: -4px; left: -1px;
  border-left: 2.5px solid transparent; border-right: 2.5px solid transparent;
  border-top: 5px solid var(--b-accent);
}
.b-bot-name { font-weight: 600; font-size: 12.5px; color: var(--b-ink-strong); }
.b-bot-doing { font-size: 11px; color: var(--b-ink-muted); font-style: italic; }

.b-rule {
  height: 2px; margin: 0 28px;
  background: var(--b-ink-strong);
  flex-shrink: 0;
}

.b-spread {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 0;
  flex: 1; min-height: 0;
}
.b-column { min-height: 0; overflow-y: auto; padding: 22px 0 60px; }
.b-transcript { padding-right: 38px; padding-left: 28px; }
.b-record {
  padding-left: 30px; padding-right: 28px;
  border-left: 1px solid var(--b-ink-faint);
  background: linear-gradient(var(--b-base), transparent 30%);
}
.b-col-head {
  font-family: var(--font-hanken), sans-serif;
  font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--b-ink-muted); margin-bottom: 18px;
}

/* transcript — the interview */
.b-line {
  font-size: 17px; line-height: 1.62; margin-bottom: 15px;
  color: var(--b-ink);
  transition: background 200ms;
  border-radius: 2px;
  padding: 1px 4px;
  margin-left: -4px;
}
.b-line[data-on] {
  background: linear-gradient(var(--b-accent-wash), var(--b-accent-wash));
  box-shadow: -4px 0 0 var(--b-accent);
}
.b-speaker {
  font-family: var(--font-hanken), sans-serif;
  font-variant: small-caps; text-transform: lowercase;
  font-size: 13px; font-weight: 600; letter-spacing: 0.04em;
  color: var(--b-ink-strong);
  margin-right: 9px;
  padding-bottom: 1px;
  border-bottom: 2px solid var(--ul);
  white-space: nowrap;
}
.b-utt { }
.b-line-bot { color: var(--b-ink-muted); }
.b-line-bot .b-speaker { color: var(--b-accent); border-bottom-color: var(--b-accent); }
.b-line-bot .b-utt { font-style: italic; }
.b-line-interim .b-utt { color: var(--b-ink-faint); font-style: italic; }
.b-pencil-caret {
  display: inline-block; width: 14px; height: 1px;
  background: var(--b-ink-faint); margin-left: 4px; vertical-align: middle;
  animation: b-write 1.2s ease-in-out infinite;
}
@keyframes b-write { 0%,100% { width: 6px; opacity: 0.4; } 50% { width: 16px; opacity: 0.9; } }

/* record */
.b-sec { margin-bottom: 26px; }
.b-sec-h {
  font-family: var(--font-hanken), sans-serif;
  font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--b-accent); font-weight: 600;
  margin-bottom: 12px;
  padding-bottom: 5px; border-bottom: 1px solid var(--b-tint);
}

/* decisions as pull-quotes */
.b-pull {
  border-left: 2px solid var(--b-accent);
  padding: 2px 0 6px 16px;
  margin: 0 0 16px;
}
.b-pull-text {
  font-size: 19px; line-height: 1.4; font-weight: 500;
  color: var(--b-ink-strong); letter-spacing: -0.005em;
  transition: color 700ms ease;
}
.b-pull-rationale {
  font-size: 14px; line-height: 1.5; margin-top: 7px;
  color: var(--b-ink-muted);
}
.b-pull footer {
  display: flex; align-items: center; gap: 9px; margin-top: 9px;
  font-family: var(--font-hanken), sans-serif;
}
.b-inking .b-pull-text { font-style: italic; color: var(--b-ink-faint); }
.b-inked .b-pull-text { font-style: normal; }
.b-pull-live.b-inked .b-pull-text {
  animation: b-highlighter 1100ms ease-out;
}
@keyframes b-highlighter {
  0% { background: linear-gradient(var(--b-accent-wash), var(--b-accent-wash)); background-size: 100% 100%; }
  100% { background: linear-gradient(var(--b-accent-wash), var(--b-accent-wash)); background-size: 0% 100%; background-repeat: no-repeat; }
}
.b-setting {
  font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--b-ink-faint); font-style: italic;
}

/* checklist */
.b-checklist { list-style: none; display: flex; flex-direction: column; gap: 11px; }
.b-check { display: flex; gap: 10px; }
.b-box {
  flex-shrink: 0; width: 14px; height: 14px; margin-top: 4px;
  border: 1.5px solid var(--b-ink-faint); border-radius: 3px;
}
.b-check-forming .b-box { border-style: dashed; border-color: var(--b-accent); }
.b-check-text {
  font-family: var(--font-hanken), sans-serif;
  font-size: 13.5px; line-height: 1.4; color: var(--b-ink-strong); display: block;
}
.b-check-forming .b-check-text { font-style: italic; color: var(--b-ink-muted); }
.b-check-meta {
  font-family: var(--font-hanken), sans-serif;
  font-size: 11.5px; color: var(--b-ink-muted); display: inline-flex; align-items: center; gap: 4px; margin-top: 3px;
}
.b-check-meta em { font-style: normal; font-weight: 600; color: var(--b-ink); }

/* margin notes */
.b-margin-note {
  font-size: 15px; line-height: 1.5; color: var(--b-ink);
  margin-bottom: 11px; font-style: italic;
}

/* evidence superscript marker */
.b-marker {
  vertical-align: super;
  font-family: var(--font-hanken), sans-serif;
  font-size: 9.5px; font-style: normal; font-weight: 600;
  color: var(--b-accent);
  background: oklch(0.55 0.19 35 / 0.1);
  border: 0; border-radius: 4px;
  padding: 1px 5px; margin-left: 5px; cursor: pointer;
  transition: all 160ms;
  line-height: 1;
}
.b-marker:hover { background: var(--b-accent); color: var(--b-raised); }

/* figure */
.b-figure { margin: 8px 0 0; }
.b-fig-svg { width: 100%; height: auto; background: var(--b-raised); border: 1px solid var(--b-tint); border-radius: 4px; padding: 10px; }
.b-fig-line { stroke: var(--b-ink-faint); stroke-width: 1; }
.b-fig-box { fill: var(--b-base); stroke: var(--b-ink-muted); stroke-width: 1; }
.b-fig-box-accent { fill: oklch(0.55 0.19 35 / 0.08); stroke: var(--b-accent); }
.b-fig-label { font-family: var(--font-hanken), sans-serif; font-size: 9.5px; fill: var(--b-ink-strong); }
.b-figure figcaption {
  font-family: var(--font-hanken), sans-serif;
  font-size: 11px; font-style: italic; color: var(--b-ink-muted);
  margin-top: 8px; text-align: center;
}
`;
