'use client';

import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ActionItem, Artifact, ConversationEvent, Decision, KeyPoint, OpenQuestion } from '@peace/core';
import { formatOffset, type WorkspaceDataAdapter } from '@peace/ui';
import {
  BannerStack,
  ChatBubble,
  ErrorBoundary,
  useBanners,
  useExpand,
  useZoomStack,
  ZoomStack
} from '../../_kit';
import { useWorkspace } from './use-workspace';
import { type DiagramNode, MermaidDiagram } from './mermaid-diagram';
import { PANELS, type PanelId } from './panels';
import { RESIZE_DIRS, useCanvasLayout } from './use-canvas-layout';
import { CanvasGrid } from './canvas-grid';
import { useCanvas2D } from './use-canvas-2d';
import { useDiagramPanelState } from './use-diagram-panel-state';
import { ThemeMenu } from '../../theme-menu';
import './deck-workspace.css';

/** Stable speaker color slot (0–7) from the speaker id; peace's own turns use the accent. */
function speakerColor (speakerId: string): string {
  if (speakerId.startsWith('peace:')) {
    return 'var(--peace-accent)';
  }

  let hash = 0;

  for (const ch of speakerId) {
    hash = (hash * 31 + ch.codePointAt(0)!) % 8;
  }

  return `var(--peace-speaker-${hash})`;
}

