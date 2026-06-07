import type { Artifact, ArtifactType, ConversationEvent, Meeting } from '@peace/core';

/** One-shot workspace payload: initial load and each poll tick. */
export interface WorkspaceData {
  meeting: Meeting;
  segments: ConversationEvent[];
  artifacts: Artifact[];
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
}
