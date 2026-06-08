'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArtifactType, MeetingNotice, WorkspaceDelta } from '@peace/core';
import type { LiveState, WorkspaceData, WorkspaceDataAdapter } from './adapter';
import { applyWorkspaceDelta } from './workspace-delta';
import { TranscriptPanel } from './transcript-panel';
import { ArtifactsPanel } from './artifacts-panel';
import { DiagramCanvas } from './diagram-canvas';

const LIVE_POLL_MS = 2500;
const IDLE_POLL_MS = 15000;
const NOTICE_DISMISS_MS = 8000;

export interface WorkspaceShellProps {
  meetingId: string;
  adapter: WorkspaceDataAdapter;
}

/**
 * The workspace: three panes (transcript | artifacts | diagram) over one
 * WorkspaceData payload, polled while the meeting is live. Evidence chips
 * anywhere highlight + scroll the transcript pane.
 */
export function WorkspaceShell ({ meetingId, adapter }: WorkspaceShellProps) {
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

    // Live path: subscribe immediately (buffering deltas), snapshot once,
    // then apply the stream. Dedup in applyWorkspaceDelta makes the
    // subscribe/snapshot overlap harmless.
    if (adapter.subscribe) {
      const buffered: WorkspaceDelta[] = [];
      let snapshotLoaded = false;

      const subscription = adapter.subscribe(meetingId, delta => {
        if (cancelled) {
          return;
        }

        // Notices are ephemeral: act on them immediately, never buffer/replay
        // (a notice that arrived during the snapshot window is already stale).
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

    // Fallback path (adapters without subscribe): the original polling loop.
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

  // Auto-dismiss a notice ~8s after it arrives. Keyed on the notice object
  // identity (a fresh object per push) so a repeated notice restarts the timer.
  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = setTimeout(() => setNotice(null), NOTICE_DISMISS_MS);

    return () => clearTimeout(timer);
  }, [notice]);

  const highlight = useCallback((segmentIds: string[]) => {
    setHighlightedIds(new Set(segmentIds));
  }, []);

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

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        {error ? `Failed to load workspace: ${error}` : 'Loading workspace…'}
      </div>
    );
  }

  const live = data.meeting.status === 'live';
  const diagram = data.artifacts.find(artifact => artifact.type === 'diagram') ?? null;

  return (
    <div
      className="flex h-full flex-col bg-zinc-950 text-zinc-200"
      onClick={event => {
        // Clicking anywhere outside an evidence control clears the highlight.
        if (!(event.target instanceof Element) || !event.target.closest('button')) {
          setHighlightedIds(new Set());
        }
      }}
    >
      <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-2.5">
        <h1 className="truncate text-sm font-semibold">{data.meeting.title}</h1>
        <StatusBadge status={data.meeting.status} />
        {live && liveState === 'degraded' && (
          <span
            className="text-[11px] text-amber-500/80"
            title="Push connection unavailable — updating by polling"
          >
            live: delayed
          </span>
        )}
        <span className="ml-auto text-[11px] text-zinc-500">
          {data.segments.length} segments · {data.meeting.platform}
        </span>
      </header>

      {error && (
        <div className="border-b border-red-900/50 bg-red-950/40 px-4 py-1.5 text-xs text-red-300">
          {error}
        </div>
      )}

      {notice && (
        <div
          className={`flex items-center gap-2 border-b px-4 py-1.5 text-xs ${NOTICE_STYLES[notice.severity]}`}
          role="status"
        >
          <span className="flex-1">{notice.message}</span>
          <button
            type="button"
            className="shrink-0 opacity-60 hover:opacity-100"
            aria-label="Dismiss"
            onClick={() => setNotice(null)}
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.2fr_1fr]">
        <section
          aria-label="Transcript"
          className="min-h-0 border-r border-zinc-800"
        >
          <TranscriptPanel
            segments={data.segments}
            highlightedIds={highlightedIds}
            live={live}
          />
        </section>
        <section
          aria-label="Artifacts"
          className="min-h-0 border-r border-zinc-800"
        >
          <ArtifactsPanel
            artifacts={data.artifacts}
            onHighlight={highlight}
            onRegenerate={regenerate}
            regenerating={regenerating}
            loadVersions={loadVersions}
          />
        </section>
        <section
          aria-label="Diagram"
          className="min-h-0"
        >
          <DiagramCanvas
            artifact={diagram}
            onHighlight={highlight}
            onSaveSource={saveDiagram}
            onRegenerate={regenerate}
            regenerating={regenerating}
          />
        </section>
      </div>
    </div>
  );
}

/** Severity → banner palette: errors reuse the red of the fetch-error banner; info/warning use the amber of "live: delayed". */
const NOTICE_STYLES: Record<MeetingNotice['severity'], string> = {
  error  : 'border-red-900/50 bg-red-950/40 text-red-300',
  warning: 'border-amber-900/50 bg-amber-950/40 text-amber-300',
  info   : 'border-sky-900/50 bg-sky-950/40 text-sky-300'
};

function StatusBadge ({ status }: { status: string }) {
  const styles: Record<string, string> = {
    live      : 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50',
    processing: 'bg-amber-950/60 text-amber-300 border-amber-700/50',
    complete  : 'bg-zinc-900 text-zinc-400 border-zinc-700',
    failed    : 'bg-red-950/60 text-red-300 border-red-800/50'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles[status] ?? styles.complete}`}>
      {status === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
      {status}
    </span>
  );
}
