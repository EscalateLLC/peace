'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useEvidenceHighlight } from '../_shared';
import {
  AGENT_ACTIONS,
  COLLABORATORS,
  EDGES,
  MEETING,
  NODES,
  SEGMENTS,
  offset,
  speakerSlot,
  type MapNode
} from '../_data';

/* WORKSPACE — Approach 1: "Atlas" (canvas-first).
 * The diagram IS the workspace. The conversation organizes itself into a living
 * node-map; everything else floats over it: remote cursors (multiplayer), a
 * collapsible transcript dock (source/evidence), and a peace command bar to
 * talk to the bot or dispatch AI actions. Click a node → its evidence + the
 * actions you can run on it. The structure forming in real time is the hero. */

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

export default function Atlas () {
  const { highlighted, highlight, clear, containerRef } = useEvidenceHighlight();
  const [selected, setSelected] = useState<string | null>('d2');
  const [dockOpen, setDockOpen] = useState(true);

  const selectNode = (node: MapNode) => {
    setSelected(node.id);
    highlight(node.evidence ?? []);

    if (!dockOpen) {
      setDockOpen(true);
    }
  };

  const selectedNode = useMemo(() => NODES.find(n => n.id === selected) ?? null, [selected]);

  return (
    <div className="at-root">
      <style>{CSS}</style>

      <header className="at-bar">
        <Link
          href="/mockups"
          className="at-back"
        >
          ←
        </Link>
        <div className="at-ws">
          <span className="at-ws-icon">◇</span>
          <div>
            <div className="at-ws-name">{MEETING.title}</div>
            <div className="at-ws-sub">live workspace</div>
          </div>
        </div>
        <span className="at-live"><span className="at-live-dot" />live · {MEETING.elapsed}</span>

        <div className="at-people">
          {COLLABORATORS.map(person => (
            <span
              key={person.id}
              className={`at-avatar${person.you ? ' at-avatar-you' : ''}`}
              style={{ '--c': person.color } as React.CSSProperties}
              title={person.name + (person.speaking ? ' · speaking' : '')}
            >
              {person.short}
              {person.speaking && <span className="at-av-speak" />}
            </span>
          ))}
          <button
            type="button"
            className="at-share"
          >
            Share
          </button>
        </div>
      </header>

      <div className="at-field">
        {/* the canvas — the conversation's structure, forming live */}
        <div className="at-stage">
          <svg
            className="at-edges"
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
                  className={`at-edge${live ? ' at-edge-live' : ''}`}
                  d={`M${a.x} ${a.y} C${a.x} ${a.y + dy} ${b.x} ${b.y - dy} ${b.x} ${b.y}`}
                />
              );
            })}
          </svg>

          {NODES.map(node => (
            <button
              key={node.id}
              type="button"
              className={`at-node at-${node.kind}${node.provisional ? ' at-node-new' : ''}${selected === node.id ? ' at-node-sel' : ''}`}
              style={{
                left : `${node.x / 980 * 100}%`,
                top  : `${node.y / 640 * 100}%`,
                width: `${node.w / 980 * 100}%`
              }}
              onClick={() => selectNode(node)}
            >
              <span className="at-node-kind">{node.kind}</span>
              <span className="at-node-label">{node.label}</span>
              {node.provisional && <span className="at-node-pulse" />}
              {COLLABORATORS.filter(p => p.focus === node.id).map(p => (
                <span
                  key={p.id}
                  className="at-node-focus"
                  style={{ '--c': p.color } as React.CSSProperties}
                  title={`${p.name} is here`}
                />
              ))}
            </button>
          ))}

          {/* multiplayer cursors */}
          {COLLABORATORS.filter(p => p.cursor).map(p => (
            <div
              key={p.id}
              className="at-cursor"
              style={{
                left : `${p.cursor!.x / 980 * 100}%`,
                top  : `${p.cursor!.y / 640 * 100}%`,
                '--c': p.color
              } as React.CSSProperties}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
              >
                <path
                  d="M2 2 L2 14 L6 10 L9 16 L11 15 L8 9 L14 9 Z"
                  fill="var(--c)"
                  stroke="white"
                  strokeWidth="1"
                />
              </svg>
              <span className="at-cursor-name">{p.name.split(' ')[0]}</span>
            </div>
          ))}

          {/* node inspector — evidence + actions you can run */}
          {selectedNode && (
            <div
              className="at-inspector"
              style={{
                left: `${selectedNode.x / 980 * 100}%`,
                top : `${selectedNode.y / 640 * 100}%`
              }}
            >
              <div className="at-insp-kind">{selectedNode.kind}</div>
              <div className="at-insp-label">{selectedNode.label}</div>
              <div className="at-insp-evidence">
                <span className="at-insp-ev-count">◆ {selectedNode.evidence?.length ?? 0} cited</span>
                grounded in transcript →
              </div>
              <div className="at-insp-actions">
                <button type="button">◆ Make a ticket</button>
                <button type="button">✉ Draft from this</button>
                <button type="button">✨ Ask peace…</button>
              </div>
            </div>
          )}

          <div className="at-zoom">
            <button type="button">+</button>
            <button type="button">−</button>
            <span className="at-zoom-pct">100%</span>
          </div>
        </div>

        {/* transcript dock — source / evidence, collapsible */}
        <aside className={`at-dock${dockOpen ? ' at-dock-open' : ''}`}>
          <button
            type="button"
            className="at-dock-tab"
            onClick={() => setDockOpen(v => !v)}
          >
            {dockOpen ? '⟨' : '⟩'} transcript
          </button>
          {dockOpen && (
            <div
              className="at-dock-body"
              ref={containerRef}
              onClick={event => {
                if (!(event.target instanceof Element) || !event.target.closest('[data-seg]')) {
                  clear();
                }
              }}
            >
              <div className="at-dock-head">
                <span className="at-dock-rec" />
                Source · live transcript
              </div>
              {SEGMENTS.map(seg => (
                <div
                  key={seg.id}
                  data-seg={seg.id}
                  data-on={highlighted.has(seg.id) || undefined}
                  className={`at-seg${seg.bot ? ' at-seg-bot' : ''}${seg.interim ? ' at-seg-interim' : ''}`}
                >
                  <div className="at-seg-head">
                    <span
                      className="at-seg-name"
                      style={{ color: speakerColor(seg.speakerId) }}
                    >
                      {seg.speaker}
                    </span>
                    <span className="at-seg-time">{offset(seg.t)}</span>
                  </div>
                  <p className="at-seg-text">{seg.text}{seg.interim && <span className="at-seg-caret" />}</p>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* peace command bar — talk to the bot / run AI actions */}
        <div className="at-command">
          <div className="at-cmd-input">
            <span className="at-cmd-peace">✦ peace</span>
            <span className="at-cmd-placeholder">Ask anything, or run an action on the workspace…</span>
            <span className="at-cmd-key">⏎</span>
          </div>
          <div className="at-cmd-chips">
            {AGENT_ACTIONS.map(action => (
              <button
                key={action.label}
                type="button"
                className="at-chip"
              >
                <span className="at-chip-icon">{action.icon}</span>
                {action.label}
                {action.hint && <span className="at-chip-hint">{action.hint}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.at-root {
  --at-field: oklch(0.16 0.008 260);
  --at-panel: oklch(0.205 0.009 260);
  --at-raised: oklch(0.245 0.01 260);
  --at-hair: oklch(1 0 0 / 0.08);
  --at-ink-strong: oklch(0.95 0.006 260);
  --at-ink: oklch(0.8 0.008 260);
  --at-ink-muted: oklch(0.6 0.01 260);
  --at-ink-faint: oklch(0.46 0.01 260);
  --at-accent: oklch(0.79 0.14 72);
  --at-decision: oklch(0.79 0.14 72);
  --at-action: oklch(0.74 0.13 152);
  --at-question: oklch(0.74 0.13 230);
  --at-topic: oklch(0.86 0.01 260);
  --at-outcome: oklch(0.62 0.02 260);

  position: absolute; inset: 0; display: flex; flex-direction: column;
  font-family: var(--font-hanken), system-ui, sans-serif;
  color: var(--at-ink);
  background: var(--at-field);
}

/* top bar */
.at-bar { display: flex; align-items: center; gap: 16px; height: 54px; padding: 0 18px; flex-shrink: 0; border-bottom: 1px solid var(--at-hair); background: oklch(0.18 0.008 260 / 0.8); backdrop-filter: blur(10px); z-index: 10; }
.at-back { width: 30px; height: 30px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; color: var(--at-ink-muted); text-decoration: none; border: 1px solid var(--at-hair); transition: all 150ms; }
.at-back:hover { color: var(--at-accent); border-color: var(--at-accent); }
.at-ws { display: flex; align-items: center; gap: 10px; }
.at-ws-icon { color: var(--at-accent); font-size: 16px; }
.at-ws-name { font-family: var(--font-fraunces), serif; font-size: 15px; font-weight: 600; color: var(--at-ink-strong); }
.at-ws-sub { font-size: 10.5px; color: var(--at-ink-faint); letter-spacing: 0.04em; }
.at-live { display: inline-flex; align-items: center; gap: 7px; font-size: 11.5px; color: var(--at-ink-muted); }
.at-live-dot { width: 7px; height: 7px; border-radius: 50%; background: oklch(0.74 0.13 152); box-shadow: 0 0 8px oklch(0.74 0.13 152); animation: at-pulse 2s ease-in-out infinite; }
@keyframes at-pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
.at-people { margin-left: auto; display: flex; align-items: center; gap: 0; }
.at-avatar { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; margin-left: -7px; border-radius: 50%; font-size: 10px; font-weight: 700; color: oklch(0.16 0.01 260); background: var(--c); border: 2px solid var(--at-field); letter-spacing: 0.02em; }
.at-avatar-you { background: var(--at-raised); color: var(--at-ink); }
.at-av-speak { position: absolute; inset: -2px; border-radius: 50%; border: 2px solid var(--c); animation: at-speak 1.2s ease-in-out infinite; }
@keyframes at-speak { 0%,100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 1; transform: scale(1.12); } }
.at-share { margin-left: 14px; font-family: inherit; font-size: 12px; font-weight: 600; color: var(--at-field); background: var(--at-accent); border: 0; border-radius: 8px; padding: 7px 14px; cursor: pointer; }

/* field + stage */
.at-field {
  position: relative; flex: 1; min-height: 0; overflow: hidden;
  background-image: radial-gradient(oklch(1 0 0 / 0.05) 1px, transparent 1px);
  background-size: 26px 26px; background-position: center;
}
.at-stage { position: absolute; inset: 24px 24px 96px 24px; }
.at-edges { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.at-edge { fill: none; stroke: oklch(0.6 0.02 260 / 0.5); stroke-width: 1.5; }
.at-edge-live { stroke: oklch(0.79 0.14 72 / 0.6); stroke-dasharray: 5 4; animation: at-flow 26s linear infinite, at-draw 900ms ease-out; }
@keyframes at-flow { to { stroke-dashoffset: -200; } }
@keyframes at-draw { from { stroke-dashoffset: 220; } }

.at-node {
  position: absolute; transform: translate(-50%, -50%); text-align: left;
  display: flex; flex-direction: column; gap: 5px;
  padding: 11px 13px; border-radius: 13px; cursor: pointer;
  background: var(--at-panel); border: 1px solid var(--at-hair);
  box-shadow: 0 6px 20px -10px oklch(0 0 0 / 0.6);
  transition: transform 140ms, box-shadow 200ms, border-color 200ms;
  font-family: inherit;
}
.at-node:hover { transform: translate(-50%, -50%) translateY(-2px); border-color: oklch(1 0 0 / 0.2); }
.at-node-kind { font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700; }
.at-node-label { font-size: 13px; line-height: 1.32; color: var(--at-ink-strong); font-weight: 500; }
.at-topic { border-color: oklch(0.86 0.01 260 / 0.3); }
.at-topic .at-node-kind { color: var(--at-topic); }
.at-decision .at-node-kind { color: var(--at-decision); }
.at-decision { border-left: 3px solid var(--at-decision); }
.at-action .at-node-kind { color: var(--at-action); }
.at-action { border-left: 3px solid var(--at-action); }
.at-question .at-node-kind { color: var(--at-question); }
.at-question { border-left: 3px solid var(--at-question); }
.at-outcome { background: oklch(0.2 0.008 260 / 0.7); }
.at-outcome .at-node-kind { color: var(--at-outcome); }
.at-node-sel { border-color: var(--at-accent); box-shadow: 0 0 0 1px var(--at-accent), 0 10px 30px -12px oklch(0 0 0 / 0.7); }
.at-node-new { animation: at-arrive 800ms cubic-bezier(0.2,0,0,1) both; }
@keyframes at-arrive { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); box-shadow: 0 0 40px oklch(0.79 0.14 72 / 0.4); } 100% { opacity: 1; } }
.at-node-pulse { position: absolute; top: 10px; right: 11px; width: 6px; height: 6px; border-radius: 50%; background: var(--at-accent); box-shadow: 0 0 0 0 oklch(0.79 0.14 72 / 0.5); animation: at-np 1.8s ease-out infinite; }
@keyframes at-np { 0% { box-shadow: 0 0 0 0 oklch(0.79 0.14 72 / 0.5); } 100% { box-shadow: 0 0 0 9px transparent; } }
.at-node-focus { position: absolute; inset: -3px; border-radius: 14px; border: 1.5px solid var(--c); pointer-events: none; }

.at-cursor { position: absolute; transform: translate(-2px, -2px); pointer-events: none; z-index: 8; transition: left 2s ease, top 2s ease; }
.at-cursor-name { position: absolute; left: 14px; top: 12px; white-space: nowrap; font-size: 10.5px; font-weight: 600; color: oklch(0.16 0.01 260); background: var(--c); padding: 1px 6px; border-radius: 4px 9px 9px 9px; }

.at-inspector {
  position: absolute; transform: translate(calc(-50% + 150px), 14px); width: 248px; z-index: 9;
  padding: 14px; border-radius: 13px; background: oklch(0.22 0.009 260 / 0.96);
  border: 1px solid var(--at-hair); box-shadow: 0 20px 50px -20px oklch(0 0 0 / 0.8); backdrop-filter: blur(12px);
  animation: at-pop 200ms ease both;
}
@keyframes at-pop { from { opacity: 0; transform: translate(calc(-50% + 150px), 22px); } }
.at-insp-kind { font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700; color: var(--at-accent); }
.at-insp-label { font-size: 14px; line-height: 1.35; color: var(--at-ink-strong); font-weight: 600; margin: 7px 0 10px; }
.at-insp-evidence { font-size: 11px; color: var(--at-ink-muted); display: flex; flex-direction: column; gap: 3px; padding-bottom: 11px; margin-bottom: 11px; border-bottom: 1px solid var(--at-hair); }
.at-insp-ev-count { color: var(--at-accent); font-weight: 600; }
.at-insp-actions { display: flex; flex-direction: column; gap: 5px; }
.at-insp-actions button { text-align: left; font-family: inherit; font-size: 12px; color: var(--at-ink); background: oklch(1 0 0 / 0.04); border: 1px solid var(--at-hair); border-radius: 8px; padding: 7px 10px; cursor: pointer; transition: all 140ms; }
.at-insp-actions button:hover { background: oklch(0.79 0.14 72 / 0.12); border-color: oklch(0.79 0.14 72 / 0.4); color: var(--at-ink-strong); }

.at-zoom { position: absolute; right: 0; bottom: 0; display: flex; align-items: center; gap: 4px; background: oklch(0.22 0.009 260 / 0.9); border: 1px solid var(--at-hair); border-radius: 9px; padding: 4px; }
.at-zoom button { width: 24px; height: 24px; border-radius: 6px; border: 0; background: transparent; color: var(--at-ink-muted); cursor: pointer; font-size: 15px; }
.at-zoom button:hover { background: oklch(1 0 0 / 0.06); color: var(--at-ink); }
.at-zoom-pct { font-size: 11px; color: var(--at-ink-faint); padding: 0 6px; font-variant-numeric: tabular-nums; }

/* transcript dock */
.at-dock { position: absolute; top: 24px; left: 24px; bottom: 96px; width: 44px; transition: width 220ms cubic-bezier(0.2,0,0,1); z-index: 7; }
.at-dock-open { width: 290px; }
.at-dock-tab { position: absolute; top: 0; left: 0; height: 34px; padding: 0 12px; font-family: inherit; font-size: 11px; letter-spacing: 0.04em; color: var(--at-ink-muted); background: oklch(0.22 0.009 260 / 0.92); border: 1px solid var(--at-hair); border-radius: 9px; cursor: pointer; z-index: 2; backdrop-filter: blur(10px); }
.at-dock-tab:hover { color: var(--at-ink-strong); }
.at-dock-body { position: absolute; inset: 42px 0 0 0; overflow-y: auto; padding: 8px; border-radius: 13px; background: oklch(0.19 0.008 260 / 0.92); border: 1px solid var(--at-hair); backdrop-filter: blur(12px); display: flex; flex-direction: column; gap: 2px; }
.at-dock-head { display: flex; align-items: center; gap: 7px; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--at-ink-faint); padding: 4px 6px 8px; }
.at-dock-rec { width: 6px; height: 6px; border-radius: 50%; background: oklch(0.74 0.13 152); animation: at-pulse 2s ease-in-out infinite; }
.at-seg { padding: 6px 8px; border-radius: 8px; transition: background 160ms; }
.at-seg[data-on] { background: oklch(0.79 0.14 72 / 0.14); box-shadow: inset 0 0 0 1px oklch(0.79 0.14 72 / 0.3); }
.at-seg-head { display: flex; align-items: baseline; gap: 7px; margin-bottom: 2px; }
.at-seg-name { font-size: 11.5px; font-weight: 600; }
.at-seg-time { font-family: var(--font-mono); font-size: 9.5px; color: var(--at-ink-faint); }
.at-seg-text { font-size: 12.5px; line-height: 1.45; color: var(--at-ink); }
.at-seg-bot .at-seg-text { color: var(--at-ink-muted); font-style: italic; }
.at-seg-interim .at-seg-text { color: var(--at-ink-faint); font-style: italic; }
.at-seg-caret { display: inline-block; width: 8px; height: 1px; background: var(--at-ink-faint); margin-left: 3px; vertical-align: middle; animation: at-write 1.2s ease-in-out infinite; }
@keyframes at-write { 0%,100% { width: 4px; opacity: 0.4; } 50% { width: 10px; opacity: 0.9; } }

/* command bar */
.at-command { position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%); width: min(680px, calc(100% - 64px)); z-index: 8; }
.at-cmd-input { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; background: oklch(0.23 0.01 260 / 0.95); border: 1px solid oklch(0.79 0.14 72 / 0.25); box-shadow: 0 20px 50px -20px oklch(0 0 0 / 0.8); backdrop-filter: blur(14px); }
.at-cmd-peace { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; color: var(--at-accent); flex-shrink: 0; }
.at-cmd-placeholder { flex: 1; font-size: 13.5px; color: var(--at-ink-faint); }
.at-cmd-key { font-family: var(--font-mono); font-size: 11px; color: var(--at-ink-faint); border: 1px solid var(--at-hair); border-radius: 5px; padding: 1px 6px; }
.at-cmd-chips { display: flex; gap: 7px; margin-top: 10px; justify-content: center; flex-wrap: wrap; }
.at-chip { display: inline-flex; align-items: center; gap: 6px; font-family: inherit; font-size: 11.5px; color: var(--at-ink); background: oklch(0.22 0.009 260 / 0.9); border: 1px solid var(--at-hair); border-radius: 999px; padding: 5px 12px; cursor: pointer; backdrop-filter: blur(10px); transition: all 150ms; }
.at-chip:hover { border-color: oklch(0.79 0.14 72 / 0.4); color: var(--at-ink-strong); }
.at-chip-icon { color: var(--at-accent); }
.at-chip-hint { font-size: 10px; color: var(--at-ink-faint); }
`;
