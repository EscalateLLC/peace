'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ACTIONS,
  AGENT_ACTIONS,
  AGENT_THREAD,
  COLLABORATORS,
  DECISIONS,
  EDGES,
  KEY_POINTS,
  MEETING,
  NODES,
  QUESTIONS,
  SEGMENTS,
  offset,
  speakerSlot,
  type MapNode,
  type MockSegment
} from '../_data';
import {
  buildTargets,
  computeSlots,
  focalRatios,
  nearestSlot,
  reorder,
  useExpand,
  useIntentGesture,
  useResize,
  useSpringLayout,
  useZoomStack,
  ZoomStack,
  type DragState,
  type Target
} from '../../_kit/interaction';
import { ChatBubble } from '../../_kit';

/* WORKSPACE — "Command Deck" (fluid game-HUD, swap + resize).
 * Three panels positioned by a geometry engine and animated with a real spring
 * (rAF, imperative transform writes — no per-frame React renders) for an
 * iOS-grade feel. Focusing a panel SWAPS it into the focal slot (default the
 * MIDDLE, configurable L/C/R); the two panels slide past each other, one
 * growing as the other shrinks. Drag the gutters to resize (pointer-capture, so
 * it grabs on the first press). The whole panel is the move target on empty
 * space (its grip lights); hovering a control lights the control instead. Click
 * a node to dock its inspector (comment / ask / link) and cross-light evidence.
 * Dependency-free spring on purpose — the real build can adopt `motion` as a
 * deliberately-pinned dep later. This is the interaction prototype. */

type PanelId = 'comms' | 'workflow' | 'actions';

const IDS: PanelId[] = ['comms', 'workflow', 'actions'];

const PAD = 12;
const GAP = 10;
const MIN_RATIO = 0.16;
const FOCAL_RATIO = 0.5;
const READ_MIN = 660; // a maximized transcript is at least this wide (centered)

const HUES = [205, 75, 150, 285, 340, 98, 45, 12];

function speakerColor (speakerId: string): string {
  return speakerId === 'peace' ? 'oklch(0.74 0.03 205)' : `oklch(0.8 0.13 ${HUES[speakerSlot(speakerId)] ?? 205})`;
}

function initials (name: string): string {
  if (name === 'peace') {
    return '✦';
  }

  const parts = name.trim().split(/\s+/);

  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
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

const PANEL_TITLE: Record<PanelId, string> = {
  comms   : 'COMMS // TRANSCRIPT',
  workflow: 'WORKFLOW // DIAGRAM',
  actions : 'ACTIONS // SUMMARY'
};

const PANEL_ACCENT: Record<PanelId, 'cyan' | 'amber'> = {
  comms   : 'cyan',
  workflow: 'cyan',
  actions : 'amber'
};

const FOCAL_ICON = ['▮▯▯', '▯▮▯', '▯▯▮'];

/**
 * Two-way evidence linking: from a selected node → its source segments +
 * artifacts; from a selected segment → the nodes/artifacts that cite it. Also
 * owns the transcript ref + auto-scroll to the first lit segment.
 */
function useCrossLink (node: string | null, seg: string | null) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const selectedNode = useMemo(() => NODES.find(n => n.id === node) ?? null, [node]);

  const sets = useMemo(() => {
    if (node) {
      const n = NODES.find(x => x.id === node);

      return {
        hiSegs : new Set(n?.evidence ?? []),
        hiNodes: new Set([node]),
        hiArts : new Set([node])
      };
    }

    if (seg) {
      return {
        hiSegs : new Set([seg]),
        hiNodes: new Set(NODES.filter(n2 => n2.evidence?.includes(seg)).map(n2 => n2.id)),
        hiArts : new Set([...DECISIONS, ...ACTIONS, ...QUESTIONS].filter(a => a.evidence.includes(seg)).map(a => a.id))
      };
    }

    return {
      hiSegs : new Set<string>(),
      hiNodes: new Set<string>(),
      hiArts : new Set<string>()
    };
  }, [node, seg]);

  const firstSeg = [...sets.hiSegs][0];

  useEffect(() => {
    if (firstSeg) {
      transcriptRef.current
        ?.querySelector(`[data-seg="${firstSeg}"]`)
        ?.scrollIntoView({
          behavior: 'smooth',
          block   : 'center'
        });
    }
  }, [firstSeg]);

  return {
    transcriptRef,
    selectedNode,
    ...sets
  };
}

