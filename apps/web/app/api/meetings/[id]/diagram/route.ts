import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseArtifactContent } from '@peace/core';
import { getArtifactVersions, getMeeting, insertArtifact } from '@peace/db';
import { getDb } from '../../../../../src/db';
import { getLogger } from '../../../../../src/logger';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ mermaid: z.string().min(1) });

/** Persist hand-edited Mermaid source as a new immutable diagram version. */
export async function POST (request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  if (!getMeeting(db, id)) {
    return NextResponse.json({ error: 'meeting not found' }, { status: 404 });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: 'body must be { mermaid: string }' }, { status: 400 });
  }

  const latest = getArtifactVersions(db, id, 'diagram')[0];

  // Carry node evidence forward where the node ids still exist in the edit.
  const previousEvidence = latest ? parseArtifactContent('diagram', latest.content) : null;
  const nodeEvidence = previousEvidence?.type === 'diagram' ? Object.fromEntries(Object.entries(previousEvidence.content.nodeEvidence)
    .filter(([nodeId]) => body.data.mermaid.includes(nodeId))) : {};

  const artifact = insertArtifact(db, {
    meetingId: id,
    type     : 'diagram',
    title    : latest?.title ?? 'Diagram',
    content  : {
      mermaid: body.data.mermaid,
      nodeEvidence
    },
    createdAt: Date.now()
  });

  getLogger().info('diagram.version_saved', {
    meetingId        : id,
    version          : artifact.version,
    chars            : body.data.mermaid.length,
    nodesWithEvidence: Object.keys(nodeEvidence).length
  });

  return NextResponse.json(artifact);
}
