'use client';

import { wsServerMessageSchema, type WorkspaceDelta } from '@peace/core';
import type { LiveState, LiveSubscription, WorkspaceData } from '@peace/ui';

const POLL_MS = 2500;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

function wsUrl (): string {
  return process.env.NEXT_PUBLIC_PEACE_WS_URL ?? `ws://${window.location.hostname}:8787`;
}

/**
 * The workspace's live feed (workspace/02): a WS subscription to the delta
 * server, with a polling loop inside this object as the degradation path. The
 * shell sees only deltas and a live/degraded flag — total transport failure
 * is exactly the old polling UX, by construction.
 *
 * The polling path *synthesizes* the same deltas from snapshots (diffing
 * against what it has already emitted), so the shell has one update path.
 */
export function createLiveSubscription (
  meetingId: string,
  onDelta: (delta: WorkspaceDelta) => void,
  fetchSnapshot: () => Promise<WorkspaceData>
): LiveSubscription {
  let state: LiveState = 'degraded';
  let closed = false;
  let socket: WebSocket | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelay = RECONNECT_BASE_MS;
  const stateListeners = new Set<(state: LiveState) => void>();

  // Dedup memory for the synthesized-delta path.
  const seenSegments = new Set<string>();
  const artifactVersions = new Map<string, number>();
  let lastStatus: string | null = null;

  function setState (next: LiveState): void {
    if (state !== next) {
      state = next;

      for (const listener of stateListeners) {
        listener(next);
      }
    }
  }

  async function pollOnce (): Promise<void> {
    const snapshot = await fetchSnapshot();

    for (const segment of snapshot.segments) {
      if (!seenSegments.has(segment.id)) {
        seenSegments.add(segment.id);
        onDelta({
          type   : 'segment.committed',
          seq    : 0,
          payload: segment
        });
      }
    }

    for (const artifact of snapshot.artifacts) {
      if ((artifactVersions.get(artifact.type) ?? 0) < artifact.version) {
        artifactVersions.set(artifact.type, artifact.version);
        onDelta({
          type   : 'artifact.committed',
          seq    : 0,
          payload: artifact
        });
      }
    }

    if (snapshot.meeting.status !== lastStatus) {
      lastStatus = snapshot.meeting.status;
      onDelta({
        type   : 'meeting.status',
        seq    : 0,
        payload: {
          meetingId,
          status: snapshot.meeting.status
        }
      });
    }
  }

  function startPolling (): void {
    if (pollTimer !== null || closed) {
      return;
    }

    const tick = () => {
      pollOnce().catch(() => undefined)
        .finally(() => {
          if (pollTimer !== null && !closed) {
            pollTimer = setTimeout(tick, POLL_MS);
          }
        });
    };

    pollTimer = setTimeout(tick, 0);
  }

  function stopPolling (): void {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function scheduleReconnect (): void {
    if (closed || reconnectTimer !== null) {
      return;
    }

    const jittered = reconnectDelay + Math.random() * reconnectDelay * 0.3;

    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, jittered);
  }

  function connect (): void {
    if (closed) {
      return;
    }

    let opened = false;

    try {
      socket = new WebSocket(wsUrl());
    } catch {
      setState('degraded');
      startPolling();
      scheduleReconnect();

      return;
    }

    socket.addEventListener('open', () => {
      opened = true;
      reconnectDelay = RECONNECT_BASE_MS;
      socket?.send(JSON.stringify({
        v        : 1,
        subscribe: meetingId
      }));

      // Cover the window between the last poll and this connection, then go live.
      pollOnce().catch(() => undefined)
        .finally(() => {
          if (!closed && opened) {
            stopPolling();
            setState('live');
          }
        });
    });

    socket.addEventListener('message', event => {
      try {
        const message = wsServerMessageSchema.parse(JSON.parse(String(event.data)));

        if (message.kind === 'delta') {
          // Keep the dedup memory current so a later fallback doesn't re-emit.
          if (message.delta.type === 'segment.committed') {
            seenSegments.add(message.delta.payload.id);
          } else if (message.delta.type === 'artifact.committed') {
            artifactVersions.set(message.delta.payload.type, message.delta.payload.version);
          } else if (message.delta.type === 'meeting.status') {
            lastStatus = message.delta.payload.status;
          }

          onDelta(message.delta);
        }
      } catch {
        // Unknown frame — ignore; the schema is versioned for evolution.
      }
    });

    socket.addEventListener('close', () => {
      socket = null;

      if (!closed) {
        setState('degraded');
        startPolling();
        scheduleReconnect();
      }
    });

    socket.addEventListener('error', () => {
      // 'close' follows and handles the fallback.
    });
  }

  connect();
  startPolling(); // active until the socket opens; stopped on first successful connect

  return {
    get state () {
      return state;
    },

    onStateChange: callback => {
      stateListeners.add(callback);

      return () => stateListeners.delete(callback);
    },

    unsubscribe: () => {
      closed = true;
      stopPolling();

      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
      }

      socket?.close();
    }
  };
}
