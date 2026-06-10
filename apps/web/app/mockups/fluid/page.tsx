'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useEvidenceHighlight } from '../_shared';
import {
  AGENT_ACTIONS,
  AGENT_THREAD,
  COLLABORATORS,
  EDGES,
  MEETING,
  NODES,
  SEGMENTS,
  offset,
  speakerSlot,
  type MapNode,
  type MockSegment
} from '../_data';

/* WORKSPACE — "Fluid Studio".
 * The premise: too much to show at once, so focus ONE aspect at a time. Three
 * zones — transcript · diagram · peace — but only one is focused; the others
 * recede to slim peek-rails. Hover a rail to preview, click to fluidly re-flow
 * the whole layout into it. The diagram is the resting hero; clicking a node
 * opens a centered modal with its evidence + actions (drill in without leaving
 * the canvas). A workspace that breathes. */

type Zone = 'transcript' | 'diagram' | 'peace';

const ZONE_LABEL: Record<Zone, string> = {
  transcript: 'Transcript',
  diagram   : 'Map',
  peace     : 'peace'
};

const HUES = [230, 30, 158, 200, 340, 98, 262, 12];

function speakerColor (speakerId: string): string {
  return speakerId === 'peace' ? 'oklch(0.7 0.03 70)' : `oklch(0.75 0.14 ${HUES[speakerSlot(speakerId)] ?? 230})`;
}

function center (id: string): { x: number; y: number } {
  const node = NODES.find(n => n.id === id);

  return node ? {
    x: node.x,
    y: node.y
  } : {
    x: 0,
    y: 0
  };
}

