'use client';

import type { Artifact, ArtifactType } from '@peace/core';
import type { WorkspaceData, WorkspaceDataAdapter } from '@peace/ui';
import { createLiveSubscription } from './live-subscription';

async function request<T> (path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;

    throw new Error(body?.error ?? `${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/** WorkspaceDataAdapter over the web app's route handlers. */
export const webAdapter: WorkspaceDataAdapter = {
  listMeetings: () => request('/api/meetings'),

  getWorkspace: meetingId => request<WorkspaceData>(`/api/meetings/${meetingId}`),

  getArtifactVersions: (meetingId, type: ArtifactType) => request<Artifact[]>(`/api/meetings/${meetingId}/versions?type=${type}`),

  regenerateArtifacts: async meetingId => {
    await request(`/api/meetings/${meetingId}/regenerate`, { method: 'POST' });
  },

  saveDiagramSource: (meetingId, mermaid) => request<Artifact>(`/api/meetings/${meetingId}/diagram`, {
    method : 'POST',
    headers: { 'content-type': 'application/json' },
    body   : JSON.stringify({ mermaid })
  }),

  subscribe: (meetingId, onDelta) => createLiveSubscription(
    meetingId,
    onDelta,
    () => request<WorkspaceData>(`/api/meetings/${meetingId}`)
  )
};
