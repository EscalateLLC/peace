'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useEvidenceHighlight } from '../_shared';
import {
  ACTIONS,
  DECISIONS,
  MEETING,
  SEGMENTS,
  offset,
  speakerSlot
} from '../_data';

/* RETHINK — Approach 1: "Stream".
 * No panes. The meeting writes itself as ONE living document: transcript and
 * insights share a single timeline, and an extracted decision/action
 * crystallizes INLINE, between the utterances that produced it. Evidence is
 * spatial — the insight sits on top of its source. A slim spine on the left is
 * the only navigation: a running table of contents of what's been organized.
 * Intent: "let me follow the conversation organize itself." */

const HUES = [28, 200, 152, 300, 95, 255, 338, 60];

function speakerColor (speakerId: string): string {
  if (speakerId === 'peace') {
    return 'var(--st-bot)';
  }

  return `oklch(0.55 0.13 ${HUES[speakerSlot(speakerId)] ?? 28})`;
}

// Where each insight slots into the timeline (after which segment it crystallizes).
const INLINE: Record<string, { kind: 'decision' | 'action'; id: string }[]> = {
  s2: [{
    kind: 'decision',
    id  : 'd1'
  }],
  s8: [{
    kind: 'decision',
    id  : 'd2'
  }],
  s10: [{
    kind: 'action',
    id  : 'a2'
  }]
};

// The spine's running index of everything organized so far, in order.
const SPINE = [
  {
    kind : 'decision',
    id   : 'd1',
    label: 'Per-speaker STT sockets',
    seg  : 's2'
  },
  {
    kind : 'question',
    id   : 'q1',
    label: 'Minimum that feels live?',
    seg  : 's5'
  },
  {
    kind : 'point',
    id   : 'k1',
    label: 'Live view is the wow',
    seg  : 's3'
  },
  {
    kind : 'point',
    id   : 'k2',
    label: 'Socket proven to 4 speakers',
    seg  : 's2'
  },
  {
    kind : 'decision',
    id   : 'd2',
    label: 'Beta scope: live + batch',
    seg  : 's8'
  },
  {
    kind : 'action',
    id   : 'a2',
    label: 'Load-test past 4 speakers',
    seg  : 's10'
  }
] as const;

const GLYPH: Record<string, string> = {
  decision: '◆',
  action  : '▸',
  question: '?',
  point   : '·'
};

export default function Stream () {
  const { highlighted, highlight, clear, containerRef } = useEvidenceHighlight();

  return (
    <div
      className="st-root"
      onClick={event => {
        if (!(event.target instanceof Element) || !event.target.closest('[data-chip]')) {
          clear();
        }
      }}
    >
      <style>{CSS}</style>

      <aside className="st-spine">
        <Link
          href="/mockups"
          className="st-back"
        >
          ←
        </Link>
        <div className="st-spine-live">
          <span className="st-rec" />
          LIVE
        </div>
        <div className="st-spine-list">
          {SPINE.map(item => (
            <button
              key={item.id}
              data-chip
              type="button"
              className={`st-spine-item st-spine-${item.kind}`}
              onClick={() => highlight([item.seg])}
            >
              <span className="st-spine-glyph">{GLYPH[item.kind]}</span>
              <span className="st-spine-label">{item.label}</span>
            </button>
          ))}
        </div>
        <div className="st-spine-foot">
          peace · listening
          <span className="st-listen-dots"><i /><i /><i /></span>
        </div>
      </aside>

      <div
        className="st-scroll"
        ref={containerRef}
      >
        <article className="st-doc">
          <header className="st-head">
            <h1 className="st-title">{MEETING.title}</h1>
            <div className="st-byline">live transcript · elapsed {MEETING.elapsed}</div>
          </header>

          {SEGMENTS.map(seg => (
            <div key={seg.id}>
              <p
                data-seg={seg.id}
                data-on={highlighted.has(seg.id) || undefined}
                className={`st-utt${seg.bot ? ' st-utt-bot' : ''}${seg.interim ? ' st-utt-interim' : ''}`}
              >
                <span
                  className="st-speaker"
                  style={{ color: speakerColor(seg.speakerId) }}
                >
                  {seg.speaker}
                  <span className="st-time">{offset(seg.t)}</span>
                </span>
                <span className="st-words">
                  {seg.text}
                  {seg.interim && <span className="st-caret" />}
                </span>
              </p>

              {(INLINE[seg.id] ?? []).map(slot => (slot.kind === 'decision' ? <InlineDecision
                key={slot.id}
                decision={DECISIONS.find(d => d.id === slot.id)!}
                onHighlight={highlight}
              /> : <InlineAction
                key={slot.id}
                action={ACTIONS.find(a => a.id === slot.id)!}
                onHighlight={highlight}
              />))}
            </div>
          ))}

          <div className="st-tail">
            <span className="st-tail-dot" />
            peace is following along — insights appear here as the conversation organizes itself.
          </div>
        </article>
      </div>
    </div>
  );
}

