import { NextResponse } from 'next/server';
import { getLatestArtifacts, getMeeting, getSegments } from '@peace/db';
import { getDb } from '../../../../src/db';

export const dynamic = 'force-dynamic';

export async function GET (request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const meeting = getMeeting(db, id);

  if (!meeting) {
    return NextResponse.json({ error: 'meeting not found' }, { status: 404 });
  }

  return NextResponse.json({
    meeting,
    segments : getSegments(db, id),
    artifacts: getLatestArtifacts(db, id)
  });
}
