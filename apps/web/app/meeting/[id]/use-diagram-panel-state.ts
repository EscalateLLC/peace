'use client';

import { useEffect, useRef, useState } from 'react';

export type WfMin = 'diagram' | 'tree' | null;

/**
 * The workflow panel's diagram-side UI state: which split pane is minimised, a
 * synchronous "busy" flag that masks the diagram's reposition snap on layout
 * changes, and the agent-control lock. Split out of DeckWorkspace.
 */
export function useDiagramPanelState (expanded: string | null) {
  // In the expanded workflow, which side (if any) is minimized.
  const [wfMin, setWfMin] = useState<WfMin>(null);

  // The diagram canvas resizes whenever the workflow expands/collapses or a pane
  // minimises. Flag it busy SYNCHRONOUSLY on those changes (the diagram's own
  // ResizeObserver is a frame late) so it hides before it can visibly snap.
  const [diagramBusy, setDiagramBusy] = useState(false);
  const busyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const layoutMounted = useRef(false);

  // Agent-control lock: suspends user pan/zoom/drill on the diagram. Toggled
  // manually for now; the conversational agent will drive this same flag.
  const [diagramLocked, setDiagramLocked] = useState(false);

  useEffect(() => {
    if (!layoutMounted.current) {
      layoutMounted.current = true;

      return;
    }

    setDiagramBusy(true);
    clearTimeout(busyTimer.current);
    busyTimer.current = setTimeout(() => setDiagramBusy(false), 480);

    return () => clearTimeout(busyTimer.current);
  }, [expanded, wfMin]);

  // Restore both workflow panes whenever it collapses.
  useEffect(() => {
    if (expanded !== 'workflow') {
      setWfMin(null);
    }
  }, [expanded]);

  return {
    wfMin,
    setWfMin,
    diagramBusy,
    setDiagramBusy,
    diagramLocked,
    setDiagramLocked
  };
}
