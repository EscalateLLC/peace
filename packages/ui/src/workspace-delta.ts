import type { WorkspaceDelta } from '@peace/core';
import type { WorkspaceData } from './adapter';

/** Pure delta application — keeps the stream logic testable and the shell thin. */
export function applyWorkspaceDelta (data: WorkspaceData, delta: WorkspaceDelta): WorkspaceData {
  switch (delta.type) {
    case 'segment.committed': {
      if (data.segments.some(segment => segment.id === delta.payload.id)) {
        return data;
      }

      return {
        ...data,
        segments: [...data.segments, delta.payload].sort((a, b) => a.tStart - b.tStart)
      };
    }

    case 'artifact.committed': {
      const existing = data.artifacts.find(artifact => artifact.type === delta.payload.type);

      if (existing && existing.version >= delta.payload.version) {
        return data;
      }

      return {
        ...data,
        artifacts: [...data.artifacts.filter(artifact => artifact.type !== delta.payload.type), delta.payload]
      };
    }

    case 'meeting.status':
      return {
        ...data,
        meeting: {
          ...data.meeting,
          status: delta.payload.status
        }
      };

    // Notices are transient operational signals, not workspace truth — the
    // shell renders them as a banner directly; they never mutate snapshot state.
    case 'meeting.notice':
      return data;

    // Interim/provisional rendering is the live-render-grammar round (workspace/01).
    default:
      return data;
  }
}
