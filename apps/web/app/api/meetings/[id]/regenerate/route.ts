import { NextResponse } from 'next/server';
import { getDefaultModel } from '@peace/ai';
import { getMeeting } from '@peace/db';
import { errorFields } from '@peace/logger';
import { createAiGenerator, runPipeline } from '@peace/pipeline';
import { getDb } from '../../../../../src/db';
import { getLogger } from '../../../../../src/logger';

export const dynamic = 'force-dynamic';

export async function POST (request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const log = getLogger().child({ meetingId: id });

  if (!getMeeting(db, id)) {
    log.warn('regenerate.meeting_not_found');

    return NextResponse.json({ error: 'meeting not found' }, { status: 404 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    log.warn('regenerate.missing_anthropic_key');

    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured — add it to .env to enable regeneration' }, { status: 503 });
  }

  const startedAt = Date.now();

  try {
    const result = await runPipeline(db, id, createAiGenerator(getDefaultModel()));

    log.info('regenerate.completed', {
      ms          : Date.now() - startedAt,
      windows     : result.extraction.stats.windows,
      droppedItems: result.extraction.stats.droppedItems,
      versions    : result.artifacts.map(artifact => `${artifact.type}@v${artifact.version}`)
    });

    return NextResponse.json({
      artifacts: result.artifacts.map(artifact => ({
        type   : artifact.type,
        version: artifact.version
      }))
    });
  } catch (error) {
    log.error('regenerate.failed', {
      ms: Date.now() - startedAt,
      ...errorFields(error)
    });

    return NextResponse.json({ error: error instanceof Error ? error.message : 'pipeline failed' }, { status: 500 });
  }
}