/** The ACTIONS panel's expanded view — a readable record + a peace command surface. */
function ActionsExpanded ({ hiArts }: { hiArts: Set<string> }) {
  return (
    <div className="dk-act-x">
      <div className="dk-read-head">
        <h2 className="dk-read-title">Summary &amp; Actions</h2>
        <span className="dk-read-sub">{MEETING.title} · the record so far</span>
      </div>
      <p className="dk-act-lead">
        Beta ships a live transcript and live decisions; everything else generates in batch when the meeting stops.
      </p>

      <div className="dk-act-cols">
        <div className="dk-act-main">
          <section>
            <h3 className="dk-act-h">◆ Decisions</h3>
            {DECISIONS.map(d => (
              <div
                key={d.id}
                data-on={hiArts.has(d.id) || undefined}
                className={`dk-act-card dk-art-decision${d.provisional ? ' dk-art-new' : ''}`}
              >
                <p className="dk-act-card-text">{d.text}</p>
                {d.rationale && <p className="dk-act-card-sub">{d.rationale}</p>}
              </div>
            ))}
          </section>

          <div className="dk-act-two">
            <section>
              <h3 className="dk-act-h">◇ Open questions</h3>
              {QUESTIONS.map(q => (
                <div
                  key={q.id}
                  data-on={hiArts.has(q.id) || undefined}
                  className="dk-act-card dk-art-question"
                >
                  <p className="dk-act-card-text">{q.text}</p>
                </div>
              ))}
            </section>
            <section>
              <h3 className="dk-act-h">· Key points</h3>
              {KEY_POINTS.map(k => (
                <div
                  key={k.id}
                  data-on={hiArts.has(k.id) || undefined}
                  className="dk-act-card dk-act-card-quiet"
                >
                  <p className="dk-act-card-text">{k.text}</p>
                </div>
              ))}
            </section>
          </div>
        </div>

        <aside className="dk-act-side">
          <section>
            <h3 className="dk-act-h dk-act-h-amber">▸ On the hook</h3>
            {ACTIONS.map(a => (
              <div
                key={a.id}
                data-on={hiArts.has(a.id) || undefined}
                className={`dk-act-todo${a.provisional ? ' dk-art-new' : ''}`}
              >
                <span className="dk-check" />
                <div className="dk-art-body">
                  <span className="dk-act-todo-text">{a.text}</span>
                  <span className="dk-art-meta">
                    {a.assignee && <span className="dk-owner">{a.assignee}</span>}
                    {a.due && <span> · due {a.due}</span>}
                  </span>
                </div>
              </div>
            ))}
          </section>

          <section className="dk-act-console">
            <div className="dk-peace-bar">
              <span className="dk-peace-core">✦</span>
              peace
              <span className="dk-peace-state">online · listening</span>
            </div>
            <div className="dk-act-thread">
              {AGENT_THREAD.map((t, i) => (
                <div
                  key={i}
                  className={`dk-turn dk-turn-${t.from}`}
                >
                  {t.text}
                </div>
              ))}
              <div className="dk-thread-actions">
                <button
                  type="button"
                  className="dk-go"
                >
                  Post to #northwind
                </button>
                <button
                  type="button"
                  className="dk-go dk-go-ghost"
                >
                  Not yet
                </button>
              </div>
            </div>
            <div className="dk-act-abil">
              {AGENT_ACTIONS.map(a => (
                <button
                  key={a.label}
                  type="button"
                  className="dk-ability"
                >
                  <span className="dk-ability-icon">{a.icon}</span>
                  {a.label}
                </button>
              ))}
            </div>
            <div
              className="dk-cmdline"
              data-control
            >
              <span className="dk-cmd-pr">peace ▸</span>
              <span className="dk-cmd-ph">issue a command…</span>
              <span className="dk-cmd-key">⏎</span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

const COMMENTS: Record<string, { who: string; short: string; color: string; text: string }[]> = {
  d2: [
    {
      who  : 'Maya Chen',
      short: 'MC',
      color: 'oklch(0.74 0.15 230)',
      text : 'Can we guarantee batch finishes within ~2s of stop? Don\'t want a dead gap.'
    }
  ],
  a2: [
    {
      who  : 'Priya Raman',
      short: 'PR',
      color: 'oklch(0.74 0.16 340)',
      text : 'Add 6 + 8 speaker cases too — that\'s where it\'ll break.'
    }
  ]
};

/** The drill-down modal for a diagram node — the node's full interface (the old
 * docked inspector, opened up): its linked evidence, comments, and actions. */
function NodeModal ({ node, onClose }: { node: MapNode; onClose: () => void }) {
  const evidence = SEGMENTS.filter(s => node.evidence?.includes(s.id));
  const comments = COMMENTS[node.id] ?? [];

  return (
    <div className="dk-modal">
      <header className="dk-modal-head">
        <span className="dk-modal-kind">{KIND_GLYPH[node.kind]} {node.kind}</span>
        <button
          type="button"
          className="dk-modal-x"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </header>
      <h2 className="dk-modal-title">{node.label}</h2>

      <section className="dk-modal-sec">
        <h3 className="dk-modal-h">◆ Evidence · {evidence.length} source{evidence.length === 1 ? '' : 's'}</h3>
        <div className="dk-modal-evidence">
          {evidence.map(s => (
            <ChatBubble
              key={s.id}
              speaker={s.speaker}
              speakerColor={speakerColor(s.speakerId)}
              initials={initials(s.speaker)}
              time={offset(s.t)}
              variant={s.bot ? 'bot' : 'default'}
              density="comfortable"
            >
              {s.text}
            </ChatBubble>
          ))}
          {evidence.length === 0 && <p className="dk-modal-empty">No linked evidence yet.</p>}
        </div>
      </section>

      <section className="dk-modal-sec">
        <h3 className="dk-modal-h">Comments</h3>
        {comments.map((c, i) => (
          <div
            key={i}
            className="dk-comment"
          >
            <span
              className="dk-comment-av"
              style={{ '--c': c.color } as React.CSSProperties}
            >
              {c.short}
            </span>
            <div>
              <span className="dk-comment-who">{c.who}</span>
              <span className="dk-comment-text">{c.text}</span>
            </div>
          </div>
        ))}
        {comments.length === 0 && <p className="dk-modal-empty">No comments yet.</p>}
        <div className="dk-comment-input">
          <span className="dk-ci-icon">💬</span>
          <span className="dk-ci-ph">Reply…</span>
        </div>
      </section>

      <footer className="dk-modal-actions">
        <button type="button">✦ Ask peace about this</button>
        <button type="button">🔗 Link to…</button>
        <button type="button">▸ Make a ticket</button>
        <button type="button">✎ Edit node</button>
      </footer>
    </div>
  );
}

/** The drill-down modal for a transcript message — enlarged, with what it links to. */
function BubbleModal ({ seg, onClose }: { seg: MockSegment; onClose: () => void }) {
  const linked = NODES.filter(n => n.evidence?.includes(seg.id));

  return (
    <div className="dk-modal">
      <header className="dk-modal-head">
        <span className="dk-modal-kind">message · {offset(seg.t)}</span>
        <button
          type="button"
          className="dk-modal-x"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </header>
      <ChatBubble
        speaker={seg.speaker}
        speakerColor={speakerColor(seg.speakerId)}
        initials={initials(seg.speaker)}
        time={offset(seg.t)}
        variant={seg.bot ? 'bot' : 'default'}
        density="comfortable"
      >
        {seg.text}
      </ChatBubble>
      {linked.length > 0 && (
        <section className="dk-modal-sec">
          <h3 className="dk-modal-h">Linked to</h3>
          {linked.map(n => (
            <div
              key={n.id}
              className="dk-modal-link"
            >
              {KIND_GLYPH[n.kind]} {n.label}
            </div>
          ))}
        </section>
      )}
      <footer className="dk-modal-actions">
        <button type="button">✦ Ask peace</button>
        <button type="button">🔗 Link to…</button>
      </footer>
    </div>
  );
}

export default function CommandDeck () {
  const deckRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({
    w: 0,
    h: 0
  });
  const [focalSlot, setFocalSlot] = useState(1);

  // Explicit slot order (source of truth) — supports click-swap, arrow-cycle,
  // and drag-and-drop reorder. The focused panel is whichever sits in focalSlot.
  const [order, setOrder] = useState<PanelId[]>(['comms', 'workflow', 'actions']);
  const { expanded, closing, openExpand, dock } = useExpand();
  const [ratios, setRatios] = useState<number[]>(focalRatios({
    focal     : 1,
    focalRatio: FOCAL_RATIO
  }));
  const [node, setNode] = useState<string | null>('d2');
  const [seg, setSeg] = useState<string | null>(null);

  // Measure the deck (pre-paint) and keep it current.
  useLayoutEffect(() => {
    const el = deckRef.current;

    if (!el) {
      return;
    }

    const measure = () => setSize({
      w: el.clientWidth,
      h: el.clientHeight
    });

    measure();

    const ro = new ResizeObserver(measure);

    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  // Geometry: per-slot widths + x offsets, then per-panel target via arrangement.
  const geom = useMemo(() => computeSlots({
    width : size.w,
    height: size.h,
    ratios,
    pad   : PAD,
    gap   : GAP
  }), [size, ratios]);

  const ready = size.w > 0;

  const { dragging, draggingRef, onSeamDown, onSeamMove, onSeamUp } = useResize({
    aw      : geom.aw,
    ratios,
    setRatios,
    minRatio: MIN_RATIO
  });

  const arrangement = order;
  const focusedId = order[focalSlot]!;

  const targets = useMemo(() => buildTargets({
    ids  : IDS,
    order,
    slots: geom,
    pad  : PAD,

    // Per-panel expand geometry (null → use slot geometry; e.g. while closing).
    expandGeom: (id, slot) => {
      if (id !== expanded || closing) {
        return null;
      }

      if (id === 'comms') {
        // Transcript: a centered reading column, never below its current width.
        const w = Math.max(geom.sw[slot]!, READ_MIN);

        return {
          x: Math.round((size.w - w) / 2),
          y: PAD,
          w,
          h: geom.h
        };
      }

      // Diagram / actions: a wide inset.
      const mx = Math.round(size.w * 0.055);

      return {
        x: mx,
        y: 24,
        w: Math.max(0, size.w - 2 * mx),
        h: Math.max(0, size.h - 48)
      };
    }
  }) as Record<PanelId, Target>, [order, geom, expanded, closing, size]);

  const slotOf = (id: PanelId) => arrangement.indexOf(id);

  const drag = useRef<DragState>({
    panel: null,
    x    : 0
  });
  const { setPanelRef, kick } = useSpringLayout({
    ids: IDS,
    targets,
    ready,
    draggingRef,
    drag
  });
  const present = COLLABORATORS.filter(p => !p.you);
  const { transcriptRef, hiSegs, hiNodes, hiArts } = useCrossLink(node, seg);
  const zoomStack = useZoomStack();

  // Make a panel focal: swap it into the focal slot (the others reflow + spring).
  const focusPanel = useCallback((id: PanelId) => {
    setOrder(o => {
      if (o[focalSlot] === id) {
        return o;
      }

      const next = [...o];
      const i = next.indexOf(id);

      [next[focalSlot], next[i]] = [next[i]!, next[focalSlot]!];

      return next;
    });
  }, [focalSlot]);

  // Move the focal (widest) slot to a new position; the focused panel follows.
  const moveFocal = (slot: number) => {
    setOrder(o => {
      const next = [...o];

      [next[slot], next[focalSlot]] = [next[focalSlot]!, next[slot]!];

      return next;
    });
    setRatios(focalRatios({
      focal     : slot,
      focalRatio: FOCAL_RATIO
    }));
    setFocalSlot(slot);
  };

  // Keep the latest geometry readable inside drag callbacks (so a window resize
  // mid-drag uses live slot positions); grabRef holds the within-panel offset.
  const geomRef = useRef(geom);

  geomRef.current = geom;
  const grabRef = useRef(0);

  const anchorDrag = (id: string, clientX: number) => {
    const deck = deckRef.current;

    if (!deck) {
      return 0;
    }

    return clientX - deck.getBoundingClientRect().x - grabRef.current;
  };

  const panelGesture = useIntentGesture({
    isExpanded: id => expanded === id,
    onZoomTap : id => {
      if (expanded === id) {
        dock();
      } else {
        openExpand(id);
      }
    },
    onExpandedDragStart: () => dock(),
    onDragStart        : ({ id, clientX }) => {
      const deck = deckRef.current;
      const panelEl = deck?.querySelector<HTMLElement>(`[data-panel="${id}"]`);

      grabRef.current = clientX - (panelEl?.getBoundingClientRect().x ?? 0);
      drag.current.panel = id;
      drag.current.x = anchorDrag(id, clientX);
      kick();
    },
    onDragMove: ({ id, clientX }) => {
      const deck = deckRef.current;

      if (!deck) {
        return;
      }

      drag.current.x = anchorDrag(id, clientX);

      const slot = nearestSlot({
        px: clientX - deck.getBoundingClientRect().x,
        sx: geomRef.current.sx,
        sw: geomRef.current.sw
      });

      setOrder(ord => reorder({
        order: ord,
        id,
        slot
      }) as PanelId[]);
      kick();
    },
    onDragEnd: () => {
      drag.current.panel = null;
      kick();
    }
  });

  // Keyboard nav: ←/→ cycle focal, Enter expands it, Esc docks.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoomStack.depth === 0) {
          dock(); // no modal open → Esc docks the panel (the ZoomStack owns Esc while open)
        }

        return;
      }

      const tag = (e.target as HTMLElement | null)?.tagName;

      if (expanded || tag === 'INPUT' || tag === 'TEXTAREA') {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();

        const dir = e.key === 'ArrowRight' ? 1 : 2;

        setOrder(o => {
          const cur = o[focalSlot]!;
          const next = IDS[(IDS.indexOf(cur) + dir) % 3]!;
          const others = o.filter(x => x !== next);
          const arr: PanelId[] = [];
          let oi = 0;

          for (let s = 0; s < 3; s++) {
            arr[s] = s === focalSlot ? next : others[oi++]!;
          }

          return arr;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        openExpand(focusedId);
      }
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, focusedId, focalSlot, dock, openExpand, zoomStack.depth]);

  // Tap a node → drill into its modal (the node's full interface).
  const openNode = (n: MapNode) => {
    zoomStack.zoom({
      key  : `node:${n.id}`,
      title: n.label,
      body : <NodeModal
        node={n}
        onClose={zoomStack.pop}
      />
    });
  };

  // Tap a message → drill into its modal.
  const openSeg = (s: MockSegment) => {
    zoomStack.zoom({
      key  : `seg:${s.id}`,
      title: s.speaker,
      body : <BubbleModal
        seg={s}
        onClose={zoomStack.pop}
      />
    });
  };

  return (
    <div className="dk-root">
      <style>{CSS}</style>

      <header className="dk-status">
        <Link
          href="/mockups"
          className="dk-back"
        >
          ◄ EXIT
        </Link>
        <span className="dk-sys">{MEETING.title.toUpperCase()}</span>
        <span className="dk-readout"><span className="dk-blip" />REC {MEETING.elapsed}</span>
        <span className="dk-readout dk-dim">NODES {NODES.length}</span>
        <span className="dk-readout dk-dim">SEG {SEGMENTS.length}</span>
        <div
          className="dk-layoutctl"
          title="Focal position"
        >
          {([0, 1, 2] as const).map(s => (
            <button
              key={s}
              type="button"
              className={`dk-lc${focalSlot === s ? ' dk-lc-on' : ''}`}
              onClick={() => moveFocal(s)}
              aria-label={`Focal ${['left', 'center', 'right'][s]}`}
            >
              {FOCAL_ICON[s]}
            </button>
          ))}
        </div>
        <div className="dk-squad">
          {COLLABORATORS.map(p => (
            <span
              key={p.id}
              className={`dk-pawn${p.you ? ' dk-pawn-you' : ''}${p.speaking ? ' dk-pawn-live' : ''}`}
              style={{ '--c': p.color } as React.CSSProperties}
              title={p.name + (p.speaking ? ' · speaking' : '')}
            >
              {p.short}
            </span>
          ))}
        </div>
      </header>

      <div
        className={`dk-deck${dragging ? ' dk-dragging' : ''}`}
        ref={deckRef}
      >
        {/* dim backdrop while a panel is expanded — click to dock */}
        {ready && expanded && (
          <button
            type="button"
            data-control
            className={`dk-backdrop${closing ? ' dk-closing' : ''}`}
            aria-label="Dock"
            onClick={() => dock()}
          />
        )}

        {ready && IDS.map(id => {
          const focal = slotOf(id) === focalSlot;
          const isExpanded = expanded === id;
          const accent = PANEL_ACCENT[id];

          // The cursor + grip glow are derived from intent: the grip lights only
          // when the pointer is over grabbable surface (not content/controls).
          const gripOn = panelGesture.hoverId === id && panelGesture.hoverIntent === 'surface';

          return (
            <section
              key={id}
              ref={setPanelRef(id)}
              data-panel={id}
              className={`dk-panel dk-panel-${accent}${focal ? ' dk-focal' : ''}${gripOn ? ' dk-grip-on' : ''}${isExpanded ? ' dk-expanded' : ''}${isExpanded && closing ? ' dk-closing' : ''}${panelGesture.dragId === id ? ' dk-dragging-panel' : ''}`}
              style={{ cursor: panelGesture.cursorFor(id) }}
              data-hover-intent={panelGesture.hoverId === id ? panelGesture.hoverIntent ?? undefined : undefined}
              {...panelGesture.handlers(id)}
            >
              <div className="dk-grip">
                <span className="dk-grip-dots"><i /><i /><i /></span>
                <span className="dk-led" />
                <span className="dk-grip-title">{PANEL_TITLE[id]}</span>
                {id === 'workflow' && !isExpanded && <span className="dk-grip-hint">{node ? 'node selected' : 'click a node to act'}</span>}
                {isExpanded ? (
                  <button
                    type="button"
                    data-control
                    className="dk-dock"
                    onClick={() => dock()}
                  >
                    DOCK ▸ <span className="dk-dock-esc">esc</span>
                  </button>
                ) : (
                  <span className="dk-grip-state">{focal ? '⤢ expand' : '▸ focus'}</span>
                )}
              </div>

              <div className="dk-body">
                {id === 'comms' && (
                  <div
                    className="dk-transcript"
                    ref={transcriptRef}
                  >
                    {isExpanded && (
                      <div className="dk-read-head">
                        <h2 className="dk-read-title">Conversation</h2>
                        <span className="dk-read-sub">{MEETING.title} · {SEGMENTS.length} messages · live</span>
                      </div>
                    )}
                    {SEGMENTS.map((s, i) => (

                      // A message is the kit's `content`-intent ChatBubble: hover
                      // cross-lights its linked nodes, tap drills into its modal,
                      // press-drag reorders the panel.
                      <ChatBubble
                        key={s.id}
                        data-seg={s.id}
                        speaker={s.speaker}
                        speakerColor={speakerColor(s.speakerId)}
                        initials={initials(s.speaker)}
                        time={offset(s.t)}
                        variant={s.bot ? 'bot' : 'default'}
                        density={isExpanded ? 'comfortable' : 'compact'}
                        interim={s.interim}
                        grouped={i > 0 && SEGMENTS[i - 1]!.speakerId === s.speakerId}
                        selected={hiSegs.has(s.id)}
                        onActivate={() => openSeg(s)}
                        onMouseEnter={() => {
                          setSeg(s.id);
                          setNode(null);
                        }}
                        onMouseLeave={() => setSeg(null)}
                      >
                        {s.text}
                      </ChatBubble>
                    ))}
                  </div>
                )}

                {id === 'workflow' && (
                  <div className="dk-wf">
                    <div className="dk-stage">
                      {isExpanded && (
                        <>
                          <div className="dk-wf-head">
                            <h2 className="dk-read-title">Workflow</h2>
                            <span className="dk-read-sub">how the conversation is organizing · {NODES.length} nodes</span>
                          </div>
                          <div className="dk-legend">
                            {([['decision', 'Decisions'], ['action', 'Actions'], ['question', 'Questions'], ['outcome', 'Outcomes']] as const).map(([kind, label]) => (
                              <span
                                key={kind}
                                className="dk-legend-item"
                              >
                                <span className={`dk-legend-dot dk-legend-${kind}`} />
                                {label}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                      <svg
                        className="dk-edges"
                        viewBox="0 0 980 640"
                        preserveAspectRatio="none"
                      >
                        {EDGES.map(([from, to], i) => {
                          const a = center(from);
                          const b = center(to);
                          const dy = (b.y - a.y) / 2;
                          const lit = hiNodes.has(from) && hiNodes.has(to);
                          const live = NODES.find(n2 => n2.id === to)?.provisional;

                          return (
                            <path
                              key={i}
                              className={`dk-edge${live ? ' dk-edge-live' : ''}${lit ? ' dk-edge-lit' : ''}`}
                              d={`M${a.x} ${a.y} C${a.x} ${a.y + dy} ${b.x} ${b.y - dy} ${b.x} ${b.y}`}
                            />
                          );
                        })}
                      </svg>

                      {NODES.map(n => (

                        // A node is `content`: hover cross-lights its evidence,
                        // tap drills into its modal, press-drag reorders the panel.
                        <div
                          key={n.id}
                          data-intent="content"
                          role="button"
                          tabIndex={0}
                          className={`dk-node dk-${n.kind}${n.provisional ? ' dk-node-live' : ''}${hiNodes.has(n.id) ? ' dk-node-sel' : ''}`}
                          style={{
                            left : `${n.x / 980 * 100}%`,
                            top  : `${n.y / 640 * 100}%`,
                            width: `${n.w / 980 * 100}%`
                          }}
                          onClick={() => openNode(n)}
                          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && openNode(n)}
                          onMouseEnter={() => {
                            setNode(n.id);
                            setSeg(null);
                          }}
                          onMouseLeave={() => setNode(null)}
                        >
                          <span className="dk-node-bracket dk-tl" />
                          <span className="dk-node-bracket dk-tr" />
                          <span className="dk-node-bracket dk-bl" />
                          <span className="dk-node-bracket dk-br" />
                          <span className="dk-node-kind">
                            <span className="dk-node-glyph">{KIND_GLYPH[n.kind]}</span>
                            {n.kind}
                            {n.provisional && <span className="dk-node-tag">◌</span>}
                          </span>
                          <span className="dk-node-label">{n.label}</span>
                          {(COMMENTS[n.id]?.length ?? 0) > 0 && <span className="dk-node-comment">💬 {COMMENTS[n.id]!.length}</span>}
                          {present.filter(p => p.focus === n.id).map(p => (
                            <span
                              key={p.id}
                              className="dk-node-focus"
                              style={{ '--c': p.color } as React.CSSProperties}
                              title={`${p.name} is here`}
                            >
                              {p.short}
                            </span>
                          ))}
                        </div>
                      ))}

                      {present.filter(p => p.cursor).map(p => (
                        <div
                          key={p.id}
                          className="dk-cursor"
                          style={{
                            left : `${p.cursor!.x / 980 * 100}%`,
                            top  : `${p.cursor!.y / 640 * 100}%`,
                            '--c': p.color
                          } as React.CSSProperties}
                        >
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 18 18"
                          >
                            <path
                              d="M2 2 L2 14 L6 10 L9 16 L11 15 L8 9 L14 9 Z"
                              fill="var(--c)"
                              stroke="oklch(0.14 0.012 250)"
                              strokeWidth="1.4"
                            />
                          </svg>
                          <span className="dk-cursor-name">{p.name.split(' ')[0]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {id === 'actions' && (isExpanded ? (
                  <ActionsExpanded hiArts={hiArts} />
                ) : (
                  <div className="dk-actions">
                    <div className="dk-gist">
                      <span className="dk-gist-h">SUMMARY</span>
                      Beta ships live transcript + live decisions; the other four artifact types generate in batch on stop.
                    </div>

                    <div className="dk-grp-h">◆ Decisions</div>
                    {DECISIONS.map(d => (
                      <div
                        key={d.id}
                        data-on={hiArts.has(d.id) || undefined}
                        className={`dk-art dk-art-decision${d.provisional ? ' dk-art-new' : ''}`}
                      >
                        <span className="dk-art-text">{d.text}</span>
                      </div>
                    ))}

                    <div className="dk-grp-h">▸ Action items</div>
                    {ACTIONS.map(a => (
                      <div
                        key={a.id}
                        data-on={hiArts.has(a.id) || undefined}
                        className={`dk-art dk-art-action${a.provisional ? ' dk-art-new' : ''}`}
                      >
                        <span className="dk-check" />
                        <div className="dk-art-body">
                          <span className="dk-art-text">{a.text}</span>
                          <span className="dk-art-meta">
                            {a.assignee && <span className="dk-owner">{a.assignee}</span>}
                            {a.due && <span> · due {a.due}</span>}
                          </span>
                        </div>
                      </div>
                    ))}

                    <div className="dk-peace">
                      <div className="dk-peace-bar">
                        <span className="dk-peace-core">✦</span>
                        peace
                        <span className="dk-peace-state">online · 1 suggestion</span>
                      </div>
                      <div className="dk-abilities">
                        {AGENT_ACTIONS.slice(0, 2).map(a => (
                          <button
                            key={a.label}
                            type="button"
                            className="dk-ability"
                          >
                            <span className="dk-ability-icon">{a.icon}</span>
                            {a.label}
                          </button>
                        ))}
                      </div>
                      <div
                        className="dk-cmdline"
                        data-control
                      >
                        <span className="dk-cmd-pr">peace ▸</span>
                        <span className="dk-cmd-ph">issue a command…</span>
                        <span className="dk-cmd-key">⏎</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {/* resize gutters — sit inside the gap, never over panel bodies */}
        {ready && !expanded && [0, 1].map(k => {
          const hx = geom.sx[k]! + geom.sw[k]! + GAP / 2;

          return (
            <div
              key={k}
              data-control
              className={`dk-seam${dragging ? ' dk-seam-drag' : ''}`}
              style={{
                transform: `translate3d(${hx}px, ${PAD}px, 0)`,
                height   : `${geom.h}px`
              }}
              onPointerDown={onSeamDown(k)}
              onPointerMove={onSeamMove}
              onPointerUp={onSeamUp}
            >
              <span className="dk-seam-grip" />
            </div>
          );
        })}
      </div>

      <ZoomStack
        stack={zoomStack.stack}
        onPop={zoomStack.pop}
      />
    </div>
  );
}

const CSS = `
.dk-root {
  --dk-field: oklch(0.14 0.012 250);
  --dk-panel: oklch(0.175 0.014 250);
  --dk-raised: oklch(0.22 0.016 250);
  --dk-line: oklch(0.84 0.12 205 / 0.22);
  --dk-cyan: oklch(0.84 0.12 205);
  --dk-amber: oklch(0.82 0.15 75);
  --dk-ink-strong: oklch(0.96 0.01 230);
  --dk-ink: oklch(0.8 0.015 230);
  --dk-ink-muted: oklch(0.6 0.02 230);
  --dk-ink-faint: oklch(0.46 0.02 230);
  --dk-decision: oklch(0.82 0.15 75);
  --dk-action: oklch(0.8 0.16 150);
  --dk-question: oklch(0.78 0.13 285);
  --dk-topic: oklch(0.9 0.01 230);
  --dk-outcome: oklch(0.6 0.02 250);

  position: absolute; inset: 0; overflow: hidden;
  font-family: var(--font-hanken), system-ui, sans-serif;
  color: var(--dk-ink); background: var(--dk-field);
  background-image: linear-gradient(oklch(0.84 0.12 205 / 0.035) 1px, transparent 1px), linear-gradient(90deg, oklch(0.84 0.12 205 / 0.035) 1px, transparent 1px);
  background-size: 40px 40px;
}
.dk-root button { font-family: inherit; }

.dk-status { position: relative; height: 44px; display: flex; align-items: center; gap: 18px; padding: 0 16px; background: oklch(0.16 0.014 250 / 0.92); border-bottom: 1px solid var(--dk-line); z-index: 10; font-family: var(--font-mono); }
.dk-back { font-size: 11px; letter-spacing: 0.1em; color: var(--dk-ink-muted); text-decoration: none; transition: color 150ms; }
.dk-back:hover { color: var(--dk-cyan); }
.dk-sys { font-size: 12.5px; font-weight: 700; letter-spacing: 0.1em; color: var(--dk-ink-strong); }
.dk-readout { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; letter-spacing: 0.08em; color: var(--dk-cyan); }
.dk-readout.dk-dim { color: var(--dk-ink-faint); }
.dk-blip { width: 7px; height: 7px; border-radius: 50%; background: var(--dk-amber); box-shadow: 0 0 8px var(--dk-amber); animation: dk-pulse 1.6s ease-in-out infinite; }
@keyframes dk-pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
.dk-layoutctl { display: inline-flex; gap: 2px; padding: 2px; border: 1px solid var(--dk-line); border-radius: 4px; }
.dk-lc { font-family: var(--font-mono); font-size: 9px; letter-spacing: 1px; color: var(--dk-ink-faint); background: transparent; border: 0; padding: 3px 5px; cursor: pointer; transition: all 140ms; }
.dk-lc:hover { color: var(--dk-ink); }
.dk-lc-on { color: var(--dk-cyan); background: oklch(0.84 0.12 205 / 0.12); }
.dk-squad { margin-left: auto; display: flex; align-items: center; gap: 4px; }
.dk-pawn { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; font-size: 9px; font-weight: 700; color: oklch(0.14 0.012 250); background: var(--c); clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px)); }
.dk-pawn-you { background: var(--dk-raised); color: var(--dk-ink); }
.dk-pawn-live { box-shadow: 0 0 0 1.5px var(--c), 0 0 12px -2px var(--c); animation: dk-pulse 1.4s ease-in-out infinite; }

/* deck stage */
.dk-deck { position: absolute; inset: 44px 0 0 0; }

.dk-panel {
  position: absolute; top: 0; left: 0;
  display: flex; flex-direction: column; overflow: hidden;
  background: oklch(0.17 0.014 250 / 0.9); border: 1px solid var(--dk-line);
  clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px));
  contain: layout paint; will-change: transform, width;
}
.dk-panel-cyan.dk-focal { border-color: oklch(0.84 0.12 205 / 0.55); box-shadow: 0 0 50px -26px var(--dk-cyan); }
.dk-panel-amber.dk-focal { border-color: oklch(0.82 0.15 75 / 0.55); box-shadow: 0 0 50px -26px var(--dk-amber); }
.dk-panel.dk-grip-on { border-color: var(--dk-cyan); box-shadow: 0 0 34px -14px var(--dk-cyan), inset 0 0 50px -34px var(--dk-cyan); }
.dk-panel-amber.dk-grip-on { border-color: var(--dk-amber); box-shadow: 0 0 34px -14px var(--dk-amber), inset 0 0 50px -34px var(--dk-amber); }

/* grip = the move/expand affordance */
.dk-grip { display: flex; align-items: center; gap: 9px; padding: 9px 13px; border-bottom: 1px solid var(--dk-line); background: oklch(0.84 0.12 205 / 0.04); flex-shrink: 0; transition: background 180ms; }
.dk-panel-amber .dk-grip { background: oklch(0.82 0.15 75 / 0.05); }
.dk-grip-on .dk-grip { background: oklch(0.84 0.12 205 / 0.14); }
.dk-panel-amber.dk-grip-on .dk-grip { background: oklch(0.82 0.15 75 / 0.16); }
.dk-grip-dots { display: inline-flex; gap: 2px; opacity: 0.35; transition: opacity 180ms; }
.dk-grip-on .dk-grip-dots { opacity: 0.9; }
.dk-grip-dots i { width: 3px; height: 3px; border-radius: 50%; background: var(--dk-cyan); }
.dk-panel-amber .dk-grip-dots i { background: var(--dk-amber); }
.dk-led { width: 6px; height: 6px; border-radius: 50%; background: var(--dk-cyan); box-shadow: 0 0 8px var(--dk-cyan); }
.dk-panel-amber .dk-led { background: var(--dk-amber); box-shadow: 0 0 8px var(--dk-amber); }
.dk-grip-title { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.14em; font-weight: 600; color: var(--dk-ink-strong); white-space: nowrap; }
.dk-grip-hint { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.05em; color: var(--dk-ink-faint); white-space: nowrap; overflow: hidden; }
.dk-grip-state { margin-left: auto; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.08em; color: var(--dk-ink-faint); white-space: nowrap; }
.dk-grip-on .dk-grip-state { color: var(--dk-cyan); }
.dk-panel-amber.dk-grip-on .dk-grip-state { color: var(--dk-amber); }
.dk-body { flex: 1; min-height: 0; position: relative; }

/* drag-to-reorder (tap = max/min, press+drag = reorder; cursor set inline) */
.dk-dragging-panel { z-index: 30; box-shadow: 0 30px 70px -24px oklch(0 0 0 / 0.8), 0 0 0 1px var(--dk-cyan); }
.dk-dragging-panel .dk-grip { background: oklch(0.84 0.12 205 / 0.16); }
.dk-panel-amber.dk-dragging-panel { box-shadow: 0 30px 70px -24px oklch(0 0 0 / 0.8), 0 0 0 1px var(--dk-amber); }

/* resize gutter — width = the gap, so it never overlaps a panel body */
.dk-seam { position: absolute; top: 0; left: 0; width: 10px; margin-left: -5px; display: flex; align-items: center; justify-content: center; cursor: col-resize; z-index: 8; touch-action: none; }
.dk-dragging { cursor: col-resize; user-select: none; }
.dk-dragging .dk-panel { cursor: col-resize !important; }
.dk-seam-grip { width: 3px; height: 34px; border-radius: 3px; background: var(--dk-line); transition: background 150ms, height 150ms, box-shadow 150ms; }
.dk-seam:hover .dk-seam-grip, .dk-seam-drag .dk-seam-grip { background: var(--dk-cyan); height: 64px; box-shadow: 0 0 14px -2px var(--dk-cyan); }

/* expand-to-fullscreen */
.dk-panel { z-index: 1; }
.dk-backdrop { position: absolute; inset: 0; z-index: 15; border: 0; padding: 0; background: oklch(0.1 0.01 250 / 0.55); backdrop-filter: blur(3px); cursor: pointer; animation: dk-fade 200ms ease; }
.dk-backdrop.dk-closing { animation: dk-fade 260ms ease reverse forwards; }
@keyframes dk-fade { from { opacity: 0; } }
.dk-expanded { z-index: 20; box-shadow: 0 0 90px -24px oklch(0.84 0.12 205 / 0.6); }
.dk-panel-amber.dk-expanded { box-shadow: 0 0 90px -24px oklch(0.82 0.15 75 / 0.6); }
.dk-dock { margin-left: auto; display: inline-flex; align-items: center; gap: 7px; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em; color: var(--dk-cyan); background: oklch(0.84 0.12 205 / 0.1); border: 1px solid var(--dk-line); padding: 4px 10px; cursor: pointer; transition: all 140ms; }
.dk-panel-amber .dk-dock { color: var(--dk-amber); background: oklch(0.82 0.15 75 / 0.1); }
.dk-dock:hover { border-color: currentColor; }
.dk-dock-esc { font-size: 8px; color: var(--dk-ink-faint); border: 1px solid var(--dk-line); padding: 0 3px; letter-spacing: 0.08em; }

/* transcript container — the ChatBubble items (kit) own their own styles. */
.dk-transcript { position: absolute; inset: 0; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 2px; }

/* transcript — EXPANDED: a centered, comfortable reading column (the bubbles
   switch to density="comfortable"; this just centers + animates the column). */
.dk-expanded .dk-transcript { align-items: center; padding: 0 24px 64px; gap: 0; animation: dk-zoom-in 360ms cubic-bezier(0.22,1,0.36,1); transform-origin: center top; }
.dk-closing .dk-transcript { animation: dk-zoom-out 280ms cubic-bezier(0.4,0,1,1) both; }
@keyframes dk-zoom-in { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
@keyframes dk-zoom-out { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.92); } }
.dk-read-head { width: 100%; max-width: 760px; padding: 30px 4px 20px; margin-bottom: 10px; border-bottom: 1px solid var(--dk-line); }
.dk-read-title { font-family: var(--font-fraunces), serif; font-size: 26px; font-weight: 500; color: var(--dk-ink-strong); letter-spacing: -0.01em; }
.dk-read-sub { display: block; margin-top: 5px; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.04em; color: var(--dk-ink-muted); }

/* workflow */
.dk-wf { position: absolute; inset: 0; display: flex; }
.dk-stage { flex: 1; min-width: 0; position: relative; }
.dk-edges { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.dk-edge { fill: none; stroke: var(--dk-line); stroke-width: 1.3; transition: stroke 200ms, stroke-width 200ms; }
.dk-edge-live { stroke: oklch(0.82 0.15 75 / 0.5); stroke-dasharray: 4 4; animation: dk-flow 22s linear infinite; }
.dk-edge-lit { stroke: var(--dk-cyan); stroke-width: 2; }
@keyframes dk-flow { to { stroke-dashoffset: -200; } }
.dk-node { position: absolute; transform: translate(-50%, -50%); text-align: left; display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; background: oklch(0.175 0.014 250 / 0.95); border: 1px solid oklch(0.84 0.12 205 / 0.3); cursor: inherit; transition: border-color 160ms, box-shadow 200ms; clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)); }
.dk-node:hover { border-color: var(--dk-cyan); box-shadow: 0 0 20px -6px var(--dk-cyan); z-index: 4; }
.dk-node-kind { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 600; }
.dk-node-glyph { font-size: 9px; }
.dk-node-label { font-size: 11.5px; line-height: 1.28; color: var(--dk-ink-strong); font-weight: 500; }
.dk-node-tag { color: var(--dk-amber); animation: dk-blink 1.4s steps(2) infinite; }
@keyframes dk-blink { 50% { opacity: 0.3; } }
.dk-node-comment { position: absolute; bottom: -8px; left: 8px; font-size: 8.5px; font-family: var(--font-mono); color: var(--dk-ink-muted); background: var(--dk-raised); border: 1px solid var(--dk-line); padding: 0 4px; border-radius: 3px; }
.dk-topic { border-color: oklch(0.9 0.01 230 / 0.3); }
.dk-topic .dk-node-kind { color: var(--dk-topic); }
.dk-decision .dk-node-kind { color: var(--dk-decision); }
.dk-action .dk-node-kind { color: var(--dk-action); }
.dk-question .dk-node-kind { color: var(--dk-question); }
.dk-outcome { background: oklch(0.16 0.012 250 / 0.9); }
.dk-outcome .dk-node-kind { color: var(--dk-outcome); }
.dk-node-live { border-color: var(--dk-amber); box-shadow: 0 0 22px -8px var(--dk-amber); }
.dk-node-sel { border-color: var(--dk-cyan); box-shadow: 0 0 0 1px var(--dk-cyan), 0 0 26px -6px var(--dk-cyan); z-index: 5; }
.dk-node-bracket { position: absolute; width: 6px; height: 6px; border: 1.5px solid var(--dk-cyan); opacity: 0; transition: opacity 160ms; }
.dk-node:hover .dk-node-bracket, .dk-node-sel .dk-node-bracket, .dk-node-live .dk-node-bracket { opacity: 0.9; }
.dk-node-live .dk-node-bracket { border-color: var(--dk-amber); }
.dk-tl { top: -3px; left: -3px; border-right: 0; border-bottom: 0; }
.dk-tr { top: -3px; right: -3px; border-left: 0; border-bottom: 0; }
.dk-bl { bottom: -3px; left: -3px; border-right: 0; border-top: 0; }
.dk-br { bottom: -3px; right: -3px; border-left: 0; border-top: 0; }
.dk-node-focus { position: absolute; top: -8px; right: -8px; width: 16px; height: 16px; border-radius: 50%; background: var(--c); color: oklch(0.14 0.012 250); font-size: 7.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 1.5px solid var(--dk-field); }
.dk-cursor { position: absolute; pointer-events: none; z-index: 6; transition: left 2s ease, top 2s ease; }
.dk-cursor-name { position: absolute; left: 12px; top: 10px; white-space: nowrap; font-family: var(--font-mono); font-size: 9px; font-weight: 600; color: oklch(0.14 0.012 250); background: var(--c); padding: 1px 4px; }

/* diagram — EXPANDED: a legible board with a header, legend, and bigger nodes */
.dk-wf-head { position: absolute; top: 14px; left: 18px; z-index: 3; pointer-events: none; animation: dk-fade-up 420ms cubic-bezier(0.22,1,0.36,1) 60ms both; }
.dk-legend { position: absolute; top: 18px; right: 18px; z-index: 3; display: flex; gap: 14px; pointer-events: none; padding: 8px 12px; background: oklch(0.16 0.013 250 / 0.7); border: 1px solid var(--dk-line); clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)); animation: dk-fade-up 420ms cubic-bezier(0.22,1,0.36,1) 120ms both; }
@keyframes dk-fade-up { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
.dk-legend-item { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.06em; color: var(--dk-ink-muted); }
.dk-legend-dot { width: 8px; height: 8px; border-radius: 2px; }
.dk-legend-decision { background: var(--dk-decision); }
.dk-legend-action { background: var(--dk-action); }
.dk-legend-question { background: var(--dk-question); }
.dk-legend-outcome { background: var(--dk-outcome); }
.dk-expanded .dk-stage { margin: 8px; }
.dk-expanded .dk-node { padding: 12px 15px; gap: 6px; clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px)); }
.dk-expanded .dk-node-kind { font-size: 9.5px; gap: 6px; }
.dk-expanded .dk-node-glyph { font-size: 11px; }
.dk-expanded .dk-node-label { font-size: 14.5px; line-height: 1.32; }
.dk-expanded .dk-node-comment { font-size: 10px; bottom: -9px; }
.dk-expanded .dk-edge { stroke-width: 1.6; }
.dk-expanded .dk-edge-lit { stroke-width: 2.4; }

/* actions — EXPANDED: a readable record + a peace command surface */
.dk-act-x { position: absolute; inset: 0; overflow-y: auto; padding: 0 30px 50px; animation: dk-fade 340ms ease; }
.dk-closing .dk-act-x { animation: dk-fade 240ms ease reverse both; }
.dk-act-x .dk-read-head { max-width: 100%; }
.dk-act-lead { font-family: var(--font-fraunces), serif; font-size: 21px; line-height: 1.45; color: var(--dk-ink-strong); letter-spacing: -0.01em; margin: 14px 0 24px; max-width: 880px; }
.dk-act-cols { display: grid; grid-template-columns: 1.5fr 1fr; gap: 30px; align-items: start; }
.dk-act-main { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.dk-act-two { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
.dk-act-side { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.dk-act-h { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--dk-cyan); margin-bottom: 12px; }
.dk-act-h-amber { color: var(--dk-amber); }
.dk-act-card { padding: 14px 16px; margin-bottom: 9px; background: oklch(0.2 0.014 250 / 0.6); border: 1px solid var(--dk-line); border-left: 2px solid var(--dk-line); transition: background 160ms, box-shadow 200ms; clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px)); }
.dk-act-card.dk-art-decision { border-left-color: var(--dk-decision); }
.dk-act-card.dk-art-question { border-left-color: var(--dk-question); }
.dk-act-card.dk-act-card-quiet { border-left-color: var(--dk-outcome); background: oklch(0.18 0.012 250 / 0.5); }
.dk-act-card[data-on] { background: oklch(0.84 0.12 205 / 0.12); box-shadow: 0 0 0 1px var(--dk-cyan), 0 0 22px -8px var(--dk-cyan); }
.dk-act-card-text { font-size: 15px; line-height: 1.5; color: var(--dk-ink-strong); }
.dk-act-card-sub { font-size: 13px; line-height: 1.5; color: var(--dk-ink-muted); margin-top: 7px; font-style: italic; }
.dk-act-todo { display: flex; gap: 10px; padding: 12px 14px; margin-bottom: 8px; background: oklch(0.2 0.014 250 / 0.6); border: 1px solid var(--dk-line); transition: background 160ms, box-shadow 200ms; clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)); }
.dk-act-todo[data-on] { background: oklch(0.84 0.12 205 / 0.12); box-shadow: 0 0 0 1px var(--dk-cyan); }
.dk-act-todo-text { font-size: 14px; line-height: 1.4; color: var(--dk-ink-strong); display: block; }
.dk-act-console { background: oklch(0.155 0.013 250); border: 1px solid var(--dk-line); padding: 14px; clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px)); }
.dk-act-thread { display: flex; flex-direction: column; gap: 8px; padding: 12px 0; border-top: 1px solid var(--dk-line); border-bottom: 1px solid var(--dk-line); margin: 10px 0 12px; }
.dk-turn { font-size: 12.5px; line-height: 1.5; padding: 9px 12px; max-width: 92%; clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)); }
.dk-turn-user { align-self: flex-end; background: var(--dk-raised); color: var(--dk-ink); }
.dk-turn-peace { align-self: flex-start; background: oklch(0.82 0.15 75 / 0.1); border: 1px solid oklch(0.82 0.15 75 / 0.25); color: var(--dk-ink-strong); }
.dk-thread-actions { display: flex; gap: 7px; margin-top: 2px; }
.dk-go { font-family: inherit; font-size: 12px; font-weight: 600; color: var(--dk-field); background: var(--dk-amber); border: 0; padding: 7px 12px; cursor: pointer; clip-path: polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 7px 100%, 0 calc(100% - 7px)); }
.dk-go-ghost { background: transparent; color: var(--dk-ink-muted); border: 1px solid var(--dk-line); }
.dk-act-abil { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }

/* inspector */
.dk-inspect { width: 0; flex-shrink: 0; overflow: hidden; transition: width 460ms cubic-bezier(0.22,1,0.36,1); }
.dk-inspect-open { width: 290px; border-left: 1px solid var(--dk-line); }
.dk-inspect-inner { width: 290px; height: 100%; overflow-y: auto; padding: 14px; background: oklch(0.155 0.013 250); }
.dk-inspect-bar { display: flex; align-items: center; justify-content: space-between; }
.dk-inspect-kind { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700; color: var(--dk-cyan); }
.dk-inspect-x { width: 24px; height: 24px; background: transparent; border: 1px solid var(--dk-line); color: var(--dk-ink-muted); cursor: pointer; transition: all 150ms; }
.dk-inspect-x:hover { color: var(--dk-ink-strong); border-color: var(--dk-ink-muted); }
.dk-inspect-title { font-size: 16px; line-height: 1.32; font-weight: 600; color: var(--dk-ink-strong); margin: 10px 0 8px; }
.dk-inspect-ev { font-family: var(--font-mono); font-size: 10px; color: var(--dk-cyan); padding-bottom: 12px; border-bottom: 1px solid var(--dk-line); }
.dk-inspect-sec { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.14em; color: var(--dk-ink-faint); margin: 14px 0 9px; }
.dk-comments { display: flex; flex-direction: column; gap: 10px; }
.dk-comment { display: flex; gap: 9px; }
.dk-comment-av { flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; background: var(--c); color: oklch(0.14 0.012 250); font-size: 8.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.dk-comment-who { display: block; font-size: 11px; font-weight: 700; color: var(--dk-ink); margin-bottom: 2px; }
.dk-comment-text { font-size: 12.5px; line-height: 1.45; color: var(--dk-ink-muted); }
.dk-comment-empty { font-size: 12px; color: var(--dk-ink-faint); font-style: italic; }
.dk-comment-input { display: flex; align-items: center; gap: 8px; margin-top: 11px; padding: 8px 10px; background: var(--dk-field); border: 1px solid var(--dk-line); cursor: text; }
.dk-ci-icon { font-size: 12px; }
.dk-ci-ph { font-size: 12px; color: var(--dk-ink-faint); }
.dk-inspect-actions { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
.dk-inspect-actions button { text-align: left; font-size: 12px; color: var(--dk-ink); background: oklch(0.84 0.12 205 / 0.05); border: 1px solid var(--dk-line); padding: 8px 11px; cursor: pointer; transition: all 140ms; clip-path: polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 7px 100%, 0 calc(100% - 7px)); }
.dk-inspect-actions button:hover { border-color: var(--dk-cyan); background: oklch(0.84 0.12 205 / 0.12); color: var(--dk-ink-strong); }

/* actions panel */
.dk-actions { position: absolute; inset: 0; overflow-y: auto; padding: 12px; }
.dk-gist { font-size: 13px; line-height: 1.5; color: var(--dk-ink-strong); padding: 10px 12px; margin-bottom: 14px; background: oklch(0.84 0.12 205 / 0.05); border: 1px solid var(--dk-line); clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)); }
.dk-gist-h { display: block; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.16em; color: var(--dk-cyan); margin-bottom: 6px; }
.dk-grp-h { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dk-ink-muted); margin: 14px 0 8px; }
.dk-art { display: flex; gap: 9px; padding: 10px 12px; margin-bottom: 7px; background: oklch(0.2 0.014 250 / 0.6); border: 1px solid var(--dk-line); border-left-width: 2px; transition: background 160ms, box-shadow 200ms; clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)); }
.dk-art-decision { border-left-color: var(--dk-decision); }
.dk-art-action { border-left-color: var(--dk-action); }
.dk-art-question { border-left-color: var(--dk-question); }
.dk-art[data-on] { background: oklch(0.84 0.12 205 / 0.12); box-shadow: 0 0 0 1px var(--dk-cyan), 0 0 22px -8px var(--dk-cyan); }
.dk-art-new { box-shadow: inset 2px 0 0 var(--dk-amber); }
.dk-art-text { font-size: 13px; line-height: 1.4; color: var(--dk-ink-strong); }
.dk-check { flex-shrink: 0; width: 14px; height: 14px; margin-top: 2px; border: 1.5px solid var(--dk-action); }
.dk-art-body { flex: 1; }
.dk-art-meta { display: flex; align-items: center; gap: 5px; margin-top: 5px; font-size: 11px; color: var(--dk-ink-muted); }
.dk-owner { font-family: var(--font-mono); font-weight: 700; color: var(--dk-action); }
.dk-peace { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--dk-line); }
.dk-peace-bar { display: flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.06em; color: var(--dk-ink); margin-bottom: 10px; }
.dk-peace-core { color: var(--dk-amber); font-size: 13px; }
.dk-peace-state { margin-left: auto; font-size: 9.5px; color: var(--dk-ink-faint); letter-spacing: 0.04em; }
.dk-abilities { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.dk-ability { display: inline-flex; align-items: center; gap: 7px; font-size: 11.5px; color: var(--dk-ink); background: oklch(0.82 0.15 75 / 0.06); border: 1px solid var(--dk-line); padding: 6px 10px; cursor: pointer; transition: all 140ms; clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px)); }
.dk-ability:hover { border-color: var(--dk-amber); background: oklch(0.82 0.15 75 / 0.14); color: var(--dk-ink-strong); }
.dk-ability-icon { color: var(--dk-amber); }
.dk-cmdline { display: flex; align-items: center; gap: 9px; padding: 10px 12px; background: oklch(0.13 0.012 250); border: 1px solid oklch(0.82 0.15 75 / 0.3); cursor: text; }
.dk-cmd-pr { font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--dk-amber); }
.dk-cmd-ph { flex: 1; font-family: var(--font-mono); font-size: 12px; color: var(--dk-ink-faint); }
.dk-cmd-key { font-family: var(--font-mono); font-size: 10.5px; color: var(--dk-ink-faint); border: 1px solid var(--dk-line); padding: 1px 5px; }

/* drill-down modal body (rendered inside the kit's ZoomStack card) */
.dk-modal { padding: 22px 24px 20px; font-family: var(--font-hanken), sans-serif; }
.dk-modal-head { display: flex; align-items: center; justify-content: space-between; }
.dk-modal-kind { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700; color: var(--dk-cyan); }
.dk-modal-x { width: 28px; height: 28px; background: transparent; border: 1px solid var(--dk-line); color: var(--dk-ink-muted); cursor: pointer; border-radius: 7px; transition: all 150ms; }
.dk-modal-x:hover { color: var(--dk-ink-strong); border-color: var(--dk-ink-muted); }
.dk-modal-title { font-family: var(--font-fraunces), serif; font-size: 25px; font-weight: 500; color: var(--dk-ink-strong); margin: 10px 0 2px; letter-spacing: -0.01em; line-height: 1.18; }
.dk-modal-sec { margin-top: 18px; padding-top: 15px; border-top: 1px solid var(--dk-line); }
.dk-modal-h { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; color: var(--dk-cyan); margin: 0 0 11px; }
.dk-modal-evidence { display: flex; flex-direction: column; gap: 3px; }
.dk-modal-empty { font-size: 12.5px; color: var(--dk-ink-faint); font-style: italic; margin: 0; }
.dk-modal-link { font-size: 13px; color: var(--dk-ink); padding: 8px 11px; border: 1px solid var(--dk-line); border-radius: 9px; margin-bottom: 6px; }
.dk-modal-actions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 20px; }
.dk-modal-actions button { font-family: inherit; font-size: 12px; color: var(--dk-ink); background: oklch(0.84 0.12 205 / 0.05); border: 1px solid var(--dk-line); padding: 8px 13px; cursor: pointer; border-radius: 9px; transition: all 140ms; }
.dk-modal-actions button:hover { border-color: var(--dk-cyan); background: oklch(0.84 0.12 205 / 0.12); color: var(--dk-ink-strong); }
`;
