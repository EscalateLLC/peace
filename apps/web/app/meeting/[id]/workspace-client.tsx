'use client';

import { WorkspaceShell } from '@peace/ui';
import { webAdapter } from '../../../src/adapter';

export function WorkspaceClient ({ meetingId }: { meetingId: string }) {
  return (
    <WorkspaceShell
      meetingId={meetingId}
      adapter={webAdapter}
    />
  );
}