function initials (label: string): string {
  return label.split(/\s+/).map(w => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || '··';
}

interface ArtifactItem {
  id: string;
  kind: 'decision' | 'action' | 'question' | 'point';
  text: string;
  sub?: string;
  sourceSegmentIds: string[];
  uncertain: boolean;
}

/** Flatten the typed artifacts into uniform cards for the summary panel. */
function collectItems (artifacts: Artifact[]): ArtifactItem[] {
  const out: ArtifactItem[] = [];
  const byType = (t: string) => artifacts.find(a => a.type === t);

  const decisions = byType('decisions');

  if (decisions) {
    (decisions.content as { items: Decision[] }).items.forEach((d, i) => out.push({
      id              : `dec-${i}`,
      kind            : 'decision',
      text            : d.description,
      sub             : d.rationale ?? undefined,
      sourceSegmentIds: d.sourceSegmentIds,
      uncertain       : d.uncertain
    }));
  }

  const actions = byType('action-items');

  if (actions) {
    (actions.content as { items: ActionItem[] }).items.forEach((a, i) => out.push({
      id              : `act-${i}`,
      kind            : 'action',
      text            : a.description,
      sub             : [a.assignee, a.dueDate].filter(Boolean).join(' · ') || undefined,
      sourceSegmentIds: a.sourceSegmentIds,
      uncertain       : a.uncertain
    }));
  }

  const questions = byType('open-questions');

  if (questions) {
    (questions.content as { items: OpenQuestion[] }).items.forEach((q, i) => out.push({
      id              : `q-${i}`,
      kind            : 'question',
      text            : q.question,
      sourceSegmentIds: q.sourceSegmentIds,
      uncertain       : q.uncertain
    }));
  }

  const points = byType('key-points');

  if (points) {
    (points.content as { items: KeyPoint[] }).items.forEach((p, i) => out.push({
      id              : `kp-${i}`,
      kind            : 'point',
      text            : p.point,
      sourceSegmentIds: p.sourceSegmentIds,
      uncertain       : p.uncertain
    }));
  }

  return out;
}

const KIND_GLYPH: Record<ArtifactItem['kind'], string> = {
  decision: '◆',
  action  : '▸',
  question: '◇',
  point   : '▪'
};

interface FlowRow {
  id: string;
  label: string;
  depth: number;
}

/** Parse the pipeline's `flowchart` Mermaid (`A["…"] --> B["…"]` per line) into labels + edges. */
function parseFlow (mermaid: string): { labels: Map<string, string>; edges: [string, string][] } {
  const labels = new Map<string, string>();
  const edges: [string, string][] = [];
  const token = /([A-Za-z0-9_]+)(?:\["([^"]*)"\])?/;

  for (const raw of mermaid.split('\n')) {
    const line = raw.trim();

    if (!line || /^(?:flowchart|graph)\b/.test(line)) {
      continue;
    }

    let prev: string | null = null;

    for (const part of line.split('-->')) {
      const m = part.trim().match(token);

      if (!m) {
        continue;
      }

      const id = m[1]!;

      if (m[2] !== undefined) {
        labels.set(id, m[2]);
      } else if (!labels.has(id)) {
        labels.set(id, id);
      }

      if (prev) {
        edges.push([prev, id]);
      }

      prev = id;
    }
  }

  return {
    labels,
    edges
  };
}

/** A flow outline: DFS from the roots (no incoming edge), each node listed once. */
function buildFlowRows (mermaid: string | null): FlowRow[] {
  if (!mermaid) {
    return [];
  }

  const { labels, edges } = parseFlow(mermaid);
  const children = new Map<string, string[]>();
  const indeg = new Map<string, number>();

  for (const id of labels.keys()) {
    children.set(id, []);
    indeg.set(id, 0);
  }

  for (const [from, to] of edges) {
    children.get(from)?.push(to);
    indeg.set(to, (indeg.get(to) ?? 0) + 1);
  }

  const seen = new Set<string>();
  const rows: FlowRow[] = [];

  const visit = (id: string, depth: number) => {
    if (seen.has(id)) {
      return;
    }

    seen.add(id);
    rows.push({
      id,
      label: labels.get(id) ?? id,
      depth
    });

    for (const child of children.get(id) ?? []) {
      visit(child, depth + 1);
    }
  };

  for (const id of labels.keys()) {
    if (indeg.get(id) === 0) {
      visit(id, 0);
    }
  }

  for (const id of labels.keys()) {
    visit(id, 0); // any node left in a cycle
  }

  return rows;
}

type AskResult = { kind: 'speak'; text: string } | { kind: 'silent'; reason: string };

// Defers the panel-body render into a child component so a throw inside it is caught
// by the surrounding ErrorBoundary — an eager `{renderPanelBody()}` would throw in the
// parent's render, above the boundary.
function PanelBody ({ render }: { render: () => ReactNode }) {
  return <>{render()}</>;
}

type Workspace = ReturnType<typeof useWorkspace>;
type BannerApi = ReturnType<typeof useBanners>;

/** Cross-link: the segment ids currently lit (hover ∪ a clicked evidence chip). */
function useCrossLink (ws: Workspace) {
  const [hoverSegs, setHoverSegs] = useState<readonly string[]>([]);
  const litSegs = useMemo(() => new Set([...ws.highlightedIds, ...hoverSegs]), [ws.highlightedIds, hoverSegs]);

  return {
    setHoverSegs,
    litSegs
  };
}

/** Bridge transient workspace signals into the banner stack: a load error sticks (and
 *  clears on recovery); delta notices auto-dismiss unless they're errors. */
function useWorkspaceBanners (ws: Workspace, push: BannerApi['push'], dismiss: BannerApi['dismiss']) {
  useEffect(() => {
    if (ws.error) {
      push({
        severity: 'error',
        code    : 'workspace-load',
        message : `Failed to load workspace: ${ws.error}`
      });
    } else {
      dismiss('code:workspace-load');
    }
  }, [ws.error, push, dismiss]);

  useEffect(() => {
    if (ws.notice) {
      push({
        severity: ws.notice.severity,
        code    : ws.notice.code,
        message : ws.notice.message,
        ttl     : ws.notice.severity === 'error' ? undefined : 8000
      });
    }
  }, [ws.notice, push]);
}

export function DeckWorkspace ({ meetingId, adapter }: { meetingId: string; adapter: WorkspaceDataAdapter }) {
  const ws = useWorkspace(meetingId, adapter);
  const { expanded, closing, openExpand, dock } = useExpand();
  const zoom = useZoomStack();
  const { banners, push: pushBanner, dismiss: dismissBanner } = useBanners();

  const is2D = useCanvas2D();
  const { setHoverSegs, litSegs } = useCrossLink(ws);

  useWorkspaceBanners(ws, pushBanner, dismissBanner);

  const { wfMin, setWfMin, diagramBusy, setDiagramBusy, diagramLocked, setDiagramLocked } = useDiagramPanelState(expanded);

  const { setDeck, dragging, setPanelRef, gesture, resizeProps, zOf } = useCanvasLayout({
    meetingId,
    expanded,
    closing,
    dock,
    openExpand,
    zoomDepth: zoom.depth
  });

  const data = ws.data;
  const segments = useMemo(() => [...data?.segments ?? []].sort((a, b) => a.tStart - b.tStart), [data]);
  const items = useMemo(() => collectItems(data?.artifacts ?? []), [data]);
  const summary = data?.artifacts.find(a => a.type === 'summary') ?? null;
  const diagram = data?.artifacts.find(a => a.type === 'diagram') ?? null;

  const segById = useMemo(() => new Map(segments.map(s => [s.id, s])), [segments]);
  const itemsForSeg = useCallback((segId: string) => items.filter(it => it.sourceSegmentIds.includes(segId)), [items]);

  const openItem = useCallback((it: ArtifactItem) => {
    zoom.zoom({
      key  : `item-${it.id}`,
      title: it.kind,
      body : <ItemDetail
        item={it}
        evidence={it.sourceSegmentIds.map(id => segById.get(id)).filter(Boolean) as ConversationEvent[]} />
    });
  }, [zoom, segById]);

  const openSeg = useCallback((seg: ConversationEvent) => {
    zoom.zoom({
      key  : `seg-${seg.id}`,
      title: 'Message',
      body : <SegmentDetail
        seg={seg}
        linked={itemsForSeg(seg.id)}
        onOpenItem={openItem} />
    });
  }, [zoom, itemsForSeg, openItem]);

  const diagramSource = diagram ? (diagram.content as { mermaid: string }).mermaid : null;
  const diagramNodeEvidence = diagram ? (diagram.content as { nodeEvidence?: Record<string, string[]> }).nodeEvidence ?? {} : {};
  const flowRows = useMemo(() => buildFlowRows(diagramSource), [diagramSource]);

  const openDiagramEdit = useCallback(() => {
    if (!diagramSource) {
      return;
    }

    zoom.zoom({
      key  : 'diagram-edit',
      title: 'Edit diagram',
      body : <DiagramEditor
        source={diagramSource}
        onSave={async next => {
          await ws.saveDiagram(next);
          zoom.clear();
        }} />
    });
  }, [zoom, diagramSource, ws]);

  const askPeace = useCallback(async (query: string): Promise<AskResult> => {
    const res = await fetch(`/api/meetings/${meetingId}/ask`, {
      method : 'POST',
      headers: { 'content-type': 'application/json' },
      body   : JSON.stringify({ query })
    });
    const json = await res.json().catch(() => ({})) as AskResult & { error?: string };

    if (!res.ok) {
      throw new Error(json.error ?? `peace is unavailable (${res.status})`);
    }

    return json;
  }, [meetingId]);

  const openNode = useCallback((node: DiagramNode) => {
    const evidenceSet = new Set(node.evidence);
    const linked = items.filter(it => it.sourceSegmentIds.some(segId => evidenceSet.has(segId)));

    zoom.zoom({
      key  : `node-${node.id}`,
      title: node.label,
      body : <NodeDetail
        node={node}
        linked={linked}
        evidence={node.evidence.map(id => segById.get(id)).filter(Boolean) as ConversationEvent[]}
        onHighlight={() => {
          ws.highlight(node.evidence);
          zoom.clear();
        }}
        onEdit={openDiagramEdit}
        onOpenItem={openItem}
        onAsk={askPeace} />
    });
  }, [zoom, segById, ws, openDiagramEdit, items, openItem, askPeace]);

  if (!data) {
    return (
      <div className="dw-root">
        <div className="dw-loading">{ws.error ? `Failed to load workspace: ${ws.error}` : 'Loading workspace…'}</div>
      </div>
    );
  }

  const live = data.meeting.status === 'live';

  const renderPanelBody = (id: PanelId): ReactNode => {
    const dense = expanded !== id;

    if (id === 'comms') {
      return <Transcript
        segments={segments}
        litSegs={litSegs}
        dense={dense}
        onHover={setHoverSegs}
        onOpen={openSeg} />;
    }

    if (id === 'workflow') {
      const diagramEl = <MermaidDiagram
        source={diagramSource}
        nodeEvidence={diagramNodeEvidence}
        litSegs={litSegs}
        expanded={expanded === id}
        busy={diagramBusy}
        locked={diagramLocked}
        onToggleLock={() => setDiagramLocked(v => !v)}
        onHover={setHoverSegs}
        onNode={openNode} />;

      const tree = <WorkflowTree
        rows={flowRows}
        nodeEvidence={diagramNodeEvidence}
        segById={segById}
        litSegs={litSegs}
        onHover={setHoverSegs} />;

      // Expanded → diagram on the left, the flow outline on the right; either side
      // minimises to a thin rail. Collapsed → the diagram up top, the outline below.
      if (expanded === id) {
        return (
          <div
            className="dw-workflow-h"
            data-min={wfMin ?? undefined}>
            <section className="dw-wf-pane dw-wf-diagram">
              <button
                type="button"
                className="dw-wf-bar"
                onClick={() => {
                  setDiagramBusy(true);
                  setWfMin(wfMin === 'diagram' ? null : 'diagram');
                }}
                aria-label="Minimize or restore the diagram">
                <span className="dw-wf-name">Diagram</span>
                <span
                  className="dw-wf-min"
                  aria-hidden="true">{wfMin === 'diagram' ? '⊕' : '⊟'}</span>
              </button>
              {wfMin !== 'diagram' && diagramEl}
            </section>
            <section className="dw-wf-pane dw-wf-flow">
              <button
                type="button"
                className="dw-wf-bar"
                onClick={() => {
                  setDiagramBusy(true);
                  setWfMin(wfMin === 'tree' ? null : 'tree');
                }}
                aria-label="Minimize or restore the flow outline">
                <span className="dw-wf-name">Flow</span>
                <span
                  className="dw-wf-min"
                  aria-hidden="true">{wfMin === 'tree' ? '⊕' : '⊟'}</span>
              </button>
              {wfMin !== 'tree' && tree}
            </section>
          </div>
        );
      }

      return (
        <div className="dw-workflow">
          <div className="dw-workflow-diagram">{diagramEl}</div>
          {tree}
        </div>
      );
    }

    return (
      <SummaryPanel
        summary={summary ? (summary.content as { markdown: string }).markdown : null}
        items={items}
        litSegs={litSegs}
        onHover={setHoverSegs}
        onOpen={openItem}
      />
    );
  };

  // The error-bounded panel body — shared by both decks (1-D sections + the 2-D grid).
  const renderCell = (p: { id: PanelId; title: string }): ReactNode => (
    <ErrorBoundary
      resetKey={p.id}
      onError={error => pushBanner({
        severity: 'error',
        code    : `panel-crash-${p.id}`,
        message : `The ${p.title} panel hit an error: ${error.message}`
      })}
      fallback={<p className="dw-empty">This panel hit an error — see the banner. Reload to recover.</p>}>
      <PanelBody render={() => renderPanelBody(p.id)} />
    </ErrorBoundary>
  );

  return (
    <div
      className="dw-root"
      onClick={e => {
        if (!(e.target instanceof Element) || !e.target.closest('[data-intent="content"], button, .dw-chip')) {
          ws.clearHighlight();
          setHoverSegs([]);
        }
      }}
    >
      <header className="dw-bar">
        <Link
          href="/"
          className="dw-back">‹ meetings</Link>
        <h1 className="dw-title">{data.meeting.title}</h1>
        <span
          className="dw-status"
          data-status={data.meeting.status}>{data.meeting.status}</span>
        {live && ws.liveState === 'degraded' && <span
          className="dw-delayed"
          title="Push unavailable — polling">live · delayed</span>}
        <span className="dw-count">{segments.length} segments · {data.meeting.platform}</span>
        <button
          type="button"
          className="dw-btn"
          disabled={ws.regenerating}
          onClick={ws.regenerate}>
          {ws.regenerating ? 'regenerating…' : 'regenerate'}
        </button>
        <ThemeMenu className="dw-theme" />
      </header>

      <BannerStack
        banners={banners}
        onDismiss={dismissBanner} />

      {is2D ? (
        <CanvasGrid
          meetingId={meetingId}
          panels={PANELS}
          renderBody={renderCell} />
      ) : (
        <div
          className={`dw-deck${dragging ? ' dw-resizing' : ''}`}
          ref={setDeck}>
          {expanded && !closing && <button
            type="button"
            className="dw-backdrop"
            aria-label="Dock"
            onClick={dock} />}

          {PANELS.map(p => {
            const isExpanded = expanded === p.id;
            const gripOn = gesture.hoverId === p.id && gesture.hoverIntent === 'surface';

            // The panel being dragged floats above the rest; otherwise the canvas z (or
            // the CSS z for an expanded panel).
            let panelZ: number | undefined = zOf(p.id);

            if (isExpanded) {
              panelZ = undefined;
            }

            if (gesture.dragId === p.id) {
              panelZ = 30;
            }

            return (
              <section
                key={p.id}
                ref={setPanelRef(p.id)}
                data-panel={p.id}
                className={`dw-panel${gripOn ? ' dw-grip-on' : ''}${isExpanded ? ' dw-expanded' : ''}${gesture.dragId === p.id ? ' dw-dragging-panel' : ''}`}
                style={{
                  cursor: gesture.cursorFor(p.id),
                  zIndex: panelZ
                }}
                data-hover-intent={gesture.hoverId === p.id ? gesture.hoverIntent ?? undefined : undefined}
                {...gesture.handlers(p.id)}
              >
                <div className="dw-grip">
                  <span className="dw-grip-dots"><i /><i /><i /></span>
                  <span className="dw-grip-title">{p.title}</span>
                  {isExpanded ? <button
                    type="button"
                    data-intent="control"
                    className="dw-dock"
                    onClick={dock}>dock ✕</button> : <span className="dw-grip-hint">{gripOn ? 'tap to expand · drag to move' : ''}</span>}
                </div>
                <div className={`dw-body${isExpanded ? ' dw-body-expanded' : ''}${p.id === 'workflow' ? ' dw-body-canvas' : ''}`}>
                  {renderCell(p)}
                </div>
                {!isExpanded && RESIZE_DIRS.map(dir => (
                  <span
                    key={dir}
                    data-intent="control"
                    className={`dw-resize dw-resize-${dir}`}
                    {...resizeProps(p.id, dir)} />
                ))}
              </section>
            );
          })}
        </div>
      )}

      <ZoomStack
        stack={zoom.stack}
        onPop={zoom.pop} />
    </div>
  );
}

// ── transcript ──
function Transcript ({ segments, litSegs, dense, onHover, onOpen }: {
  segments: ConversationEvent[];
  litSegs: ReadonlySet<string>;
  dense: boolean;
  onHover: (segIds: readonly string[]) => void;
  onOpen: (seg: ConversationEvent) => void;
}) {
  if (segments.length === 0) {
    return <p className="dw-empty">No transcript yet.</p>;
  }

  return (
    <div className="dw-feed">
      {segments.map((s, i) => {
        const prev = segments[i - 1];
        const grouped = !dense && prev?.speakerId === s.speakerId && s.tStart - prev.tStart < 60_000;

        return (
          <ChatBubble
            key={s.id}
            speaker={s.speakerLabel}
            speakerColor={speakerColor(s.speakerId)}
            initials={initials(s.speakerLabel)}
            time={formatOffset(s.tStart)}
            variant={s.speakerId.startsWith('peace:') ? 'bot' : 'default'}
            density={dense ? 'compact' : 'comfortable'}
            grouped={grouped}
            selected={litSegs.has(s.id)}
            onActivate={() => onOpen(s)}
            onMouseEnter={() => onHover([s.id])}
            onMouseLeave={() => onHover([])}
          >
            {s.text}
          </ChatBubble>
        );
      })}
    </div>
  );
}

// ── workflow flow outline (cross-links to the diagram + transcript) ──
function WorkflowTree ({ rows, nodeEvidence, segById, litSegs, onHover }: {
  rows: FlowRow[];
  nodeEvidence: Record<string, string[]>;
  segById: Map<string, ConversationEvent>;
  litSegs: ReadonlySet<string>;
  onHover: (segIds: readonly string[]) => void;
}) {
  // A row expands its cited transcript inline (read evidence in place) rather than
  // opening the drill modal — the diagram node remains the full-drill path.
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (id: string) => setOpen(prev => {
    const next = new Set(prev);

    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    return next;
  });

  return (
    <div
      className="dw-workflow-tree"
      data-no-frame>
      <span className="dw-tree-head">Flow</span>
      {rows.length === 0 && <p className="dw-empty">No workflow steps yet.</p>}
      <ul className="dw-tree">
        {rows.map(row => {
          const evidence = nodeEvidence[row.id] ?? [];
          const lit = evidence.some(segId => litSegs.has(segId));
          const hasEvi = evidence.length > 0;
          const isOpen = hasEvi && open.has(row.id);

          return (
            <li
              key={row.id}
              className="dw-tree-row"
              style={{ '--depth': row.depth } as CSSProperties}>
              <button
                type="button"
                data-intent="content"
                className="dw-tree-node"
                data-on={lit || undefined}
                data-open={isOpen || undefined}
                aria-expanded={hasEvi ? isOpen : undefined}
                onMouseEnter={() => onHover(evidence)}
                onMouseLeave={() => onHover([])}
                onClick={() => hasEvi && toggle(row.id)}>
                {hasEvi ? <span
                  className="dw-tree-caret"
                  aria-hidden="true">▸</span> : <span
                  className="dw-tree-tick"
                  aria-hidden="true" />}
                <span className="dw-tree-label">{row.label}</span>
                {hasEvi && <span className="dw-chip">◈ {evidence.length}</span>}
              </button>
              {isOpen && (
                <ul className="dw-tree-evi">
                  {evidence.map(segId => {
                    const seg = segById.get(segId);

                    if (!seg) {
                      return null;
                    }

                    return (
                      <li
                        key={segId}
                        className="dw-tree-evi-row">
                        <span
                          className="dw-tree-evi-spk"
                          style={{ color: speakerColor(seg.speakerId) }}>{seg.speakerLabel}</span>
                        <span className="dw-tree-evi-text">{seg.text}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── summary / artifacts ──
function SummaryPanel ({ summary, items, litSegs, onHover, onOpen }: {
  summary: string | null;
  items: ArtifactItem[];
  litSegs: ReadonlySet<string>;
  onHover: (segIds: readonly string[]) => void;
  onOpen: (item: ArtifactItem) => void;
}) {
  if (!summary && items.length === 0) {
    return <p className="dw-empty">No artifacts yet — run <em>regenerate</em>.</p>;
  }

  return (
    <div className="dw-summary">
      {summary && <p className="dw-lede">{summary}</p>}
      <div className="dw-cards">
        {items.map(it => {
          const on = it.sourceSegmentIds.some(id => litSegs.has(id));

          return (
            <button
              key={it.id}
              type="button"
              data-intent="content"
              className={`dw-card dw-card-${it.kind}`}
              data-on={on || undefined}
              onClick={() => onOpen(it)}
              onMouseEnter={() => onHover(it.sourceSegmentIds)}
              onMouseLeave={() => onHover([])}
            >
              <span className="dw-card-kind">{KIND_GLYPH[it.kind]} {it.kind}</span>
              <span className="dw-card-text">{it.text}</span>
              {it.sub && <span className="dw-card-sub">{it.sub}</span>}
              <span className="dw-card-foot">
                <span className="dw-chip">◈ {it.sourceSegmentIds.length}</span>
                {it.uncertain && <span className="dw-uncertain">uncertain</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── drill-down modal bodies ──
function SegmentDetail ({ seg, linked, onOpenItem }: {
  seg: ConversationEvent;
  linked: ArtifactItem[];
  onOpenItem: (it: ArtifactItem) => void;
}) {
  return (
    <div className="dw-modal">
      <span className="dw-modal-eyebrow">message · {formatOffset(seg.tStart)}</span>
      <ChatBubble
        speaker={seg.speakerLabel}
        speakerColor={speakerColor(seg.speakerId)}
        initials={initials(seg.speakerLabel)}
        time={formatOffset(seg.tStart)}
        variant={seg.speakerId.startsWith('peace:') ? 'bot' : 'default'}
        density="comfortable"
      >
        {seg.text}
      </ChatBubble>
      <div className="dw-modal-sec">
        <span className="dw-modal-h">Linked to</span>
        {linked.length === 0 ? <p className="dw-empty">Not cited by any artifact yet.</p> : linked.map(it => (
          <button
            key={it.id}
            type="button"
            className="dw-link-row"
            onClick={() => onOpenItem(it)}>{KIND_GLYPH[it.kind]} {it.text}</button>
        ))}
      </div>
    </div>
  );
}

function ItemDetail ({ item, evidence }: { item: ArtifactItem; evidence: ConversationEvent[] }) {
  return (
    <div className="dw-modal">
      <span className="dw-modal-eyebrow">{KIND_GLYPH[item.kind]} {item.kind}</span>
      <h3 className="dw-modal-title">{item.text}</h3>
      {item.sub && <p className="dw-modal-sub">{item.sub}</p>}
      <div className="dw-modal-sec">
        <span className="dw-modal-h">Evidence · {evidence.length}</span>
        {evidence.length === 0 ? <p className="dw-empty">No linked segments.</p> : evidence.map(seg => (
          <ChatBubble
            key={seg.id}
            speaker={seg.speakerLabel}
            speakerColor={speakerColor(seg.speakerId)}
            initials={initials(seg.speakerLabel)}
            time={formatOffset(seg.tStart)}
            variant={seg.speakerId.startsWith('peace:') ? 'bot' : 'default'}
            density="comfortable"
          >
            {seg.text}
          </ChatBubble>
        ))}
      </div>
    </div>
  );
}

// Ask the conversational agent a question about this node, over the meeting
// transcript. The response (or a "stayed silent") renders inline below the input.
function AskPeace ({ node, onAsk }: { node: DiagramNode; onAsk: (query: string) => Promise<AskResult> }) {
  const [draft, setDraft] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const q = draft.trim();

    if (!q || asking) {
      return;
    }

    setAsking(true);
    setError(null);
    setAnswer(null);
    onAsk(`Regarding the workflow step "${node.label}": ${q}`)
      .then(setAnswer)
      .catch((askError: unknown) => setError(askError instanceof Error ? askError.message : 'peace is unavailable'))
      .finally(() => setAsking(false));
  };

  return (
    <div className="dw-modal-sec dw-ask">
      <span className="dw-modal-h">Ask peace</span>
      <div className="dw-ask-row">
        <input
          className="dw-ask-input"
          value={draft}
          placeholder="Ask peace about this step…"
          disabled={asking}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }} />
        <button
          type="button"
          className="dw-act dw-ask-send"
          disabled={asking || draft.trim().length === 0}
          onClick={submit}>{asking ? 'Asking…' : 'Ask'}</button>
      </div>
      {error && <p className="dw-ask-error">{error}</p>}
      {answer?.kind === 'speak' && <p className="dw-ask-answer">{answer.text}</p>}
      {answer?.kind === 'silent' && <p className="dw-empty">peace stayed silent on this one.</p>}
    </div>
  );
}

function NodeDetail ({ node, linked, evidence, onHighlight, onEdit, onOpenItem, onAsk }: {
  node: DiagramNode;
  linked: ArtifactItem[];
  evidence: ConversationEvent[];
  onHighlight: () => void;
  onEdit: () => void;
  onOpenItem: (it: ArtifactItem) => void;
  onAsk: (query: string) => Promise<AskResult>;
}) {
  return (
    <div className="dw-modal">
      <span className="dw-modal-eyebrow">diagram node</span>
      <h3 className="dw-modal-title">{node.label}</h3>
      <div className="dw-modal-actions">
        <button
          type="button"
          className="dw-act"
          onClick={onHighlight}>◈ Highlight in transcript</button>
        <button
          type="button"
          className="dw-act"
          onClick={onEdit}>✎ Edit diagram</button>
      </div>
      <AskPeace
        node={node}
        onAsk={onAsk} />
      {linked.length > 0 && (
        <div className="dw-modal-sec">
          <span className="dw-modal-h">Linked items · {linked.length}</span>
          <ul className="dw-linked">
            {linked.map(it => (
              <li key={it.id}>
                <button
                  type="button"
                  className={`dw-linked-item dw-linked-${it.kind}`}
                  onClick={() => onOpenItem(it)}>
                  <span className="dw-linked-kind">{KIND_GLYPH[it.kind]} {it.kind}</span>
                  <span className="dw-linked-text">{it.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="dw-modal-sec">
        <span className="dw-modal-h">Evidence · {evidence.length}</span>
        {evidence.length === 0 ? <p className="dw-empty">No linked segments.</p> : evidence.map(seg => (
          <ChatBubble
            key={seg.id}
            speaker={seg.speakerLabel}
            speakerColor={speakerColor(seg.speakerId)}
            initials={initials(seg.speakerLabel)}
            time={formatOffset(seg.tStart)}
            variant={seg.speakerId.startsWith('peace:') ? 'bot' : 'default'}
            density="comfortable"
          >
            {seg.text}
          </ChatBubble>
        ))}
      </div>
    </div>
  );
}

function DiagramEditor ({ source, onSave }: { source: string; onSave: (next: string) => Promise<void> }) {
  const [val, setVal] = useState(source);
  const [saving, setSaving] = useState(false);

  return (
    <div className="dw-modal">
      <span className="dw-modal-eyebrow">edit diagram · mermaid source</span>
      <textarea
        className="dw-editor"
        spellCheck={false}
        value={val}
        onChange={e => setVal(e.target.value)}
      />
      <div className="dw-modal-actions">
        <button
          type="button"
          className="dw-act"
          disabled={saving}
          onClick={() => {
            setSaving(true);
            onSave(val).catch(() => setSaving(false));
          }}
        >
          {saving ? 'saving…' : 'Save new version'}
        </button>
      </div>
    </div>
  );
}
