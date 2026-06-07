import { NextResponse } from 'next/server';
import { artifactTypeSchema } from '@peace/core';
import { getArtifactVersions } from '@peace/db';
import { getDb } from '../../../../../src/db';

export const dynamic = 'force-dynamic';

export async function GET (request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const typeParam = new URL(request.url).searchParams.get('type');
  const type = artifactTypeSchema.safeParse(typeParam);

  if (!type.success) {
    return NextResponse.json({ error: `invalid artifact type: ${typeParam}` }, { status: 400 });
  }

  return NextResponse.json(getArtifactVersions(getDb(), id, type.data));
}
