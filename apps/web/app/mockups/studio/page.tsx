'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
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
  type MapNode
} from '../_data';

/* WORKSPACE — Approach 2: "Studio" (structured cockpit).
 * Same living diagram as the hero — but framed as a mission-control workspace:
 * a presence + transcript rail on the left (who's here, the source), the
 * organizational canvas dominating the center, and a peace agent console on the
 * right where you converse with the bot and dispatch AI actions. Selecting a
 * node ties all three together: it highlights its evidence and loads its
 * actions. Docked and legible, where Atlas floats. */

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

export default function Studio () {
  const { highlighted, highlight, clear, containerRef } = useEvidenceHighlight();
  const [selected, setSelected] = useState<string | null>('d2');

  const selectNode = (node: MapNode) => {
    setSelected(node.id);
    highlight(node.evidence ?? []);
  };

  const selectedNode = useMemo(() => NODES.find(n => n.id === selected) ?? null, [selected]);
  const present = COLLABORATORS.filter(p => !p.you);

  return (
    <div className="su-root">
      <style>{CSS}</style>

      <header className="su-bar">
        <Link
          href="/mockups"
          className="su-back"
        >
          ←
        </Link>
        <span className="su-ws">
          <span className="su-ws-icon">◇</span>
          {MEETING.title}
        </span>
        <span className="su-live"><span className="su-live-dot" />live · {MEETING.elapsed}</span>
        <div className="su-people">
          {COLLABORATORS.map(p => (
            <span
              key={p.id}
              className={`su-avatar${p.you ? ' su-avatar-you' : ''}`}
              style={{ '--c': p.color } as React.CSSProperties}
              title={p.name}
            >
              {p.short}
            </span>
          ))}
          <button
            type="button"
            className="su-share"
          >
            Share
          </button>
        </div>
      </header>

      <div className="su-grid">
        {/* left — room: presence + source transcript */}
        <aside className="su-left">
          <div className="su-sec-h">In the room</div>
          <div className="su-presence">
            {present.map(p => (
              <div
                key={p.id}
                className="su-person"
              >
                <span
                  className="su-person-dot"
                  style={{ '--c': p.color } as React.CSSProperties}
                />
                <span className="su-person-name">{p.name}</span>
                {p.speaking && <span className="su-person-speak">speaking</span>}
              </div>
            ))}
          </div>

          <div className="su-sec-h su-sec-h-spaced">
            <span className="su-src-rec" />
            Source · transcript
          </div>
          <div
            className="su-transcript"
            ref={containerRef}
            onClick={event => {
              if (!(event.target instanceof Element) || !event.target.closest('[data-seg]')) {
                clear();
              }
            }}
          >
            {SEGMENTS.map(seg => (
              <div
                key={seg.id}
                data-seg={seg.id}
                data-on={highlighted.has(seg.id) || undefined}
                className={`su-seg${seg.bot ? ' su-seg-bot' : ''}${seg.interim ? ' su-seg-interim' : ''}`}
              >
                <div className="su-seg-head">
                  <span
                    className="su-seg-name"
                    style={{ color: speakerColor(seg.speakerId) }}
                  >
                    {seg.speaker}
                  </span>
                  <span className="su-seg-time">{offset(seg.t)}</span>
                </div>
                <p className="su-seg-text">{seg.text}{seg.interim && <span className="su-seg-caret" />}</p>
              </div>
            ))}
          </div>
        </aside>

        {/* center — the organizational canvas (hero) */}
        <main className="su-canvas">
          <div className="su-canvas-head">
            <span className="su-canvas-title">Organizing live</span>
            <span className="su-canvas-hint">click a node to see its evidence &amp; actions</span>
          </div>
          <div className="su-stage">
            <svg
              className="su-edges"
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
                    className={`su-edge${live ? ' su-edge-live' : ''}`}
                    d={`M${a.x} ${a.y} C${a.x} ${a.y + dy} ${b.x} ${b.y - dy} ${b.x} ${b.y}`}
                  />
                );
              })}
            </svg>

            {NODES.map(node => (
              <button
                key={node.id}
                type="button"
                className={`su-node su-${node.kind}${node.provisional ? ' su-node-new' : ''}${selected === node.id ? ' su-node-sel' : ''}`}
                style={{
                  left : `${node.x / 980 * 100}%`,
                  top  : `${node.y / 640 * 100}%`,
                  width: `${node.w / 980 * 100}%`
                }}
                onClick={() => selectNode(node)}
              >
                <span className="su-node-kind">{node.kind}</span>
                <span className="su-node-label">{node.label}</span>
                {node.provisional && <span className="su-node-pulse" />}
                {present.filter(p => p.focus === node.id).map(p => (
                  <span
                    key={p.id}
                    className="su-node-focus"
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
                className="su-cursor"
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
                <span className="su-cursor-name">{p.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </main>

        {/* right — peace: agent console + selected-node actions */}
        <aside className="su-right">
          <div className="su-sec-h">
            <span className="su-peace-badge">✦</span>
            peace
            <span className="su-peace-state">listening</span>
          </div>

          <div className="su-thread">
            {AGENT_THREAD.map((turn, i) => (
              <div
                key={i}
                className={`su-turn su-turn-${turn.from}`}
              >
                {turn.text}
              </div>
            ))}
            <div className="su-thread-actions">
              <button
                type="button"
                className="su-go"
              >
                Post to #northwind
              </button>
              <button
                type="button"
                className="su-go su-go-ghost"
              >
                Not yet
              </button>
            </div>
          </div>

          {selectedNode && (
            <div className="su-selection">
              <div className="su-sel-kind">{selectedNode.kind} selected</div>
              <div className="su-sel-label">{selectedNode.label}</div>
              <button
                type="button"
                className="su-sel-evidence"
              >
                ◆ {selectedNode.evidence?.length ?? 0} cited segments — highlighted ←
              </button>
              <div className="su-sel-actions">
                {AGENT_ACTIONS.slice(0, 3).map(a => (
                  <button
                    key={a.label}
                    type="button"
                  >
                    <span className="su-act-icon">{a.icon}</span>
                    {a.label}
                    {a.hint && <span className="su-act-hint">{a.hint}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="su-ask">
            <span className="su-ask-peace">✦</span>
            <span className="su-ask-ph">Ask peace or run an action…</span>
            <span className="su-ask-key">⏎</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

const CSS = `
.su-root {
  --su-field: oklch(0.165 0.008 260);
  --su-panel: oklch(0.195 0.009 260);
  --su-raised: oklch(0.235 0.01 260);
  --su-hair: oklch(1 0 0 / 0.08);
  --su-ink-strong: oklch(0.95 0.006 260);
  --su-ink: oklch(0.8 0.008 260);
  --su-ink-muted: oklch(0.6 0.01 260);
  --su-ink-faint: oklch(0.46 0.01 260);
  --su-accent: oklch(0.79 0.14 72);
  --su-decision: oklch(0.79 0.14 72);
  --su-action: oklch(0.74 0.13 152);
  --su-question: oklch(0.74 0.13 230);
  --su-topic: oklch(0.86 0.01 260);
  --su-outcome: oklch(0.62 0.02 260);

  position: absolute; inset: 0; display: flex; flex-direction: column;
  font-family: var(--font-hanken), system-ui, sans-serif;
  color: var(--su-ink); background: var(--su-field);
}

.su-bar { display: flex; align-items: center; gap: 16px; height: 52px; padding: 0 18px; flex-shrink: 0; border-bottom: 1px solid var(--su-hair); background: oklch(0.18 0.008 260 / 0.8); }
.su-back { width: 30px; height: 30px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; color: var(--su-ink-muted); text-decoration: none; border: 1px solid var(--su-hair); transition: all 150ms; }
.su-back:hover { color: var(--su-accent); border-color: var(--su-accent); }
.su-ws { display: inline-flex; align-items: center; gap: 9px; font-family: var(--font-fraunces), serif; font-size: 15px; font-weight: 600; color: var(--su-ink-strong); }
.su-ws-icon { color: var(--su-accent); }
.su-live { display: inline-flex; align-items: center; gap: 7px; font-size: 11.5px; color: var(--su-ink-muted); }
.su-live-dot { width: 7px; height: 7px; border-radius: 50%; background: oklch(0.74 0.13 152); box-shadow: 0 0 8px oklch(0.74 0.13 152); animation: su-pulse 2s ease-in-out infinite; }
@keyframes su-pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
.su-people { margin-left: auto; display: flex; align-items: center; }
.su-avatar { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; margin-left: -6px; border-radius: 50%; font-size: 9.5px; font-weight: 700; color: oklch(0.16 0.01 260); background: var(--c); border: 2px solid var(--su-field); }
.su-avatar-you { background: var(--su-raised); color: var(--su-ink); }
.su-share { margin-left: 12px; font-family: inherit; font-size: 12px; font-weight: 600; color: var(--su-field); background: var(--su-accent); border: 0; border-radius: 8px; padding: 6px 13px; cursor: pointer; }

.su-grid { display: grid; grid-template-columns: 264px 1fr 312px; flex: 1; min-height: 0; }

/* left rail */
.su-left { min-height: 0; display: flex; flex-direction: column; border-right: 1px solid var(--su-hair); padding: 14px 14px 0; }
.su-sec-h { display: flex; align-items: center; gap: 8px; font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--su-ink-faint); font-weight: 600; margin-bottom: 11px; }
.su-sec-h-spaced { margin-top: 18px; }
.su-src-rec { width: 6px; height: 6px; border-radius: 50%; background: oklch(0.74 0.13 152); animation: su-pulse 2s ease-in-out infinite; }
.su-presence { display: flex; flex-direction: column; gap: 7px; }
.su-person { display: flex; align-items: center; gap: 9px; }
.su-person-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--c); box-shadow: 0 0 8px -1px var(--c); }
.su-person-name { font-size: 13px; color: var(--su-ink); }
.su-person-speak { margin-left: auto; font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase; color: oklch(0.78 0.15 90); font-weight: 700; }
.su-transcript { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 1px; margin: 0 -6px; padding: 0 6px 16px; }
.su-seg { padding: 6px 8px; border-radius: 8px; transition: background 160ms; }
.su-seg[data-on] { background: oklch(0.79 0.14 72 / 0.14); box-shadow: inset 0 0 0 1px oklch(0.79 0.14 72 / 0.3); }
.su-seg-head { display: flex; align-items: baseline; gap: 7px; margin-bottom: 2px; }
.su-seg-name { font-size: 11.5px; font-weight: 600; }
.su-seg-time { font-family: var(--font-mono); font-size: 9.5px; color: var(--su-ink-faint); }
.su-seg-text { font-size: 12.5px; line-height: 1.45; color: var(--su-ink); }
.su-seg-bot .su-seg-text { color: var(--su-ink-muted); font-style: italic; }
.su-seg-interim .su-seg-text { color: var(--su-ink-faint); font-style: italic; }
.su-seg-caret { display: inline-block; width: 8px; height: 1px; background: var(--su-ink-faint); margin-left: 3px; vertical-align: middle; animation: su-write 1.2s ease-in-out infinite; }
@keyframes su-write { 0%,100% { width: 4px; opacity: 0.4; } 50% { width: 10px; opacity: 0.9; } }

/* center canvas */
.su-canvas { min-height: 0; display: flex; flex-direction: column; background-image: radial-gradient(oklch(1 0 0 / 0.045) 1px, transparent 1px); background-size: 24px 24px; }
.su-canvas-head { display: flex; align-items: baseline; gap: 12px; padding: 13px 20px; }
.su-canvas-title { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700; color: var(--su-ink-muted); }
.su-canvas-hint { font-size: 11.5px; color: var(--su-ink-faint); }
.su-stage { position: relative; flex: 1; min-height: 0; margin: 0 16px 16px; }
.su-edges { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.su-edge { fill: none; stroke: oklch(0.6 0.02 260 / 0.5); stroke-width: 1.5; }
.su-edge-live { stroke: oklch(0.79 0.14 72 / 0.6); stroke-dasharray: 5 4; animation: su-flow 26s linear infinite; }
@keyframes su-flow { to { stroke-dashoffset: -200; } }

.su-node { position: absolute; transform: translate(-50%, -50%); text-align: left; display: flex; flex-direction: column; gap: 5px; padding: 10px 12px; border-radius: 12px; cursor: pointer; background: var(--su-panel); border: 1px solid var(--su-hair); box-shadow: 0 6px 20px -10px oklch(0 0 0 / 0.6); transition: transform 140ms, box-shadow 200ms, border-color 200ms; font-family: inherit; }
.su-node:hover { transform: translate(-50%, -50%) translateY(-2px); border-color: oklch(1 0 0 / 0.2); }
.su-node-kind { font-size: 8.5px; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700; }
.su-node-label { font-size: 12.5px; line-height: 1.3; color: var(--su-ink-strong); font-weight: 500; }
.su-topic { border-color: oklch(0.86 0.01 260 / 0.3); }
.su-topic .su-node-kind { color: var(--su-topic); }
.su-decision { border-left: 3px solid var(--su-decision); }
.su-decision .su-node-kind { color: var(--su-decision); }
.su-action { border-left: 3px solid var(--su-action); }
.su-action .su-node-kind { color: var(--su-action); }
.su-question { border-left: 3px solid var(--su-question); }
.su-question .su-node-kind { color: var(--su-question); }
.su-outcome { background: oklch(0.2 0.008 260 / 0.7); }
.su-outcome .su-node-kind { color: var(--su-outcome); }
.su-node-sel { border-color: var(--su-accent); box-shadow: 0 0 0 1px var(--su-accent), 0 10px 30px -12px oklch(0 0 0 / 0.7); }
.su-node-new { animation: su-arrive 800ms cubic-bezier(0.2,0,0,1) both; }
@keyframes su-arrive { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); } 100% { opacity: 1; } }
.su-node-pulse { position: absolute; top: 9px; right: 10px; width: 6px; height: 6px; border-radius: 50%; background: var(--su-accent); animation: su-np 1.8s ease-out infinite; }
@keyframes su-np { 0% { box-shadow: 0 0 0 0 oklch(0.79 0.14 72 / 0.5); } 100% { box-shadow: 0 0 0 8px transparent; } }
.su-node-focus { position: absolute; top: -9px; right: -9px; width: 18px; height: 18px; border-radius: 50%; background: var(--c); color: oklch(0.16 0.01 260); font-size: 8px; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 2px solid var(--su-field); }

.su-cursor { position: absolute; pointer-events: none; z-index: 8; transition: left 2s ease, top 2s ease; }
.su-cursor-name { position: absolute; left: 13px; top: 11px; white-space: nowrap; font-size: 10px; font-weight: 600; color: oklch(0.16 0.01 260); background: var(--c); padding: 1px 5px; border-radius: 4px 8px 8px 8px; }

/* right rail — agent */
.su-right { min-height: 0; display: flex; flex-direction: column; border-left: 1px solid var(--su-hair); padding: 14px 14px 14px; background: oklch(0.18 0.008 260 / 0.5); }
.su-peace-badge { color: var(--su-accent); font-size: 13px; }
.su-peace-state { margin-left: auto; font-size: 9.5px; letter-spacing: 0.1em; text-transform: none; color: var(--su-ink-faint); font-weight: 500; }
.su-thread { display: flex; flex-direction: column; gap: 8px; padding-bottom: 14px; border-bottom: 1px solid var(--su-hair); }
.su-turn { font-size: 13px; line-height: 1.5; padding: 10px 12px; border-radius: 12px; }
.su-turn-user { align-self: flex-end; max-width: 90%; background: var(--su-raised); color: var(--su-ink); border-bottom-right-radius: 4px; }
.su-turn-peace { align-self: flex-start; background: oklch(0.79 0.14 72 / 0.1); border: 1px solid oklch(0.79 0.14 72 / 0.2); color: var(--su-ink-strong); border-bottom-left-radius: 4px; }
.su-thread-actions { display: flex; gap: 7px; margin-top: 2px; }
.su-go { font-family: inherit; font-size: 12px; font-weight: 600; color: var(--su-field); background: var(--su-accent); border: 0; border-radius: 8px; padding: 7px 12px; cursor: pointer; }
.su-go-ghost { background: transparent; color: var(--su-ink-muted); border: 1px solid var(--su-hair); }

.su-selection { margin-top: 14px; padding: 13px; border-radius: 12px; background: var(--su-panel); border: 1px solid var(--su-hair); }
.su-sel-kind { font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700; color: var(--su-accent); }
.su-sel-label { font-size: 13.5px; line-height: 1.35; color: var(--su-ink-strong); font-weight: 600; margin: 6px 0 10px; }
.su-sel-evidence { width: 100%; text-align: left; font-family: inherit; font-size: 11px; color: var(--su-accent); background: oklch(0.79 0.14 72 / 0.08); border: 1px solid oklch(0.79 0.14 72 / 0.2); border-radius: 8px; padding: 7px 10px; cursor: pointer; margin-bottom: 9px; }
.su-sel-actions { display: flex; flex-direction: column; gap: 5px; }
.su-sel-actions button { display: flex; align-items: center; gap: 8px; text-align: left; font-family: inherit; font-size: 12px; color: var(--su-ink); background: oklch(1 0 0 / 0.04); border: 1px solid var(--su-hair); border-radius: 8px; padding: 7px 10px; cursor: pointer; transition: all 140ms; }
.su-sel-actions button:hover { background: oklch(0.79 0.14 72 / 0.12); border-color: oklch(0.79 0.14 72 / 0.4); color: var(--su-ink-strong); }
.su-act-icon { color: var(--su-accent); }
.su-act-hint { margin-left: auto; font-size: 10px; color: var(--su-ink-faint); }

.su-ask { margin-top: auto; display: flex; align-items: center; gap: 9px; padding: 11px 12px; border-radius: 11px; background: oklch(0.23 0.01 260); border: 1px solid oklch(0.79 0.14 72 / 0.25); }
.su-ask-peace { color: var(--su-accent); font-size: 13px; }
.su-ask-ph { flex: 1; font-size: 12.5px; color: var(--su-ink-faint); }
.su-ask-key { font-family: var(--font-mono); font-size: 10.5px; color: var(--su-ink-faint); border: 1px solid var(--su-hair); border-radius: 5px; padding: 1px 5px; }
`;
