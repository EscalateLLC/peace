import type { Artifact, ArtifactType, ConversationEvent, Meeting, WorkspaceDelta } from '@peace/core';

/** One-shot workspace payload: initial load and each poll tick. */
export interface WorkspaceData {
  meeting: Meeting;
  segments: ConversationEvent[];
  artifacts: Artifact[];
}

/** 'live' = push transport connected; 'degraded' = adapter-side polling. */
export type LiveState = 'live' | 'degraded';

export interface LiveSubscription {
  unsubscribe: () => void;
  readonly state: LiveState;

  /** Returns an unsubscribe function for the state listener. */
  onStateChange: (callback: (state: LiveState) => void) => () => void;
}

/**
 * The UI portability seam. packages/ui never fetches or touches a database —
 * every host app (Next.js web via route handlers, Electron via IPC, mobile
 * later) supplies an implementation of this interface.
 */
export interface WorkspaceDataAdapter {
  listMeetings: () => Promise<Meeting[]>;
  getWorkspace: (meetingId: string) => Promise<WorkspaceData>;
  getArtifactVersions: (meetingId: string, type: ArtifactType) => Promise<Artifact[]>;

  /** Re-run the AI pipeline over the meeting transcript (new artifact versions). */
  regenerateArtifacts: (meetingId: string) => Promise<void>;

  /** Persist hand-edited Mermaid source as a new diagram version (no LLM). */
  saveDiagramSource: (meetingId: string, mermaid: string) => Promise<Artifact>;

  /**
   * Optional live delta stream (workspace/02). When present, the shell takes
   * one snapshot then applies deltas; transport AND fallback live inside the
   * adapter — the UI never learns what a WebSocket is. When the transport
   * drops, the adapter polls internally and synthesizes the same deltas, so
   * total transport failure is exactly the old polling UX.
   */
  subscribe?: (meetingId: string, onDelta: (delta: WorkspaceDelta) => void) => LiveSubscription;
}