export default function FluidStudio () {
  const { highlighted, highlight, clear, containerRef } = useEvidenceHighlight();
  const [focus, setFocus] = useState<Zone>('diagram');
  const [modal, setModal] = useState<string | null>(null);

  const modalNode = useMemo(() => NODES.find(n => n.id === modal) ?? null, [modal]);
  const present = COLLABORATORS.filter(p => !p.you);

  // Esc closes the modal.
  useEffect(() => {
    if (!modal) {
      return;
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModal(null);
      }
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  const openNode = (node: MapNode) => {
    setModal(node.id);
    highlight(node.evidence ?? []);
  };

  return (
    <div className="fl-root">
      <style>{CSS}</style>

      <header className="fl-bar">
        <Link
          href="/mockups"
          className="fl-back"
        >
          ←
        </Link>
        <span className="fl-ws">
          <span className="fl-ws-icon">◇</span>
          {MEETING.title}
        </span>
        <span className="fl-live"><span className="fl-live-dot" />live · {MEETING.elapsed}</span>

        <div className="fl-focus-ctl">
          {(['transcript', 'diagram', 'peace'] as Zone[]).map(z => (
            <button
              key={z}
              type="button"
              className={`fl-focus-btn${focus === z ? ' fl-focus-on' : ''}`}
              onClick={() => setFocus(z)}
            >
              {ZONE_LABEL[z]}
            </button>
          ))}
        </div>

        <div className="fl-people">
          {COLLABORATORS.map(p => (
            <span
              key={p.id}
              className={`fl-avatar${p.you ? ' fl-avatar-you' : ''}`}
              style={{ '--c': p.color } as React.CSSProperties}
              title={p.name}
            >
              {p.short}
              {p.speaking && <span className="fl-av-speak" />}
            </span>
          ))}
          <button
            type="button"
            className="fl-share"
          >
            Share
          </button>
        </div>
      </header>

      <div className="fl-stagewrap">
        {/* TRANSCRIPT zone */}
        <section
          className={`fl-zone fl-z-transcript${focus === 'transcript' ? ' fl-focused' : ' fl-rest'}`}
          onClick={() => focus !== 'transcript' && setFocus('transcript')}
        >
          {focus === 'transcript' ? (
            <div className="fl-inner">
              <div className="fl-zone-head">
                <span className="fl-zh-rec" />
                Transcript
                <span className="fl-zh-meta">{SEGMENTS.length} segments · live</span>
              </div>
              <div
                className="fl-transcript"
                ref={containerRef}
                onClick={event => {
                  if (!(event.target instanceof Element) || !event.target.closest('[data-seg]')) {
                    clear();
                  }
                }}
              >
                {SEGMENTS.map(seg => (
                  <Segment
                    key={seg.id}
                    seg={seg}
                    on={highlighted.has(seg.id)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <RailPeek
              label="Transcript"
              accent="oklch(0.74 0.13 230)"
            >
              <div className="fl-peek-lines">
                {SEGMENTS.slice(-3).map(seg => (
                  <div
                    key={seg.id}
                    className="fl-peek-line"
                  >
                    <span
                      className="fl-peek-name"
                      style={{ color: speakerColor(seg.speakerId) }}
                    >
                      {seg.speaker.split(' ')[0]}
                    </span>
                    <span className="fl-peek-text">{seg.text}{seg.interim && '…'}</span>
                  </div>
                ))}
              </div>
            </RailPeek>
          )}
        </section>

        {/* DIAGRAM zone */}
        <section
          className={`fl-zone fl-z-diagram${focus === 'diagram' ? ' fl-focused' : ' fl-rest'}`}
          onClick={() => focus !== 'diagram' && setFocus('diagram')}
        >
          {focus === 'diagram' ? (
            <div className="fl-inner">
              <div className="fl-zone-head">
                <span className="fl-zh-dot" />
                Organizing live
                <span className="fl-zh-meta">click a node to expand</span>
              </div>
              <div className="fl-stage">
                <svg
                  className="fl-edges"
                  viewBox="0 0 980 640"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {EDGES.map(([from, to], i) => {
                    const a = center(from);
                    const b = center(to);
                    const dy = (b.y - a.y) / 2;
                    const live = NODES.find(n => n.id === to)?.provisional;

                    return (
                      <path
                        key={i}
                        className={`fl-edge${live ? ' fl-edge-live' : ''}`}
                        d={`M${a.x} ${a.y} C${a.x} ${a.y + dy} ${b.x} ${b.y - dy} ${b.x} ${b.y}`}
                      />
                    );
                  })}
                </svg>

                {NODES.map(node => (
                  <button
                    key={node.id}
                    type="button"
                    className={`fl-node fl-${node.kind}${node.provisional ? ' fl-node-new' : ''}${modal === node.id ? ' fl-node-sel' : ''}`}
                    style={{
                      left : `${node.x / 980 * 100}%`,
                      top  : `${node.y / 640 * 100}%`,
                      width: `${node.w / 980 * 100}%`
                    }}
                    onClick={e => {
                      e.stopPropagation();
                      openNode(node);
                    }}
                  >
                    <span className="fl-node-kind">{node.kind}</span>
                    <span className="fl-node-label">{node.label}</span>
                    {node.provisional && <span className="fl-node-pulse" />}
                    {present.filter(p => p.focus === node.id).map(p => (
                      <span
                        key={p.id}
                        className="fl-node-focus"
                        style={{ '--c': p.color } as React.CSSProperties}
                        title={`${p.name} is here`}
                      >
                        {p.short}
                      </span>
                    ))}
                  </button>
                ))}

                {present.filter(p => p.cursor).map(p => (
                  <div
                    key={p.id}
                    className="fl-cursor"
                    style={{
                      left : `${p.cursor!.x / 980 * 100}%`,
                      top  : `${p.cursor!.y / 640 * 100}%`,
                      '--c': p.color
                    } as React.CSSProperties}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 18 18"
                    >
                      <path
                        d="M2 2 L2 14 L6 10 L9 16 L11 15 L8 9 L14 9 Z"
                        fill="var(--c)"
                        stroke="white"
                        strokeWidth="1"
                      />
                    </svg>
                    <span className="fl-cursor-name">{p.name.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <RailPeek
              label="Map"
              accent="oklch(0.79 0.14 72)"
              center
            >
              <MiniMap />
            </RailPeek>
          )}
        </section>

        {/* PEACE zone */}
        <section
          className={`fl-zone fl-z-peace${focus === 'peace' ? ' fl-focused' : ' fl-rest'}`}
          onClick={() => focus !== 'peace' && setFocus('peace')}
        >
          {focus === 'peace' ? (
            <div className="fl-inner">
              <div className="fl-zone-head">
                <span className="fl-peace-badge">✦</span>
                peace
                <span className="fl-zh-meta">listening</span>
              </div>
              <div className="fl-console">
                <div className="fl-thread">
                  {AGENT_THREAD.map((turn, i) => (
                    <div
                      key={i}
                      className={`fl-turn fl-turn-${turn.from}`}
                    >
                      {turn.text}
                    </div>
                  ))}
                  <div className="fl-thread-actions">
                    <button
                      type="button"
                      className="fl-go"
                    >
                      Post to #northwind
                    </button>
                    <button
                      type="button"
                      className="fl-go fl-go-ghost"
                    >
                      Not yet
                    </button>
                  </div>
                </div>
                <div className="fl-actions-grid">
                  {AGENT_ACTIONS.map(a => (
                    <button
                      key={a.label}
                      type="button"
                      className="fl-action"
                    >
                      <span className="fl-action-icon">{a.icon}</span>
                      <span>{a.label}</span>
                      {a.hint && <span className="fl-action-hint">{a.hint}</span>}
                    </button>
                  ))}
                </div>
                <div className="fl-ask">
                  <span className="fl-ask-peace">✦</span>
                  <span className="fl-ask-ph">Ask peace or run an action…</span>
                  <span className="fl-ask-key">⏎</span>
                </div>
              </div>
            </div>
          ) : (
            <RailPeek
              label="peace"
              accent="oklch(0.79 0.14 72)"
              glyph="✦"
            >
              <div className="fl-peek-peace">
                <span className="fl-peek-badge">1 suggestion</span>
                <span className="fl-peek-peacetext">{AGENT_THREAD.at(-1)?.text.slice(0, 64)}…</span>
              </div>
            </RailPeek>
          )}
        </section>
      </div>

      <div className="fl-hint">hover a rail to peek · click to focus · click a node to expand</div>

      {/* node detail modal */}
      {modalNode && (
        <div
          className="fl-modal-scrim"
          onClick={() => setModal(null)}
        >
          <div
            className={`fl-modal fl-modal-${modalNode.kind}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="fl-modal-head">
              <span className="fl-modal-kind">{modalNode.kind}</span>
              <button
                type="button"
                className="fl-modal-close"
                onClick={() => setModal(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <h2 className="fl-modal-title">{modalNode.label}</h2>

            <div className="fl-modal-evidence">
              <div className="fl-modal-ev-h">◆ Grounded in {modalNode.evidence?.length ?? 0} segments</div>
              {SEGMENTS.filter(s => modalNode.evidence?.includes(s.id)).map(seg => (
                <Segment
                  key={seg.id}
                  seg={seg}
                  on={false}
                  compact
                />
              ))}
            </div>

            <div className="fl-modal-actions">
              {AGENT_ACTIONS.slice(0, 3).map(a => (
                <button
                  key={a.label}
                  type="button"
                >
                  <span className="fl-action-icon">{a.icon}</span>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Segment ({ seg, on, compact }: { seg: MockSegment; on: boolean; compact?: boolean }) {
  return (
    <div
      data-seg={seg.id}
      data-on={on || undefined}
      className={`fl-seg${seg.bot ? ' fl-seg-bot' : ''}${seg.interim ? ' fl-seg-interim' : ''}${compact ? ' fl-seg-compact' : ''}`}
    >
      <div className="fl-seg-head">
        <span
          className="fl-seg-name"
          style={{ color: speakerColor(seg.speakerId) }}
        >
          {seg.speaker}
        </span>
        <span className="fl-seg-time">{offset(seg.t)}</span>
      </div>
      <p className="fl-seg-text">{seg.text}{seg.interim && <span className="fl-seg-caret" />}</p>
    </div>
  );
}

function RailPeek ({ label, accent, glyph, center: isCenter, children }: { label: string; accent: string; glyph?: string; center?: boolean; children: React.ReactNode }) {
  return (
    <div
      className="fl-rail"
      style={{ '--accent': accent } as React.CSSProperties}
    >
      <div className="fl-rail-spine">
        {glyph && <span className="fl-rail-glyph">{glyph}</span>}
        <span className="fl-rail-label">{label}</span>
        <span className="fl-rail-expand">⤢</span>
      </div>
      <div className={`fl-rail-peek${isCenter ? ' fl-rail-peek-center' : ''}`}>{children}</div>
    </div>
  );
}

function MiniMap () {
  return (
    <svg
      className="fl-mini"
      viewBox="0 0 980 640"
      preserveAspectRatio="xMidYMid meet"
    >
      {EDGES.map(([from, to], i) => {
        const a = center(from);
        const b = center(to);

        return (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            className="fl-mini-edge"
          />
        );
      })}
      {NODES.map(node => (
        <rect
          key={node.id}
          x={node.x - node.w / 2}
          y={node.y - 26}
          width={node.w}
          height={52}
          rx={12}
          className={`fl-mini-node fl-mini-${node.kind}${node.provisional ? ' fl-mini-new' : ''}`}
        />
      ))}
    </svg>
  );
}

const CSS = `
.fl-root {
  --fl-field: oklch(0.165 0.008 260);
  --fl-panel: oklch(0.2 0.009 260);
  --fl-raised: oklch(0.24 0.01 260);
  --fl-hair: oklch(1 0 0 / 0.08);
  --fl-ink-strong: oklch(0.95 0.006 260);
  --fl-ink: oklch(0.8 0.008 260);
  --fl-ink-muted: oklch(0.6 0.01 260);
  --fl-ink-faint: oklch(0.46 0.01 260);
  --fl-accent: oklch(0.79 0.14 72);
  --fl-decision: oklch(0.79 0.14 72);
  --fl-action: oklch(0.74 0.13 152);
  --fl-question: oklch(0.74 0.13 230);
  --fl-topic: oklch(0.86 0.01 260);
  --fl-outcome: oklch(0.62 0.02 260);
  --fl-ease: cubic-bezier(0.22, 1, 0.36, 1);

  position: absolute; inset: 0; display: flex; flex-direction: column;
  font-family: var(--font-hanken), system-ui, sans-serif;
  color: var(--fl-ink); background: var(--fl-field); overflow: hidden;
}

/* bar */
.fl-bar { display: flex; align-items: center; gap: 14px; height: 52px; padding: 0 18px; flex-shrink: 0; border-bottom: 1px solid var(--fl-hair); background: oklch(0.18 0.008 260 / 0.85); z-index: 20; }
.fl-back { width: 30px; height: 30px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; color: var(--fl-ink-muted); text-decoration: none; border: 1px solid var(--fl-hair); transition: all 150ms; }
.fl-back:hover { color: var(--fl-accent); border-color: var(--fl-accent); }
.fl-ws { display: inline-flex; align-items: center; gap: 9px; font-family: var(--font-fraunces), serif; font-size: 15px; font-weight: 600; color: var(--fl-ink-strong); }
.fl-ws-icon { color: var(--fl-accent); }
.fl-live { display: inline-flex; align-items: center; gap: 7px; font-size: 11.5px; color: var(--fl-ink-muted); }
.fl-live-dot { width: 7px; height: 7px; border-radius: 50%; background: oklch(0.74 0.13 152); box-shadow: 0 0 8px oklch(0.74 0.13 152); animation: fl-pulse 2s ease-in-out infinite; }
@keyframes fl-pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }

.fl-focus-ctl { margin-left: 14px; display: inline-flex; gap: 2px; padding: 3px; border-radius: 10px; background: oklch(0.16 0.008 260); border: 1px solid var(--fl-hair); }
.fl-focus-btn { font-family: inherit; font-size: 12px; font-weight: 500; color: var(--fl-ink-muted); background: transparent; border: 0; border-radius: 7px; padding: 5px 12px; cursor: pointer; transition: all 200ms; }
.fl-focus-btn:hover { color: var(--fl-ink); }
.fl-focus-on { background: var(--fl-raised); color: var(--fl-ink-strong); box-shadow: 0 1px 6px -2px oklch(0 0 0 / 0.6); }

.fl-people { margin-left: auto; display: flex; align-items: center; }
.fl-avatar { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; margin-left: -6px; border-radius: 50%; font-size: 9.5px; font-weight: 700; color: oklch(0.16 0.01 260); background: var(--c); border: 2px solid var(--fl-field); }
.fl-avatar-you { background: var(--fl-raised); color: var(--fl-ink); }
.fl-av-speak { position: absolute; inset: -2px; border-radius: 50%; border: 2px solid var(--c); animation: fl-speak 1.2s ease-in-out infinite; }
@keyframes fl-speak { 0%,100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 1; transform: scale(1.12); } }
.fl-share { margin-left: 12px; font-family: inherit; font-size: 12px; font-weight: 600; color: var(--fl-field); background: var(--fl-accent); border: 0; border-radius: 8px; padding: 6px 13px; cursor: pointer; }

/* fluid zones */
.fl-stagewrap { flex: 1; min-height: 0; display: flex; gap: 10px; padding: 10px; }
.fl-zone {
  position: relative; min-width: 0; border-radius: 14px; overflow: hidden;
  background: var(--fl-panel); border: 1px solid var(--fl-hair);
  transition: flex-grow 520ms var(--fl-ease), flex-basis 520ms var(--fl-ease);
}
.fl-focused { flex: 1 1 0%; }
.fl-rest { flex: 0 0 88px; cursor: pointer; background: oklch(0.185 0.008 260); }
.fl-rest:hover { flex-basis: 264px; border-color: oklch(1 0 0 / 0.16); background: var(--fl-panel); }
.fl-inner { position: absolute; inset: 0; display: flex; flex-direction: column; animation: fl-fade 420ms ease; }
@keyframes fl-fade { from { opacity: 0; } to { opacity: 1; } }

.fl-zone-head { display: flex; align-items: center; gap: 9px; padding: 14px 18px; flex-shrink: 0; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; color: var(--fl-ink); border-bottom: 1px solid var(--fl-hair); }
.fl-zh-meta { margin-left: auto; font-size: 10.5px; letter-spacing: 0.02em; text-transform: none; font-weight: 400; color: var(--fl-ink-faint); }
.fl-zh-rec, .fl-zh-dot { width: 7px; height: 7px; border-radius: 50%; }
.fl-zh-rec { background: oklch(0.74 0.13 230); box-shadow: 0 0 8px oklch(0.74 0.13 230); }
.fl-zh-dot { background: var(--fl-accent); box-shadow: 0 0 8px var(--fl-accent); }
.fl-peace-badge { color: var(--fl-accent); font-size: 14px; }

/* rail (resting) */
.fl-rail { position: absolute; inset: 0; display: flex; }
.fl-rail-spine { flex-shrink: 0; width: 88px; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 16px 0; }
.fl-rail-glyph { color: var(--accent); font-size: 16px; }
.fl-rail-label { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; color: var(--fl-ink-muted); margin-top: 4px; }
.fl-rail-expand { margin-top: auto; color: var(--fl-ink-faint); font-size: 14px; }
.fl-rest:hover .fl-rail-expand { color: var(--accent); }
.fl-rail-peek { flex: 1; min-width: 0; overflow: hidden; padding: 16px 16px 16px 0; opacity: 0; transition: opacity 300ms ease 80ms; }
.fl-rail-peek-center { display: flex; align-items: center; }
.fl-rest:hover .fl-rail-peek { opacity: 1; }

.fl-peek-lines { display: flex; flex-direction: column; gap: 10px; }
.fl-peek-line { font-size: 12.5px; line-height: 1.4; }
.fl-peek-name { font-weight: 700; margin-right: 6px; }
.fl-peek-text { color: var(--fl-ink-muted); }
.fl-peek-peace { display: flex; flex-direction: column; gap: 8px; }
.fl-peek-badge { align-self: flex-start; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; color: var(--fl-field); background: var(--fl-accent); border-radius: 999px; padding: 2px 9px; }
.fl-peek-peacetext { font-size: 12.5px; line-height: 1.45; color: var(--fl-ink-muted); }
.fl-mini { width: 100%; height: 100%; max-height: 220px; }
.fl-mini-edge { stroke: oklch(0.6 0.02 260 / 0.4); stroke-width: 2.5; }
.fl-mini-node { stroke: oklch(1 0 0 / 0.12); stroke-width: 1.5; fill: var(--fl-raised); }
.fl-mini-decision { fill: oklch(0.79 0.14 72 / 0.25); stroke: var(--fl-decision); }
.fl-mini-action { fill: oklch(0.74 0.13 152 / 0.2); stroke: var(--fl-action); }
.fl-mini-question { fill: oklch(0.74 0.13 230 / 0.2); stroke: var(--fl-question); }
.fl-mini-new { stroke: var(--fl-accent); stroke-width: 3; }

/* transcript focused */
.fl-transcript { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 2px; }
.fl-seg { padding: 8px 11px; border-radius: 9px; transition: background 160ms; }
.fl-seg[data-on] { background: oklch(0.79 0.14 72 / 0.14); box-shadow: inset 0 0 0 1px oklch(0.79 0.14 72 / 0.3); }
.fl-seg-compact { padding: 6px 0; }
.fl-seg-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 2px; }
.fl-seg-name { font-size: 12px; font-weight: 600; }
.fl-seg-time { font-family: var(--font-mono); font-size: 9.5px; color: var(--fl-ink-faint); }
.fl-seg-text { font-size: 13.5px; line-height: 1.5; color: var(--fl-ink); }
.fl-seg-bot .fl-seg-text { color: var(--fl-ink-muted); font-style: italic; }
.fl-seg-interim .fl-seg-text { color: var(--fl-ink-faint); font-style: italic; }
.fl-seg-caret { display: inline-block; width: 8px; height: 1px; background: var(--fl-ink-faint); margin-left: 3px; vertical-align: middle; animation: fl-write 1.2s ease-in-out infinite; }
@keyframes fl-write { 0%,100% { width: 4px; opacity: 0.4; } 50% { width: 10px; opacity: 0.9; } }

/* diagram focused */
.fl-stage { position: relative; flex: 1; min-height: 0; margin: 14px; background-image: radial-gradient(oklch(1 0 0 / 0.045) 1px, transparent 1px); background-size: 24px 24px; }
.fl-edges { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.fl-edge { fill: none; stroke: oklch(0.6 0.02 260 / 0.5); stroke-width: 1.5; }
.fl-edge-live { stroke: oklch(0.79 0.14 72 / 0.6); stroke-dasharray: 5 4; animation: fl-flow 26s linear infinite; }
@keyframes fl-flow { to { stroke-dashoffset: -200; } }
.fl-node { position: absolute; transform: translate(-50%, -50%); text-align: left; display: flex; flex-direction: column; gap: 5px; padding: 10px 12px; border-radius: 12px; cursor: pointer; background: var(--fl-panel); border: 1px solid var(--fl-hair); box-shadow: 0 6px 20px -10px oklch(0 0 0 / 0.6); transition: transform 140ms, box-shadow 200ms, border-color 200ms; font-family: inherit; }
.fl-node:hover { transform: translate(-50%, -50%) translateY(-2px) scale(1.02); border-color: oklch(1 0 0 / 0.22); z-index: 3; }
.fl-node-kind { font-size: 8.5px; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700; }
.fl-node-label { font-size: 12.5px; line-height: 1.3; color: var(--fl-ink-strong); font-weight: 500; }
.fl-topic { border-color: oklch(0.86 0.01 260 / 0.3); }
.fl-topic .fl-node-kind { color: var(--fl-topic); }
.fl-decision { border-left: 3px solid var(--fl-decision); }
.fl-decision .fl-node-kind { color: var(--fl-decision); }
.fl-action { border-left: 3px solid var(--fl-action); }
.fl-action .fl-node-kind { color: var(--fl-action); }
.fl-question { border-left: 3px solid var(--fl-question); }
.fl-question .fl-node-kind { color: var(--fl-question); }
.fl-outcome { background: oklch(0.2 0.008 260 / 0.7); }
.fl-outcome .fl-node-kind { color: var(--fl-outcome); }
.fl-node-sel { border-color: var(--fl-accent); box-shadow: 0 0 0 1px var(--fl-accent), 0 10px 30px -12px oklch(0 0 0 / 0.7); }
.fl-node-new { animation: fl-arrive 800ms var(--fl-ease) both; }
@keyframes fl-arrive { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); } 100% { opacity: 1; } }
.fl-node-pulse { position: absolute; top: 9px; right: 10px; width: 6px; height: 6px; border-radius: 50%; background: var(--fl-accent); animation: fl-np 1.8s ease-out infinite; }
@keyframes fl-np { 0% { box-shadow: 0 0 0 0 oklch(0.79 0.14 72 / 0.5); } 100% { box-shadow: 0 0 0 8px transparent; } }
.fl-node-focus { position: absolute; top: -9px; right: -9px; width: 18px; height: 18px; border-radius: 50%; background: var(--c); color: oklch(0.16 0.01 260); font-size: 8px; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 2px solid var(--fl-field); }
.fl-cursor { position: absolute; pointer-events: none; z-index: 8; transition: left 2s ease, top 2s ease; }
.fl-cursor-name { position: absolute; left: 13px; top: 11px; white-space: nowrap; font-size: 10px; font-weight: 600; color: oklch(0.16 0.01 260); background: var(--c); padding: 1px 5px; border-radius: 4px 8px 8px 8px; }

/* peace focused */
.fl-console { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 14px; }
.fl-thread { display: flex; flex-direction: column; gap: 8px; padding-bottom: 14px; border-bottom: 1px solid var(--fl-hair); }
.fl-turn { font-size: 13px; line-height: 1.5; padding: 10px 12px; border-radius: 12px; max-width: 92%; }
.fl-turn-user { align-self: flex-end; background: var(--fl-raised); color: var(--fl-ink); border-bottom-right-radius: 4px; }
.fl-turn-peace { align-self: flex-start; background: oklch(0.79 0.14 72 / 0.1); border: 1px solid oklch(0.79 0.14 72 / 0.2); color: var(--fl-ink-strong); border-bottom-left-radius: 4px; }
.fl-thread-actions { display: flex; gap: 7px; margin-top: 2px; }
.fl-go { font-family: inherit; font-size: 12px; font-weight: 600; color: var(--fl-field); background: var(--fl-accent); border: 0; border-radius: 8px; padding: 7px 12px; cursor: pointer; }
.fl-go-ghost { background: transparent; color: var(--fl-ink-muted); border: 1px solid var(--fl-hair); }
.fl-actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; padding: 14px 0; }
.fl-action { display: flex; align-items: center; gap: 8px; text-align: left; font-family: inherit; font-size: 12px; color: var(--fl-ink); background: oklch(1 0 0 / 0.04); border: 1px solid var(--fl-hair); border-radius: 9px; padding: 9px 11px; cursor: pointer; transition: all 140ms; }
.fl-action:hover { background: oklch(0.79 0.14 72 / 0.12); border-color: oklch(0.79 0.14 72 / 0.4); color: var(--fl-ink-strong); }
.fl-action-icon { color: var(--fl-accent); }
.fl-action-hint { margin-left: auto; font-size: 10px; color: var(--fl-ink-faint); }
.fl-ask { margin-top: auto; display: flex; align-items: center; gap: 9px; padding: 11px 12px; border-radius: 11px; background: oklch(0.23 0.01 260); border: 1px solid oklch(0.79 0.14 72 / 0.25); }
.fl-ask-peace { color: var(--fl-accent); font-size: 13px; }
.fl-ask-ph { flex: 1; font-size: 12.5px; color: var(--fl-ink-faint); }
.fl-ask-key { font-family: var(--font-mono); font-size: 10.5px; color: var(--fl-ink-faint); border: 1px solid var(--fl-hair); border-radius: 5px; padding: 1px 5px; }

.fl-hint { flex-shrink: 0; text-align: center; padding: 6px 0 9px; font-size: 11px; color: var(--fl-ink-faint); letter-spacing: 0.02em; }

/* modal */
.fl-modal-scrim { position: absolute; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; padding: 40px; background: oklch(0.1 0.01 260 / 0.62); backdrop-filter: blur(3px); animation: fl-fade 200ms ease; }
.fl-modal { width: min(560px, 100%); max-height: 80%; display: flex; flex-direction: column; border-radius: 18px; background: var(--fl-panel); border: 1px solid var(--fl-hair); box-shadow: 0 40px 100px -30px oklch(0 0 0 / 0.85); overflow: hidden; animation: fl-modal-in 320ms var(--fl-ease); }
@keyframes fl-modal-in { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: none; } }
.fl-modal-decision { border-top: 3px solid var(--fl-decision); }
.fl-modal-action { border-top: 3px solid var(--fl-action); }
.fl-modal-question { border-top: 3px solid var(--fl-question); }
.fl-modal-topic, .fl-modal-outcome { border-top: 3px solid var(--fl-ink-faint); }
.fl-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px 0; }
.fl-modal-kind { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700; color: var(--fl-accent); }
.fl-modal-close { width: 28px; height: 28px; border-radius: 8px; background: transparent; border: 1px solid var(--fl-hair); color: var(--fl-ink-muted); cursor: pointer; transition: all 150ms; }
.fl-modal-close:hover { color: var(--fl-ink-strong); border-color: var(--fl-ink-muted); }
.fl-modal-title { font-family: var(--font-fraunces), serif; font-size: 22px; line-height: 1.28; font-weight: 500; color: var(--fl-ink-strong); padding: 10px 20px 16px; }
.fl-modal-evidence { overflow-y: auto; padding: 0 20px 16px; margin: 0 0 4px; border-top: 1px solid var(--fl-hair); border-bottom: 1px solid var(--fl-hair); }
.fl-modal-ev-h { font-size: 11px; letter-spacing: 0.04em; color: var(--fl-accent); font-weight: 600; padding: 14px 0 10px; position: sticky; top: 0; background: var(--fl-panel); }
.fl-modal-actions { display: flex; gap: 8px; padding: 16px 20px; flex-wrap: wrap; }
.fl-modal-actions button { display: inline-flex; align-items: center; gap: 7px; font-family: inherit; font-size: 12.5px; font-weight: 500; color: var(--fl-ink); background: oklch(1 0 0 / 0.04); border: 1px solid var(--fl-hair); border-radius: 9px; padding: 9px 13px; cursor: pointer; transition: all 140ms; }
.fl-modal-actions button:hover { background: oklch(0.79 0.14 72 / 0.12); border-color: oklch(0.79 0.14 72 / 0.4); color: var(--fl-ink-strong); }
`;
