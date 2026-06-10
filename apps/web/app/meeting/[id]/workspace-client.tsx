'use client';

import { webAdapter } from '../../../src/adapter';
import { DeckWorkspace } from './deck-workspace';

export function WorkspaceClient ({ meetingId }: { meetingId: string }) {
  return (
    <DeckWorkspace
      meetingId={meetingId}
      adapter={webAdapter}
    />
  );
}
