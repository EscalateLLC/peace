'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useEvidenceHighlight } from '../_shared';
import {
  ACTIONS,
  AGENT_ACTIONS,
  AGENT_THREAD,
  COLLABORATORS,
  DECISIONS,
  EDGES,
  MEETING,
  NODES,
  QUESTIONS,
  SEGMENTS,
  offset,
  speakerSlot,
  type MapNode,
  type MockSegment
} from '../_data';

/* WORKSPACE — "Command" (game-engine HUD).
 * The graph is the persistent world; panels are HUD widgets anchored to the
 * corners and they STAY there — no reflow, no hide. Hover lights a panel's
 * border; clicking its bar flies it to center over the (dimmed) graph as a
 * focused readout, then docks back. Clicking a node opens its target dossier.
 * Tactical command center for a live conversation. */

const HUES = [205, 75, 150, 285, 340, 98, 45, 12];

function speakerColor (speakerId: string): string {
  return speakerId === 'peace' ? 'oklch(0.74 0.03 205)' : `oklch(0.8 0.13 ${HUES[speakerSlot(speakerId)] ?? 205})`;
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

const KIND_GLYPH: Record<string, string> = {
  topic   : '⬡',
  decision: '◆',
  action  : '▸',
  question: '◇',
  outcome : '▪'
};

type Panel = 'objectives' | 'comms' | 'peace';

const ORIGIN: Record<Panel, string> = {
  objectives: 'top left',
  comms     : 'bottom left',
  peace     : 'bottom right'
};

const EXP_TITLE: Record<Panel, string> = {
  objectives: 'OBJECTIVES',
  comms     : 'COMMS // FULL TRANSCRIPT',
  peace     : 'PEACE // COMMAND'
};

export default function Command () {
  const { highlighted, highlight, clear, containerRef } = useEvidenceHighlight();
  const [expanded, setExpanded] = useState<Panel | null>(null);
  const [modal, setModal] = useState<string | null>(null);

  const modalNode = useMemo(() => NODES.find(n => n.id === modal) ?? null, [modal]);
  const present = COLLABORATORS.filter(p => !p.you);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModal(null);
        setExpanded(null);
      }
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openNode = (node: MapNode) => {
    setModal(node.id);
    highlight(node.evidence ?? []);
  };

  return (
    <div className="cm-root">
      <style>{CSS}</style>

      {/* world: the tactical map */}
      <div className="cm-field">
        <div className="cm-scan" />
        <div className="cm-reticle" />
        <div className="cm-stage">
          <svg
            className="cm-edges"
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
                  className={`cm-edge${live ? ' cm-edge-live' : ''}`}
                  d={`M${a.x} ${a.y} C${a.x} ${a.y + dy} ${b.x} ${b.y - dy} ${b.x} ${b.y}`}
                />
              );
            })}
          </svg>

          {NODES.map(node => (
            <button
              key={node.id}
              type="button"
              className={`cm-node cm-${node.kind}${node.provisional ? ' cm-node-live' : ''}${modal === node.id ? ' cm-node-sel' : ''}`}
              style={{
                left : `${node.x / 980 * 100}%`,
                top  : `${node.y / 640 * 100}%`,
                width: `${node.w / 980 * 100}%`
              }}
              onClick={() => openNode(node)}
            >
              <span className="cm-node-bracket cm-tl" />
              <span className="cm-node-bracket cm-tr" />
              <span className="cm-node-bracket cm-bl" />
              <span className="cm-node-bracket cm-br" />
              <span className="cm-node-kind">
                <span className="cm-node-glyph">{KIND_GLYPH[node.kind]}</span>
                {node.kind}
                {node.provisional && <span className="cm-node-tag">◌ analyzing</span>}
              </span>
              <span className="cm-node-label">{node.label}</span>
              {present.filter(p => p.focus === node.id).map(p => (
                <span
                  key={p.id}
                  className="cm-node-focus"
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
              className="cm-cursor"
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
                  stroke="oklch(0.14 0.012 250)"
                  strokeWidth="1.4"
                />
              </svg>
              <span className="cm-cursor-name">{p.name.split(' ')[0]}</span>
            </div>
          ))}
        </div>

        {/* viewport frame brackets */}
        <span className="cm-frame cm-frame-tl" />
        <span className="cm-frame cm-frame-tr" />
        <span className="cm-frame cm-frame-bl" />
        <span className="cm-frame cm-frame-br" />
      </div>

      {/* top status bar */}
      <header className="cm-status">
        <Link
          href="/mockups"
          className="cm-back"
        >
          ◄ EXIT
        </Link>
        <span className="cm-sys">{MEETING.title.toUpperCase()}</span>
        <span className="cm-readout"><span className="cm-blip" />REC {MEETING.elapsed}</span>
        <span className="cm-readout cm-dim">NODES {NODES.length}</span>
        <span className="cm-readout cm-dim">SEG {SEGMENTS.length}</span>
        <div className="cm-squad">
          {COLLABORATORS.map(p => (
            <span
              key={p.id}
              className={`cm-pawn${p.you ? ' cm-pawn-you' : ''}${p.speaking ? ' cm-pawn-live' : ''}`}
              style={{ '--c': p.color } as React.CSSProperties}
              title={p.name + (p.speaking ? ' · speaking' : '')}
            >
              {p.short}
            </span>
          ))}
        </div>
      </header>

      {/* corner HUD panels — anchored, always present */}
      <Hud
        id="objectives"
        title="OBJECTIVES"
        pos="cm-at-tl"
        onExpand={setExpanded}
      >
        <div className="cm-obj-list">
          {[...DECISIONS, ...ACTIONS].slice(0, 4).map(item => {
            const isDecision = 'rationale' in item;

            return (
              <div
                key={item.id}
                className={`cm-obj cm-obj-${isDecision ? 'decision' : 'action'}`}
              >
                <span className="cm-obj-glyph">{isDecision ? '◆' : '▸'}</span>
                <span className="cm-obj-text">{item.text}</span>
                {item.provisional && <span className="cm-obj-new">NEW</span>}
              </div>
            );
          })}
        </div>
      </Hud>

      <Hud
        id="comms"
        title="COMMS // TRANSCRIPT"
        pos="cm-at-bl"
        onExpand={setExpanded}
      >
        <div className="cm-feed">
          {SEGMENTS.slice(-5).map(seg => (
            <div
              key={seg.id}
              className={`cm-feed-line${seg.interim ? ' cm-feed-interim' : ''}`}
            >
              <span
                className="cm-feed-name"
                style={{ color: speakerColor(seg.speakerId) }}
              >
                {seg.speaker.split(' ')[0]}
              </span>
              <span className="cm-feed-text">{seg.text}{seg.interim && <span className="cm-feed-caret" />}</span>
            </div>
          ))}
        </div>
      </Hud>

      <Hud
        id="peace"
        title="PEACE // AI"
        pos="cm-at-br"
        accent="amber"
        onExpand={setExpanded}
      >
        <div className="cm-peace-status">
          <span className="cm-peace-core">✦</span>
          <span>online · listening</span>
          <span className="cm-peace-sug">1</span>
        </div>
        <div className="cm-abilities">
          {AGENT_ACTIONS.slice(0, 4).map(a => (
            <button
              key={a.label}
              type="button"
              className="cm-ability"
              onClick={e => e.stopPropagation()}
            >
              <span className="cm-ability-icon">{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>
      </Hud>

      {/* expanded panel — flown to center over the dimmed world */}
      {expanded && (
        <div
          className="cm-overlay"
          onClick={() => setExpanded(null)}
        >
          <div
            className={`cm-expanded cm-exp-${expanded}`}
            style={{ transformOrigin: ORIGIN[expanded] }}
            onClick={e => e.stopPropagation()}
          >
            <div className="cm-exp-bar">
              <span className="cm-exp-title">{EXP_TITLE[expanded]}</span>
              <button
                type="button"
                className="cm-dock"
                onClick={() => setExpanded(null)}
              >
                DOCK ▸
              </button>
            </div>
            <div className="cm-exp-body">
              {expanded === 'comms' && (
                <div
                  className="cm-transcript"
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
              )}

              {expanded === 'objectives' && (
                <div className="cm-obj-full">
                  <Group label="Decisions">
                    {DECISIONS.map(d => (
                      <ObjCard
                        key={d.id}
                        kind="decision"
                        text={d.text}
                        sub={d.rationale}
                        evidence={d.evidence.length}
                        provisional={d.provisional}
                      />
                    ))}
                  </Group>
                  <Group label="Action items">
                    {ACTIONS.map(a => (
                      <ObjCard
                        key={a.id}
                        kind="action"
                        text={a.text}
                        sub={a.assignee ? `assigned ${a.assignee}${a.due ? ` · due ${a.due}` : ''}` : undefined}
                        evidence={a.evidence.length}
                        provisional={a.provisional}
                      />
                    ))}
                  </Group>
                  <Group label="Open questions">
                    {QUESTIONS.map(q => (
                      <ObjCard
                        key={q.id}
                        kind="question"
                        text={q.text}
                        evidence={q.evidence.length}
                      />
                    ))}
                  </Group>
                </div>
              )}

              {expanded === 'peace' && (
                <div className="cm-console">
                  <div className="cm-thread">
                    {AGENT_THREAD.map((turn, i) => (
                      <div
                        key={i}
                        className={`cm-turn cm-turn-${turn.from}`}
                      >
                        {turn.text}
                      </div>
                    ))}
                    <div className="cm-thread-actions">
                      <button
                        type="button"
                        className="cm-go"
                      >
                        Post to #northwind
                      </button>
                      <button
                        type="button"
                        className="cm-go cm-go-ghost"
                      >
                        Not yet
                      </button>
                    </div>
                  </div>
                  <div className="cm-ability-grid">
                    {AGENT_ACTIONS.map(a => (
                      <button
                        key={a.label}
                        type="button"
                        className="cm-ability"
                      >
                        <span className="cm-ability-icon">{a.icon}</span>
                        {a.label}
                        {a.hint && <span className="cm-ability-hint">{a.hint}</span>}
                      </button>
                    ))}
                  </div>
                  <div className="cm-cmdline">
                    <span className="cm-cmd-pr">peace ▸</span>
                    <span className="cm-cmd-ph">issue a command…</span>
                    <span className="cm-cmd-key">⏎</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* node target dossier */}
      {modalNode && (
        <div
          className="cm-overlay"
          onClick={() => setModal(null)}
        >
          <div
            className={`cm-dossier cm-doss-${modalNode.kind}`}
            onClick={e => e.stopPropagation()}
          >
            <span className="cm-doss-bracket cm-tl" />
            <span className="cm-doss-bracket cm-tr" />
            <span className="cm-doss-bracket cm-bl" />
            <span className="cm-doss-bracket cm-br" />
            <div className="cm-doss-bar">
              <span className="cm-doss-kind">{KIND_GLYPH[modalNode.kind]} {modalNode.kind} · dossier</span>
              <button
                type="button"
                className="cm-dock"
                onClick={() => setModal(null)}
              >
                CLOSE ✕
              </button>
            </div>
            <h2 className="cm-doss-title">{modalNode.label}</h2>
            <div className="cm-doss-ev-h">◆ SOURCE · {modalNode.evidence?.length ?? 0} SEGMENTS</div>
            <div className="cm-doss-ev">
              {SEGMENTS.filter(s => modalNode.evidence?.includes(s.id)).map(seg => (
                <Segment
                  key={seg.id}
                  seg={seg}
                  on={false}
                  compact
                />
              ))}
            </div>
            <div className="cm-doss-actions">
              {AGENT_ACTIONS.slice(0, 3).map(a => (
                <button
                  key={a.label}
                  type="button"
                >
                  <span className="cm-ability-icon">{a.icon}</span>
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

function Hud ({ id, title, pos, accent, onExpand, children }: { id: Panel; title: string; pos: string; accent?: 'amber'; onExpand: (p: Panel) => void; children: React.ReactNode }) {
  return (
    <section className={`cm-panel ${pos}${accent === 'amber' ? ' cm-panel-amber' : ''}`}>
      <button
        type="button"
        className="cm-panel-bar"
        onClick={() => onExpand(id)}
      >
        <span className="cm-panel-led" />
        <span className="cm-panel-title">{title}</span>
        <span className="cm-panel-exp">⊕</span>
      </button>
      <div className="cm-panel-body">{children}</div>
    </section>
  );
}

function Group ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="cm-group">
      <div className="cm-group-h">{label}</div>
      {children}
    </div>
  );
}

function ObjCard ({ kind, text, sub, evidence, provisional }: { kind: string; text: string; sub?: string; evidence: number; provisional?: boolean }) {
  return (
    <div className={`cm-objcard cm-objcard-${kind}`}>
      <span className="cm-objcard-glyph">{KIND_GLYPH[kind]}</span>
      <div className="cm-objcard-body">
        <span className="cm-objcard-text">{text}</span>
        {sub && <span className="cm-objcard-sub">{sub}</span>}
      </div>
      <span className="cm-objcard-ev">◆{evidence}</span>
      {provisional && <span className="cm-obj-new">NEW</span>}
    </div>
  );
}

function Segment ({ seg, on, compact }: { seg: MockSegment; on: boolean; compact?: boolean }) {
  return (
    <div
      data-seg={seg.id}
      data-on={on || undefined}
      className={`cm-seg${seg.bot ? ' cm-seg-bot' : ''}${seg.interim ? ' cm-seg-interim' : ''}${compact ? ' cm-seg-compact' : ''}`}
    >
      <div className="cm-seg-head">
        <span
          className="cm-seg-name"
          style={{ color: speakerColor(seg.speakerId) }}
        >
          {seg.speaker}
        </span>
        <span className="cm-seg-time">{offset(seg.t)}</span>
      </div>
      <p className="cm-seg-text">{seg.text}{seg.interim && <span className="cm-feed-caret" />}</p>
    </div>
  );
}

const CSS = `
.cm-root {
  --cm-field: oklch(0.14 0.012 250);
  --cm-panel: oklch(0.18 0.014 250 / 0.82);
  --cm-raised: oklch(0.22 0.016 250);
  --cm-line: oklch(0.84 0.12 205 / 0.22);
  --cm-cyan: oklch(0.84 0.12 205);
  --cm-amber: oklch(0.82 0.15 75);
  --cm-ink-strong: oklch(0.96 0.01 230);
  --cm-ink: oklch(0.8 0.015 230);
  --cm-ink-muted: oklch(0.6 0.02 230);
  --cm-ink-faint: oklch(0.46 0.02 230);
  --cm-decision: oklch(0.82 0.15 75);
  --cm-action: oklch(0.8 0.16 150);
  --cm-question: oklch(0.78 0.13 285);
  --cm-topic: oklch(0.9 0.01 230);
  --cm-outcome: oklch(0.6 0.02 250);

  position: absolute; inset: 0; overflow: hidden;
  font-family: var(--font-hanken), system-ui, sans-serif;
  color: var(--cm-ink); background: var(--cm-field);
}
.cm-root button { font-family: inherit; }

/* world / field */
.cm-field { position: absolute; inset: 44px 0 0 0; background-image: linear-gradient(oklch(0.84 0.12 205 / 0.05) 1px, transparent 1px), linear-gradient(90deg, oklch(0.84 0.12 205 / 0.05) 1px, transparent 1px); background-size: 40px 40px; background-position: center; }
.cm-scan { position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, transparent 0 3px, oklch(0 0 0 / 0.12) 3px 4px); opacity: 0.5; z-index: 2; }
.cm-reticle { position: absolute; left: 50%; top: 50%; width: 26px; height: 26px; transform: translate(-50%,-50%); pointer-events: none; z-index: 2; opacity: 0.3; background: linear-gradient(var(--cm-cyan), var(--cm-cyan)) center/100% 1px no-repeat, linear-gradient(var(--cm-cyan), var(--cm-cyan)) center/1px 100% no-repeat; border: 1px solid var(--cm-line); border-radius: 50%; }
.cm-stage { position: absolute; inset: 0; z-index: 1; }
.cm-edges { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.cm-edge { fill: none; stroke: var(--cm-line); stroke-width: 1.3; }
.cm-edge-live { stroke: oklch(0.82 0.15 75 / 0.55); stroke-dasharray: 4 4; animation: cm-flow 22s linear infinite; }
@keyframes cm-flow { to { stroke-dashoffset: -200; } }

.cm-node {
  position: absolute; transform: translate(-50%, -50%); text-align: left;
  display: flex; flex-direction: column; gap: 5px; padding: 9px 12px;
  background: oklch(0.17 0.014 250 / 0.92); border: 1px solid oklch(0.84 0.12 205 / 0.3);
  cursor: pointer; transition: border-color 160ms, box-shadow 200ms, transform 140ms;
  clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px));
}
.cm-node:hover { transform: translate(-50%, -50%) translateY(-2px); border-color: var(--cm-cyan); box-shadow: 0 0 22px -6px var(--cm-cyan); z-index: 4; }
.cm-node-kind { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 8.5px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; }
.cm-node-glyph { font-size: 10px; }
.cm-node-label { font-size: 12.5px; line-height: 1.3; color: var(--cm-ink-strong); font-weight: 500; }
.cm-node-tag { color: var(--cm-amber); font-size: 8px; animation: cm-blink 1.4s steps(2) infinite; }
@keyframes cm-blink { 50% { opacity: 0.3; } }
.cm-topic { border-color: oklch(0.9 0.01 230 / 0.3); }
.cm-topic .cm-node-kind { color: var(--cm-topic); }
.cm-decision .cm-node-kind { color: var(--cm-decision); }
.cm-action .cm-node-kind { color: var(--cm-action); }
.cm-question .cm-node-kind { color: var(--cm-question); }
.cm-outcome { background: oklch(0.16 0.012 250 / 0.85); }
.cm-outcome .cm-node-kind { color: var(--cm-outcome); }
.cm-node-live { border-color: var(--cm-amber); box-shadow: 0 0 26px -8px var(--cm-amber); }
.cm-node-sel { border-color: var(--cm-cyan); box-shadow: 0 0 0 1px var(--cm-cyan), 0 0 30px -6px var(--cm-cyan); }
.cm-node-bracket { position: absolute; width: 7px; height: 7px; border: 1.5px solid var(--cm-cyan); opacity: 0; transition: opacity 160ms; }
.cm-node:hover .cm-node-bracket, .cm-node-sel .cm-node-bracket, .cm-node-live .cm-node-bracket { opacity: 0.9; }
.cm-node-live .cm-node-bracket { border-color: var(--cm-amber); }
.cm-tl { top: -3px; left: -3px; border-right: 0; border-bottom: 0; }
.cm-tr { top: -3px; right: -3px; border-left: 0; border-bottom: 0; }
.cm-bl { bottom: -3px; left: -3px; border-right: 0; border-top: 0; }
.cm-br { bottom: -3px; right: -3px; border-left: 0; border-top: 0; }
.cm-node-focus { position: absolute; top: -8px; right: -8px; width: 17px; height: 17px; border-radius: 50%; background: var(--c); color: oklch(0.14 0.012 250); font-size: 8px; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 1.5px solid var(--cm-field); }

.cm-cursor { position: absolute; pointer-events: none; z-index: 6; transition: left 2s ease, top 2s ease; }
.cm-cursor-name { position: absolute; left: 13px; top: 11px; white-space: nowrap; font-family: var(--font-mono); font-size: 9.5px; font-weight: 600; color: oklch(0.14 0.012 250); background: var(--c); padding: 1px 5px; }

.cm-frame { position: absolute; width: 22px; height: 22px; border: 1.5px solid var(--cm-line); pointer-events: none; z-index: 3; }
.cm-frame-tl { top: 10px; left: 10px; border-right: 0; border-bottom: 0; }
.cm-frame-tr { top: 10px; right: 10px; border-left: 0; border-bottom: 0; }
.cm-frame-bl { bottom: 10px; left: 10px; border-right: 0; border-top: 0; }
.cm-frame-br { bottom: 10px; right: 10px; border-left: 0; border-top: 0; }

/* status bar */
.cm-status { position: absolute; top: 0; left: 0; right: 0; height: 44px; display: flex; align-items: center; gap: 18px; padding: 0 16px; background: oklch(0.16 0.014 250 / 0.92); border-bottom: 1px solid var(--cm-line); backdrop-filter: blur(8px); z-index: 10; font-family: var(--font-mono); }
.cm-back { font-size: 11px; letter-spacing: 0.1em; color: var(--cm-ink-muted); text-decoration: none; transition: color 150ms; }
.cm-back:hover { color: var(--cm-cyan); }
.cm-sys { font-size: 12.5px; font-weight: 700; letter-spacing: 0.1em; color: var(--cm-ink-strong); }
.cm-readout { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; letter-spacing: 0.08em; color: var(--cm-cyan); }
.cm-readout.cm-dim { color: var(--cm-ink-faint); }
.cm-blip { width: 7px; height: 7px; border-radius: 50%; background: var(--cm-amber); box-shadow: 0 0 8px var(--cm-amber); animation: cm-pulse 1.6s ease-in-out infinite; }
@keyframes cm-pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
.cm-squad { margin-left: auto; display: flex; align-items: center; gap: 4px; }
.cm-pawn { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; font-size: 9px; font-weight: 700; color: oklch(0.14 0.012 250); background: var(--c); clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px)); }
.cm-pawn-you { background: var(--cm-raised); color: var(--cm-ink); }
.cm-pawn-live { box-shadow: 0 0 0 1.5px var(--c), 0 0 12px -2px var(--c); animation: cm-pulse 1.4s ease-in-out infinite; }

/* HUD panels */
.cm-panel { position: absolute; width: 300px; z-index: 5; background: var(--cm-panel); border: 1px solid var(--cm-line); backdrop-filter: blur(10px); clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px)); transition: border-color 160ms, box-shadow 200ms; }
.cm-panel:hover { border-color: var(--cm-cyan); box-shadow: 0 0 26px -8px var(--cm-cyan), inset 0 0 30px -20px var(--cm-cyan); }
.cm-panel-amber:hover { border-color: var(--cm-amber); box-shadow: 0 0 26px -8px var(--cm-amber); }
.cm-at-tl { top: 60px; left: 16px; }
.cm-at-bl { bottom: 16px; left: 16px; width: 340px; }
.cm-at-br { bottom: 16px; right: 16px; width: 312px; }
.cm-panel-bar { display: flex; align-items: center; gap: 9px; width: 100%; padding: 9px 12px; background: oklch(0.84 0.12 205 / 0.07); border: 0; border-bottom: 1px solid var(--cm-line); cursor: pointer; text-align: left; }
.cm-panel-amber .cm-panel-bar { background: oklch(0.82 0.15 75 / 0.08); }
.cm-panel-led { width: 6px; height: 6px; border-radius: 50%; background: var(--cm-cyan); box-shadow: 0 0 8px var(--cm-cyan); }
.cm-panel-amber .cm-panel-led { background: var(--cm-amber); box-shadow: 0 0 8px var(--cm-amber); }
.cm-panel-title { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.14em; font-weight: 600; color: var(--cm-ink-strong); }
.cm-panel-exp { margin-left: auto; color: var(--cm-ink-faint); font-size: 13px; transition: color 150ms; }
.cm-panel-bar:hover .cm-panel-exp { color: var(--cm-cyan); }
.cm-panel-body { padding: 11px 12px; }

/* objectives compact */
.cm-obj-list { display: flex; flex-direction: column; gap: 8px; }
.cm-obj { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; line-height: 1.35; }
.cm-obj-glyph { flex-shrink: 0; font-size: 11px; margin-top: 1px; }
.cm-obj-decision .cm-obj-glyph { color: var(--cm-decision); }
.cm-obj-action .cm-obj-glyph { color: var(--cm-action); }
.cm-obj-text { color: var(--cm-ink); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.cm-obj-new { flex-shrink: 0; font-family: var(--font-mono); font-size: 8px; font-weight: 700; letter-spacing: 0.1em; color: var(--cm-field); background: var(--cm-amber); padding: 1px 5px; margin-left: auto; }

/* comms feed */
.cm-feed { display: flex; flex-direction: column; gap: 7px; max-height: 180px; overflow: hidden; }
.cm-feed-line { font-size: 12px; line-height: 1.4; }
.cm-feed-name { font-family: var(--font-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.04em; margin-right: 7px; }
.cm-feed-text { color: var(--cm-ink-muted); }
.cm-feed-interim .cm-feed-text { color: var(--cm-ink-faint); font-style: italic; }
.cm-feed-caret { display: inline-block; width: 8px; height: 1px; background: var(--cm-amber); margin-left: 3px; vertical-align: middle; animation: cm-write 1.2s ease-in-out infinite; }
@keyframes cm-write { 0%,100% { width: 4px; opacity: 0.4; } 50% { width: 10px; opacity: 0.9; } }

/* peace panel */
.cm-peace-status { display: flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.06em; color: var(--cm-ink-muted); padding-bottom: 10px; border-bottom: 1px solid var(--cm-line); margin-bottom: 10px; }
.cm-peace-core { color: var(--cm-amber); font-size: 13px; }
.cm-peace-sug { margin-left: auto; font-size: 9px; font-weight: 700; color: var(--cm-field); background: var(--cm-amber); width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
.cm-abilities { display: flex; flex-direction: column; gap: 6px; }
.cm-ability { display: flex; align-items: center; gap: 8px; text-align: left; font-size: 11.5px; color: var(--cm-ink); background: oklch(0.84 0.12 205 / 0.05); border: 1px solid var(--cm-line); padding: 7px 10px; cursor: pointer; transition: all 140ms; clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px)); }
.cm-ability:hover { background: oklch(0.82 0.15 75 / 0.12); border-color: var(--cm-amber); color: var(--cm-ink-strong); }
.cm-ability-icon { color: var(--cm-amber); }
.cm-ability-hint { margin-left: auto; font-family: var(--font-mono); font-size: 9px; color: var(--cm-ink-faint); }

/* overlay + expanded */
.cm-overlay { position: absolute; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; padding: 60px; background: oklch(0.1 0.01 250 / 0.66); backdrop-filter: blur(2px); animation: cm-fade 160ms ease; }
@keyframes cm-fade { from { opacity: 0; } }
.cm-expanded { width: min(760px, 100%); max-height: 80%; display: flex; flex-direction: column; background: oklch(0.17 0.014 250 / 0.98); border: 1px solid var(--cm-cyan); box-shadow: 0 0 60px -20px var(--cm-cyan); clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px)); animation: cm-grow 280ms cubic-bezier(0.2,0,0,1); }
.cm-exp-peace { border-color: var(--cm-amber); box-shadow: 0 0 60px -20px var(--cm-amber); }
@keyframes cm-grow { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
.cm-exp-bar { display: flex; align-items: center; justify-content: space-between; padding: 13px 18px; border-bottom: 1px solid var(--cm-line); background: oklch(0.84 0.12 205 / 0.06); }
.cm-exp-peace .cm-exp-bar { background: oklch(0.82 0.15 75 / 0.07); }
.cm-exp-title { font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.14em; font-weight: 700; color: var(--cm-ink-strong); }
.cm-dock { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.1em; color: var(--cm-cyan); background: transparent; border: 1px solid var(--cm-line); padding: 5px 11px; cursor: pointer; transition: all 140ms; }
.cm-dock:hover { border-color: var(--cm-cyan); background: oklch(0.84 0.12 205 / 0.1); }
.cm-exp-body { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 18px; }

.cm-transcript { display: flex; flex-direction: column; gap: 3px; }
.cm-seg { padding: 8px 11px; border-left: 2px solid transparent; transition: background 160ms, border-color 160ms; }
.cm-seg[data-on] { background: oklch(0.84 0.12 205 / 0.1); border-left-color: var(--cm-cyan); }
.cm-seg-compact { padding: 7px 0; }
.cm-seg-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 2px; }
.cm-seg-name { font-family: var(--font-mono); font-size: 11px; font-weight: 700; }
.cm-seg-time { font-family: var(--font-mono); font-size: 9.5px; color: var(--cm-ink-faint); }
.cm-seg-text { font-size: 13.5px; line-height: 1.5; color: var(--cm-ink); }
.cm-seg-bot .cm-seg-text { color: var(--cm-ink-muted); font-style: italic; }
.cm-seg-interim .cm-seg-text { color: var(--cm-ink-faint); font-style: italic; }

.cm-obj-full { display: flex; flex-direction: column; gap: 18px; }
.cm-group-h { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--cm-cyan); margin-bottom: 9px; }
.cm-objcard { display: flex; align-items: flex-start; gap: 10px; padding: 11px 13px; margin-bottom: 7px; background: oklch(0.2 0.014 250 / 0.7); border: 1px solid var(--cm-line); clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)); }
.cm-objcard-glyph { flex-shrink: 0; margin-top: 1px; }
.cm-objcard-decision .cm-objcard-glyph { color: var(--cm-decision); }
.cm-objcard-action .cm-objcard-glyph { color: var(--cm-action); }
.cm-objcard-question .cm-objcard-glyph { color: var(--cm-question); }
.cm-objcard-body { flex: 1; }
.cm-objcard-text { font-size: 13.5px; line-height: 1.4; color: var(--cm-ink-strong); display: block; }
.cm-objcard-sub { font-size: 11.5px; color: var(--cm-ink-muted); margin-top: 3px; display: block; }
.cm-objcard-ev { font-family: var(--font-mono); font-size: 10px; color: var(--cm-cyan); flex-shrink: 0; }

.cm-console { display: flex; flex-direction: column; gap: 14px; }
.cm-thread { display: flex; flex-direction: column; gap: 8px; }
.cm-turn { font-size: 13px; line-height: 1.5; padding: 10px 13px; max-width: 88%; clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)); }
.cm-turn-user { align-self: flex-end; background: var(--cm-raised); color: var(--cm-ink); }
.cm-turn-peace { align-self: flex-start; background: oklch(0.82 0.15 75 / 0.1); border: 1px solid oklch(0.82 0.15 75 / 0.25); color: var(--cm-ink-strong); }
.cm-thread-actions { display: flex; gap: 7px; }
.cm-go { font-size: 12px; font-weight: 600; color: var(--cm-field); background: var(--cm-amber); border: 0; padding: 7px 13px; cursor: pointer; clip-path: polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 7px 100%, 0 calc(100% - 7px)); }
.cm-go-ghost { background: transparent; color: var(--cm-ink-muted); border: 1px solid var(--cm-line); }
.cm-ability-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.cm-cmdline { display: flex; align-items: center; gap: 9px; padding: 11px 13px; background: oklch(0.13 0.012 250); border: 1px solid oklch(0.82 0.15 75 / 0.3); }
.cm-cmd-pr { font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--cm-amber); }
.cm-cmd-ph { flex: 1; font-family: var(--font-mono); font-size: 12px; color: var(--cm-ink-faint); }
.cm-cmd-key { font-family: var(--font-mono); font-size: 10.5px; color: var(--cm-ink-faint); border: 1px solid var(--cm-line); padding: 1px 5px; }

/* node dossier */
.cm-dossier { position: relative; width: min(540px, 100%); max-height: 80%; display: flex; flex-direction: column; background: oklch(0.17 0.014 250 / 0.98); border: 1px solid var(--cm-cyan); box-shadow: 0 0 60px -20px var(--cm-cyan); clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px)); animation: cm-grow 260ms cubic-bezier(0.2,0,0,1); }
.cm-doss-decision { border-color: var(--cm-decision); box-shadow: 0 0 60px -20px var(--cm-decision); }
.cm-doss-action { border-color: var(--cm-action); box-shadow: 0 0 60px -20px var(--cm-action); }
.cm-doss-question { border-color: var(--cm-question); box-shadow: 0 0 60px -20px var(--cm-question); }
.cm-doss-bracket { position: absolute; width: 12px; height: 12px; border: 2px solid var(--cm-cyan); z-index: 2; }
.cm-doss-decision .cm-doss-bracket { border-color: var(--cm-decision); }
.cm-doss-action .cm-doss-bracket { border-color: var(--cm-action); }
.cm-doss-question .cm-doss-bracket { border-color: var(--cm-question); }
.cm-doss-bar { display: flex; align-items: center; justify-content: space-between; padding: 13px 18px; border-bottom: 1px solid var(--cm-line); }
.cm-doss-kind { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; color: var(--cm-cyan); }
.cm-doss-decision .cm-doss-kind { color: var(--cm-decision); }
.cm-doss-action .cm-doss-kind { color: var(--cm-action); }
.cm-doss-question .cm-doss-kind { color: var(--cm-question); }
.cm-doss-title { font-size: 21px; line-height: 1.3; font-weight: 600; color: var(--cm-ink-strong); padding: 14px 18px 12px; }
.cm-doss-ev-h { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em; color: var(--cm-cyan); padding: 0 18px 8px; }
.cm-doss-ev { overflow-y: auto; padding: 0 18px; border-top: 1px solid var(--cm-line); border-bottom: 1px solid var(--cm-line); }
.cm-doss-actions { display: flex; gap: 8px; padding: 14px 18px; flex-wrap: wrap; }
.cm-doss-actions button { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 500; color: var(--cm-ink); background: oklch(0.84 0.12 205 / 0.06); border: 1px solid var(--cm-line); padding: 9px 13px; cursor: pointer; transition: all 140ms; clip-path: polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 7px 100%, 0 calc(100% - 7px)); }
.cm-doss-actions button:hover { border-color: var(--cm-cyan); background: oklch(0.84 0.12 205 / 0.12); color: var(--cm-ink-strong); }
`;