function InlineDecision ({ decision, onHighlight }: { decision: typeof DECISIONS[number]; onHighlight: (ids: string[]) => void }) {
  const [settled, setSettled] = useState(!decision.provisional);

  useEffect(() => {
    if (decision.provisional) {
      const timer = setTimeout(() => setSettled(true), 1500);

      return () => clearTimeout(timer);
    }
  }, [decision.provisional]);

  return (
    <aside className={`st-insight st-insight-decision${decision.provisional && !settled ? ' st-forming' : ''}${decision.provisional ? ' st-just' : ''}`}>
      <div className="st-insight-rail" />
      <div className="st-insight-body">
        <div className="st-insight-kind">
          ◆ Decision{decision.provisional && !settled && <em> · forming</em>}
        </div>
        <p className="st-insight-text">{decision.text}</p>
        {decision.rationale && <p className="st-insight-sub">{decision.rationale}</p>}
        <button
          data-chip
          type="button"
          className="st-from"
          onClick={() => onHighlight(decision.evidence)}
        >
          from the exchange above · {decision.evidence.length} cited
        </button>
      </div>
    </aside>
  );
}

function InlineAction ({ action, onHighlight }: { action: typeof ACTIONS[number]; onHighlight: (ids: string[]) => void }) {
  return (
    <aside className={`st-insight st-insight-action${action.provisional ? ' st-forming st-just' : ''}`}>
      <div className="st-insight-rail" />
      <div className="st-insight-body">
        <div className="st-insight-kind">▸ Action{action.provisional && <em> · forming</em>}</div>
        <p className="st-insight-text st-insight-text-sm">{action.text}</p>
        <div className="st-action-meta">
          {action.assignee && <span className="st-owner">{action.assignee}</span>}
          {action.due && <span className="st-due">due {action.due}</span>}
          <button
            data-chip
            type="button"
            className="st-from st-from-inline"
            onClick={() => onHighlight(action.evidence)}
          >
            {action.evidence.length} cited
          </button>
        </div>
      </div>
    </aside>
  );
}

