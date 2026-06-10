'use client';

import Link from 'next/link';
import { useState } from 'react';
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

/* RETHINK — Approach 2: "Brief".
 * Not a transcript. The screen leads with OUTCOMES — what we decided, what
 * you're on the hook for, what's still open — assembling live. A single "now"
 * line carries liveness (current thread + a one-line ticker of who's talking).
 * The transcript is hidden; clicking any outcome's evidence summons a drawer
 * with just the cited lines (expandable to the full record). Reading-light,
 * recall-first. Intent: "just tell me what matters — I'll check receipts on
 * demand." */

const HUES = [68, 30, 158, 205, 338, 98, 262, 12];

function speakerColor (speakerId: string): string {
  return speakerId === 'peace' ? 'oklch(0.66 0.04 70)' : `oklch(0.74 0.13 ${HUES[speakerSlot(speakerId)] ?? 68})`;
}

interface Evidence {
  title: string;
  ids: string[];
}

export default function Brief () {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [showAll, setShowAll] = useState(false);

  const open = (title: string, ids: string[]) => {
    setShowAll(false);
    setEvidence({
      title,
      ids
    });
  };

  const speaker = SPEAKERS.find(s => s.id === MEETING.speakingId);
  const ticker = SEGMENTS.find(s => s.interim);

  let shown: typeof SEGMENTS = [];

  if (evidence) {
    shown = showAll ? SEGMENTS : SEGMENTS.filter(s => evidence.ids.includes(s.id));
  }

  return (
    <div className="br-root">
      <style>{CSS}</style>

      <header className="br-now">
        <Link
          href="/mockups"
          className="br-back"
        >
          ← directions
        </Link>
        <div className="br-now-thread">
          <span className="br-now-eyebrow">now discussing</span>
          <span className="br-now-topic">Scoping the beta&apos;s live surface</span>
        </div>
        <div className="br-now-right">
          {speaker && (
            <span
              className="br-speaking"
              style={{ '--hue': speakerColor(speaker.id) } as React.CSSProperties}
            >
              <span className="br-ribbon">
                {[0, 1, 2, 3, 4].map(i => (
                  <span
                    key={i}
                    style={{ animationDelay: `${i * 90}ms` }}
                  />
                ))}
              </span>
              {speaker.short}
            </span>
          )}
          <span className="br-peace">peace · listening</span>
        </div>
      </header>

      {ticker && (
        <div className="br-ticker">
          <span className="br-ticker-tag">live</span>
          <span className="br-ticker-name">{ticker.speaker}</span>
          <span className="br-ticker-text">{ticker.text}…</span>
        </div>
      )}

      <main className="br-stage">
        <div className="br-gist">
          <span className="br-gist-label">the gist</span>
          Beta ships a live transcript and live decisions; everything else generates in batch on stop.
        </div>

        <section className="br-block">
          <h2 className="br-h">
            Decisions <span className="br-count">{DECISIONS.length}</span>
          </h2>
          <div className="br-decisions">
            {DECISIONS.map(d => (
              <article
                key={d.id}
                className={`br-decision${d.provisional ? ' br-decision-new' : ''}`}
              >
                {d.provisional && <span className="br-fresh">just decided</span>}
                <p className="br-decision-text">{d.text}</p>
                {d.rationale && <p className="br-decision-why">{d.rationale}</p>}
                <button
                  type="button"
                  className="br-evidence"
                  onClick={() => open('Decision', d.evidence)}
                >
                  <span className="br-evidence-mark" />
                  {d.evidence.length} sources
                </button>
              </article>
            ))}
          </div>
        </section>

        <div className="br-cols">
          <section className="br-block">
            <h2 className="br-h">
              On the hook <span className="br-count">{ACTIONS.length}</span>
            </h2>
            <ul className="br-actions">
              {ACTIONS.map(a => (
                <li
                  key={a.id}
                  className={`br-action${a.provisional ? ' br-action-new' : ''}`}
                >
                  <span className="br-check" />
                  <div className="br-action-body">
                    <span className="br-action-text">{a.text}</span>
                    <div className="br-action-meta">
                      {a.assignee && <span className="br-owner">{a.assignee}</span>}
                      {a.due && <span className="br-due">due {a.due}</span>}
                      <button
                        type="button"
                        className="br-evidence br-evidence-sm"
                        onClick={() => open('Action item', a.evidence)}
                      >
                        {a.evidence.length} sources
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="br-block">
            <h2 className="br-h br-h-quiet">
              Still open <span className="br-count">{QUESTIONS.length}</span>
            </h2>
            <ul className="br-open">
              {QUESTIONS.map(q => (
                <li
                  key={q.id}
                  className="br-q"
                >
                  <span className="br-q-mark">?</span>
                  <span className="br-q-text">{q.text}</span>
                  <button
                    type="button"
                    className="br-evidence br-evidence-sm"
                    onClick={() => open('Open question', q.evidence)}
                  >
                    {q.evidence.length}
                  </button>
                </li>
              ))}
            </ul>

            <h2 className="br-h br-h-quiet br-h-spaced">Worth remembering</h2>
            <ul className="br-points">
              {KEY_POINTS.map(k => (
                <li
                  key={k.id}
                  className="br-point"
                >
                  <span className="br-point-text">{k.text}</span>
                  <button
                    type="button"
                    className="br-evidence br-evidence-sm"
                    onClick={() => open('Key point', k.evidence)}
                  >
                    {k.evidence.length}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      {/* evidence drawer — the only place the transcript appears */}
      <div
        className={`br-drawer-scrim${evidence ? ' br-open' : ''}`}
        onClick={() => setEvidence(null)}
      />
      <aside className={`br-drawer${evidence ? ' br-open' : ''}`}>
        {evidence && (
          <>
            <header className="br-drawer-head">
              <div>
                <div className="br-drawer-eyebrow">evidence · {evidence.title}</div>
                <div className="br-drawer-title">
                  {showAll ? 'Full transcript' : `${evidence.ids.length} cited segment${evidence.ids.length === 1 ? '' : 's'}`}
                </div>
              </div>
              <button
                type="button"
                className="br-drawer-close"
                onClick={() => setEvidence(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </header>
            <div className="br-drawer-body">
              {shown.map(seg => {
                const cited = evidence.ids.includes(seg.id);

                return (
                  <div
                    key={seg.id}
                    className={`br-seg${cited ? ' br-seg-cited' : ''}`}
                  >
                    <div className="br-seg-head">
                      <span
                        className="br-seg-name"
                        style={{ color: speakerColor(seg.speakerId) }}
                      >
                        {seg.speaker}
                      </span>
                      <span className="br-seg-time">{offset(seg.t)}</span>
                    </div>
                    <p className="br-seg-text">{seg.text}{seg.interim && '…'}</p>
                  </div>
                );
              })}
            </div>
            <footer className="br-drawer-foot">
              <button
                type="button"
                className="br-drawer-toggle"
                onClick={() => setShowAll(v => !v)}
              >
                {showAll ? '← back to cited only' : 'show full transcript →'}
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

const CSS = `
.br-root {
  --br-field: oklch(0.17 0.011 64);
  --br-base: oklch(0.205 0.013 60);
  --br-raised: oklch(0.245 0.015 56);
  --br-hair: oklch(0.85 0.04 70 / 0.1);
  --br-ink-strong: oklch(0.95 0.014 78);
  --br-ink: oklch(0.83 0.016 72);
  --br-ink-muted: oklch(0.62 0.018 66);
  --br-ink-faint: oklch(0.47 0.018 62);
  --br-accent: oklch(0.79 0.14 72);
  --br-ember: oklch(0.66 0.16 48);
  --br-green: oklch(0.72 0.11 152);

  position: absolute; inset: 0; display: flex; flex-direction: column;
  font-family: var(--font-hanken), system-ui, sans-serif;
  color: var(--br-ink);
  background:
    radial-gradient(1100px 700px at 82% -14%, oklch(0.26 0.05 64 / 0.45), transparent 56%),
    var(--br-field);
}

/* now bar */
.br-now {
  display: flex; align-items: center; gap: 22px;
  padding: 0 28px; height: 60px; flex-shrink: 0;
  border-bottom: 1px solid var(--br-hair);
}
.br-back { font-size: 12px; color: var(--br-ink-muted); text-decoration: none; transition: color 160ms; }
.br-back:hover { color: var(--br-accent); }
.br-now-thread { display: flex; flex-direction: column; gap: 1px; }
.br-now-eyebrow { font-size: 9.5px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--br-ink-faint); }
.br-now-topic { font-family: var(--font-fraunces), serif; font-size: 17px; font-weight: 500; color: var(--br-ink-strong); }
.br-now-right { margin-left: auto; display: flex; align-items: center; gap: 18px; }
.br-speaking { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 500; color: var(--hue); }
.br-ribbon { display: inline-flex; align-items: center; gap: 2px; height: 14px; }
.br-ribbon span { width: 2px; height: 4px; border-radius: 2px; background: currentColor; animation: br-wave 720ms ease-in-out infinite; }
@keyframes br-wave { 0%,100% { height: 3px; } 50% { height: 13px; } }
.br-peace { font-size: 12px; color: var(--br-ink-muted); }

/* live ticker — the only running transcript presence */
.br-ticker {
  display: flex; align-items: center; gap: 12px; flex-shrink: 0;
  padding: 9px 28px; background: oklch(0.2 0.013 60 / 0.6);
  border-bottom: 1px solid var(--br-hair);
  font-size: 13px; overflow: hidden; white-space: nowrap;
}
.br-ticker-tag {
  font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700;
  color: var(--br-ember); border: 1px solid oklch(0.66 0.16 48 / 0.4); border-radius: 4px; padding: 2px 6px; flex-shrink: 0;
}
.br-ticker-name { font-weight: 600; color: var(--br-ink); flex-shrink: 0; }
.br-ticker-text { color: var(--br-ink-muted); font-style: italic; overflow: hidden; text-overflow: ellipsis; }

/* stage */
.br-stage { flex: 1; min-height: 0; overflow-y: auto; padding: 30px 40px 80px; max-width: 1080px; width: 100%; margin: 0 auto; }
.br-gist {
  font-family: var(--font-fraunces), serif;
  font-size: 21px; line-height: 1.45; font-weight: 400; color: var(--br-ink-strong);
  padding: 4px 0 26px; margin-bottom: 26px; border-bottom: 1px solid var(--br-hair);
  letter-spacing: -0.01em;
}
.br-gist-label {
  display: block; font-family: var(--font-hanken), sans-serif;
  font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--br-accent);
  font-weight: 600; margin-bottom: 10px;
}

.br-block { margin-bottom: 30px; }
.br-h {
  display: flex; align-items: center; gap: 10px;
  font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700;
  color: var(--br-ink); margin-bottom: 14px;
}
.br-h-quiet { color: var(--br-ink-muted); }
.br-h-spaced { margin-top: 26px; }
.br-count {
  font-size: 11px; color: var(--br-ink-muted); background: oklch(1 0 0 / 0.06);
  border-radius: 999px; padding: 1px 8px; letter-spacing: 0;
}

/* decisions — the hero */
.br-decisions { display: flex; flex-direction: column; gap: 12px; }
.br-decision {
  position: relative; padding: 20px 22px; border-radius: 16px;
  background: var(--br-raised); border: 1px solid var(--br-hair);
}
.br-decision-new {
  border-color: oklch(0.79 0.14 72 / 0.4);
  animation: br-land 700ms cubic-bezier(0.2,0,0,1) both;
}
@keyframes br-land {
  0% { opacity: 0; transform: translateY(10px); box-shadow: 0 0 0 1px var(--br-accent), 0 0 50px oklch(0.74 0.15 58 / 0.3); }
  100% { opacity: 1; transform: none; }
}
.br-fresh {
  position: absolute; top: 16px; right: 18px;
  font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700;
  color: var(--br-field); background: var(--br-accent); border-radius: 999px; padding: 3px 9px;
}
.br-decision-text {
  font-family: var(--font-fraunces), serif;
  font-size: 22px; line-height: 1.34; font-weight: 500; color: var(--br-ink-strong);
  letter-spacing: -0.01em; padding-right: 90px;
}
.br-decision-why { font-size: 14px; line-height: 1.5; color: var(--br-ink-muted); margin-top: 10px; font-style: italic; }

/* two-column lower */
.br-cols { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 38px; }

/* actions */
.br-actions { display: flex; flex-direction: column; gap: 12px; }
.br-action { display: flex; gap: 12px; padding: 13px 15px; border-radius: 12px; background: oklch(0.21 0.013 60 / 0.7); border: 1px solid var(--br-hair); }
.br-action-new { border-color: oklch(0.79 0.14 72 / 0.35); border-style: dashed; }
.br-check { flex-shrink: 0; width: 16px; height: 16px; margin-top: 2px; border: 1.5px solid var(--br-ink-faint); border-radius: 5px; }
.br-action-new .br-check { border-color: var(--br-accent); border-style: dashed; }
.br-action-body { flex: 1; }
.br-action-text { font-size: 14.5px; line-height: 1.4; color: var(--br-ink-strong); font-weight: 500; }
.br-action-meta { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.br-owner { font-size: 12px; font-weight: 700; color: var(--br-green); }
.br-due { font-size: 11.5px; color: var(--br-ink-muted); }

/* open + points */
.br-open, .br-points { display: flex; flex-direction: column; gap: 9px; }
.br-q, .br-point { display: flex; align-items: baseline; gap: 10px; padding: 9px 4px; border-bottom: 1px solid var(--br-hair); }
.br-q-mark { color: var(--br-ember); font-weight: 700; font-size: 15px; flex-shrink: 0; }
.br-q-text, .br-point-text { flex: 1; font-size: 14px; line-height: 1.45; color: var(--br-ink); }
.br-point-text { color: var(--br-ink-muted); }

/* evidence affordance */
.br-evidence {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--font-hanken), sans-serif; font-size: 11.5px; color: var(--br-ink-muted);
  background: oklch(1 0 0 / 0.04); border: 1px solid var(--br-hair); border-radius: 999px;
  padding: 3px 11px; margin-top: 14px; cursor: pointer; transition: all 160ms;
}
.br-decision .br-evidence { margin-top: 16px; }
.br-action-meta .br-evidence, .br-evidence-sm { margin-top: 0; padding: 2px 9px; font-size: 11px; }
.br-evidence:hover { color: var(--br-accent); border-color: oklch(0.79 0.14 72 / 0.5); background: oklch(0.79 0.14 72 / 0.08); }
.br-evidence-mark { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }

/* drawer */
.br-drawer-scrim {
  position: absolute; inset: 0; background: oklch(0.1 0.01 60 / 0.5);
  opacity: 0; pointer-events: none; transition: opacity 240ms; backdrop-filter: blur(1px); z-index: 5;
}
.br-drawer-scrim.br-open { opacity: 1; pointer-events: auto; }
.br-drawer {
  position: absolute; top: 0; right: 0; bottom: 0; width: 440px; max-width: 88vw; z-index: 6;
  display: flex; flex-direction: column;
  background: var(--br-base); border-left: 1px solid oklch(0.79 0.14 72 / 0.25);
  box-shadow: -30px 0 60px -30px oklch(0 0 0 / 0.7);
  transform: translateX(100%); transition: transform 280ms cubic-bezier(0.2,0,0,1);
}
.br-drawer.br-open { transform: none; }
.br-drawer-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  padding: 20px 22px 16px; border-bottom: 1px solid var(--br-hair);
}
.br-drawer-eyebrow { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--br-accent); font-weight: 600; }
.br-drawer-title { font-family: var(--font-fraunces), serif; font-size: 18px; color: var(--br-ink-strong); margin-top: 4px; }
.br-drawer-close {
  width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
  background: transparent; border: 1px solid var(--br-hair); color: var(--br-ink-muted);
  cursor: pointer; transition: all 150ms;
}
.br-drawer-close:hover { color: var(--br-ink-strong); border-color: var(--br-ink-muted); }
.br-drawer-body { flex: 1; overflow-y: auto; padding: 14px 22px; display: flex; flex-direction: column; gap: 4px; }
.br-seg { padding: 9px 11px; border-radius: 9px; transition: background 150ms; }
.br-seg-cited { background: oklch(0.79 0.14 72 / 0.08); box-shadow: inset 0 0 0 1px oklch(0.79 0.14 72 / 0.18); }
.br-seg:not(.br-seg-cited) { opacity: 0.5; }
.br-seg-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 3px; }
.br-seg-name { font-size: 12px; font-weight: 600; }
.br-seg-time { font-family: var(--font-mono); font-size: 10px; color: var(--br-ink-faint); }
.br-seg-text { font-size: 14px; line-height: 1.5; color: var(--br-ink); }
.br-drawer-foot { padding: 14px 22px; border-top: 1px solid var(--br-hair); }
.br-drawer-toggle {
  font-family: var(--font-hanken), sans-serif; font-size: 12.5px; font-weight: 500; color: var(--br-accent);
  background: transparent; border: 0; cursor: pointer; padding: 0;
}
.br-drawer-toggle:hover { text-decoration: underline; }

@media (max-width: 860px) { .br-cols { grid-template-columns: 1fr; gap: 24px; } }
`;
