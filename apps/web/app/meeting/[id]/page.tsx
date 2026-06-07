import { WorkspaceClient } from './workspace-client';

export const dynamic = 'force-dynamic';

export default async function MeetingPage ({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="h-dvh">
      <WorkspaceClient meetingId={id} />
    </main>
  );
}