const CSS = `
.st-root {
  --st-page: oklch(0.965 0.01 80);
  --st-paper: oklch(0.99 0.006 80);
  --st-ink-strong: oklch(0.25 0.018 55);
  --st-ink: oklch(0.36 0.014 55);
  --st-ink-muted: oklch(0.54 0.012 55);
  --st-ink-faint: oklch(0.7 0.01 55);
  --st-accent: oklch(0.56 0.16 40);
  --st-decision: oklch(0.55 0.15 35);
  --st-action: oklch(0.5 0.11 150);
  --st-bot: oklch(0.52 0.04 55);
  --st-wash: oklch(0.85 0.09 70 / 0.4);

  position: absolute; inset: 0; display: flex;
  font-family: var(--font-newsreader), Georgia, serif;
  color: var(--st-ink);
  background:
    radial-gradient(1200px 700px at 70% -10%, oklch(0.99 0.02 70 / 0.7), transparent 55%),
    var(--st-page);
}

/* spine */
.st-spine {
  width: 232px; flex-shrink: 0;
  display: flex; flex-direction: column;
  padding: 20px 16px;
  border-right: 1px solid oklch(0.55 0.04 55 / 0.14);
  background: oklch(0.95 0.011 80 / 0.5);
  font-family: var(--font-hanken), sans-serif;
}
.st-back {
  width: 30px; height: 30px; border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--st-ink-muted); text-decoration: none; font-size: 16px;
  border: 1px solid oklch(0.55 0.04 55 / 0.16);
  transition: all 160ms;
}
.st-back:hover { color: var(--st-accent); border-color: var(--st-accent); }
.st-spine-live {
  display: inline-flex; align-items: center; gap: 7px; margin: 20px 0 16px;
  font-size: 10px; letter-spacing: 0.22em; font-weight: 700; color: var(--st-accent);
}
.st-rec {
  width: 7px; height: 7px; border-radius: 50%; background: var(--st-accent);
  animation: st-rec 2s ease-in-out infinite;
}
@keyframes st-rec { 0%,100% { box-shadow: 0 0 0 0 oklch(0.56 0.16 40 / 0.4); } 50% { box-shadow: 0 0 0 5px transparent; } }
.st-spine-list { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.st-spine-item {
  display: flex; align-items: baseline; gap: 9px; text-align: left;
  padding: 6px 8px; border-radius: 7px; border: 0; background: transparent; cursor: pointer;
  color: var(--st-ink-muted); transition: background 150ms, color 150ms;
}
.st-spine-item:hover { background: oklch(0.55 0.04 55 / 0.07); color: var(--st-ink-strong); }
.st-spine-glyph { font-size: 11px; width: 12px; flex-shrink: 0; }
.st-spine-decision .st-spine-glyph { color: var(--st-decision); }
.st-spine-action .st-spine-glyph { color: var(--st-action); }
.st-spine-question .st-spine-glyph, .st-spine-point .st-spine-glyph { color: var(--st-ink-faint); }
.st-spine-label { font-size: 12.5px; line-height: 1.35; }
.st-spine-foot {
  margin-top: 16px; padding-top: 14px; border-top: 1px solid oklch(0.55 0.04 55 / 0.14);
  display: flex; align-items: center; gap: 8px;
  font-size: 11.5px; color: var(--st-ink-muted);
}
.st-listen-dots { display: inline-flex; gap: 3px; }
.st-listen-dots i { width: 4px; height: 4px; border-radius: 50%; background: var(--st-ink-faint); animation: st-listen 1.4s ease-in-out infinite; }
.st-listen-dots i:nth-child(2) { animation-delay: 0.2s; }
.st-listen-dots i:nth-child(3) { animation-delay: 0.4s; }
@keyframes st-listen { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }

/* document */
.st-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.st-doc { max-width: 680px; margin: 0 auto; padding: 56px 40px 120px; }
.st-head { margin-bottom: 40px; }
.st-title { font-size: 34px; font-weight: 500; line-height: 1.1; color: var(--st-ink-strong); letter-spacing: -0.015em; }
.st-byline {
  font-family: var(--font-hanken), sans-serif;
  font-size: 12px; color: var(--st-ink-muted); margin-top: 8px; letter-spacing: 0.02em;
}

/* utterances */
.st-utt {
  font-size: 18px; line-height: 1.66; margin-bottom: 16px; color: var(--st-ink);
  padding: 2px 6px; margin-left: -6px; border-radius: 3px; transition: background 200ms;
}
.st-utt[data-on] { background: var(--st-wash); box-shadow: -4px 0 0 var(--st-accent); }
.st-speaker {
  font-family: var(--font-hanken), sans-serif;
  font-variant: small-caps; text-transform: lowercase;
  font-size: 13px; font-weight: 600; letter-spacing: 0.03em;
  margin-right: 11px; white-space: nowrap;
}
.st-time { font-family: var(--font-mono); font-variant: normal; text-transform: none; font-size: 10px; color: var(--st-ink-faint); margin-left: 7px; letter-spacing: 0; }
.st-utt-bot { color: var(--st-ink-muted); font-style: italic; }
.st-utt-bot .st-speaker { color: var(--st-bot) !important; }
.st-utt-interim .st-words { color: var(--st-ink-faint); font-style: italic; }
.st-caret { display: inline-block; width: 13px; height: 1px; background: var(--st-ink-faint); margin-left: 4px; vertical-align: middle; animation: st-write 1.2s ease-in-out infinite; }
@keyframes st-write { 0%,100% { width: 5px; opacity: 0.4; } 50% { width: 15px; opacity: 0.9; } }

/* inline insights — the crystallization, in place */
.st-insight {
  display: flex; gap: 0; margin: 22px -8px 26px 28px;
  border-radius: 12px; overflow: hidden;
  background: var(--st-paper);
  box-shadow: 0 1px 2px oklch(0.4 0.03 55 / 0.06), 0 8px 24px -16px oklch(0.4 0.03 55 / 0.4);
}
.st-just { animation: st-crystallize 800ms cubic-bezier(0.2,0,0,1) both; }
@keyframes st-crystallize {
  0% { opacity: 0; transform: translateY(10px) scale(0.985); box-shadow: 0 0 0 1px var(--st-accent), 0 0 40px oklch(0.56 0.16 40 / 0.25); }
  100% { opacity: 1; transform: none; }
}
.st-insight-rail { width: 4px; flex-shrink: 0; }
.st-insight-decision .st-insight-rail { background: var(--st-decision); }
.st-insight-action .st-insight-rail { background: var(--st-action); }
.st-insight-body { padding: 14px 18px 15px; flex: 1; }
.st-insight-kind {
  font-family: var(--font-hanken), sans-serif;
  font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700;
  margin-bottom: 7px;
}
.st-insight-decision .st-insight-kind { color: var(--st-decision); }
.st-insight-action .st-insight-kind { color: var(--st-action); }
.st-insight-kind em { font-style: normal; color: var(--st-ink-faint); font-weight: 500; }
.st-insight-text {
  font-family: var(--font-fraunces), serif;
  font-size: 19px; line-height: 1.4; font-weight: 500; color: var(--st-ink-strong);
  letter-spacing: -0.005em;
}
.st-forming .st-insight-text { font-style: italic; color: var(--st-ink-muted); }
.st-insight-text-sm { font-size: 16px; }
.st-insight-sub { font-size: 14px; line-height: 1.5; color: var(--st-ink-muted); margin-top: 7px; font-style: italic; }
.st-from {
  font-family: var(--font-hanken), sans-serif;
  font-size: 11.5px; color: var(--st-ink-muted);
  background: transparent; border: 0; padding: 0; margin-top: 11px; cursor: pointer;
  border-bottom: 1px dashed oklch(0.54 0.04 55 / 0.4); transition: color 150ms, border-color 150ms;
}
.st-from:hover { color: var(--st-accent); border-color: var(--st-accent); }
.st-from-inline { margin-top: 0; }
.st-action-meta { display: flex; align-items: center; gap: 10px; margin-top: 10px; font-family: var(--font-hanken), sans-serif; }
.st-owner { font-size: 12px; font-weight: 600; color: var(--st-ink-strong); }
.st-due { font-size: 11.5px; color: var(--st-ink-muted); }

.st-tail {
  display: flex; align-items: center; gap: 10px; margin-top: 30px;
  font-family: var(--font-hanken), sans-serif; font-size: 12.5px; font-style: italic; color: var(--st-ink-faint);
}
.st-tail-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--st-accent); animation: st-rec 2s ease-in-out infinite; }
`;
