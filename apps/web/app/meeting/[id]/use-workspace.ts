'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArtifactType, MeetingNotice, WorkspaceDelta } from '@peace/core';
import { applyWorkspaceDelta, type LiveState, type WorkspaceData, type WorkspaceDataAdapter } from '@peace/ui';

const LIVE_POLL_MS = 2500;
const IDLE_POLL_MS = 15000;
const NOTICE_DISMISS_MS = 8000;

export interface Workspace {
  data: WorkspaceData | null;
  error: string | null;
  notice: MeetingNotice | null;
  liveState: LiveState | null;
  highlightedIds: ReadonlySet<string>;
  regenerating: boolean;
  highlight: (segmentIds: string[]) => void;
  clearHighlight: () => void;
  regenerate: () => void;
  saveDiagram: (mermaid: string) => Promise<void>;
  loadVersions: (type: ArtifactType) => Promise<WorkspaceData['artifacts']>;
  dismissNotice: () => void;
}

/**
 * The workspace data layer: one WorkspaceData payload kept live via the adapter's
 * subscription (deltas) with a polling fallback. View-agnostic — feed it to any
 * themed workspace. Ported from @peace/ui's WorkspaceShell internals.
 */
export function useWorkspace (meetingId: string, adapter: WorkspaceDataAdapter): Workspace {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<MeetingNotice | null>(null);
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<ReadonlySet<string>>(new Set());
  const [regenerating, setRegenerating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const refresh = useCallback(async () => {
    try {
      const next = await adapter.getWorkspace(meetingId);

      setData(next);
      setError(null);

      return next;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));

      return null;
    }
  }, [adapter, meetingId]);

  useEffect(() => {
    let cancelled = false;

    if (adapter.subscribe) {
      const buffered: WorkspaceDelta[] = [];
      let snapshotLoaded = false;

      const subscription = adapter.subscribe(meetingId, delta => {
        if (cancelled) {
          return;
        }

        if (delta.type === 'meeting.notice') {
          setNotice(delta.payload);

          return;
        }

        if (!snapshotLoaded) {
          buffered.push(delta);

          return;
        }

        setData(current => (current ? applyWorkspaceDelta(current, delta) : current));
      });

      setLiveState(subscription.state);

      const offStateChange = subscription.onStateChange(state => {
        if (!cancelled) {
          setLiveState(state);
        }
      });

      refresh().then(() => {
        snapshotLoaded = true;

        if (!cancelled && buffered.length > 0) {
          setData(current => (current ? buffered.reduce(applyWorkspaceDelta, current) : current));
        }
      })
        .catch(() => undefined);

      return () => {
        cancelled = true;
        offStateChange();
        subscription.unsubscribe();
      };
    }

    const tick = async () => {
      const next = await refresh();

      if (!cancelled) {
        timerRef.current = setTimeout(() => {
          tick().catch(() => undefined);
        }, next?.meeting.status === 'live' ? LIVE_POLL_MS : IDLE_POLL_MS);
      }
    };

    tick().catch(() => undefined);

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
  }, [adapter, meetingId, refresh]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = setTimeout(() => setNotice(null), NOTICE_DISMISS_MS);

    return () => clearTimeout(timer);
  }, [notice]);

  const highlight = useCallback((segmentIds: string[]) => setHighlightedIds(new Set(segmentIds)), []);
  const clearHighlight = useCallback(() => setHighlightedIds(new Set()), []);

  const regenerate = useCallback(() => {
    setRegenerating(true);
    adapter.regenerateArtifacts(meetingId)
      .then(refresh)
      .catch((regenError: unknown) => setError(regenError instanceof Error ? regenError.message : String(regenError)))
      .finally(() => setRegenerating(false));
  }, [adapter, meetingId, refresh]);

  const saveDiagram = useCallback(async (mermaid: string) => {
    await adapter.saveDiagramSource(meetingId, mermaid);
    await refresh();
  }, [adapter, meetingId, refresh]);

  const loadVersions = useCallback((type: ArtifactType) => adapter.getArtifactVersions(meetingId, type), [adapter, meetingId]);
  const dismissNotice = useCallback(() => setNotice(null), []);

  return {
    data,
    error,
    notice,
    liveState,
    highlightedIds,
    regenerating,
    highlight,
    clearHighlight,
    regenerate,
    saveDiagram,
    loadVersions,
    dismissNotice
  };
}
