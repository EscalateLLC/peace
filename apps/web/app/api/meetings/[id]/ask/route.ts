import { NextResponse } from 'next/server';
import { draftResponse } from '@peace/agent';
import { getDefaultModel } from '@peace/ai';
import { getMeeting } from '@peace/db';
import { errorFields } from '@peace/logger';
import { getDb } from '../../../../../src/db';
import { getLogger } from '../../../../../src/logger';

export const dynamic = 'force-dynamic';

/**
 * "Ask peace" — a one-shot question from the workspace (e.g. a diagram-node drill),
 * answered by the conversational agent over the meeting's transcript. Mirrors the
 * regenerate route's db/logger/key plumbing; `draftResponse` itself never throws.
 */
export async function POST (request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const log = getLogger().child({ meetingId: id });

  if (!getMeeting(db, id)) {
    log.warn('ask.meeting_not_found');

    return NextResponse.json({ error: 'meeting not found' }, { status: 404 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    log.warn('ask.missing_anthropic_key');

    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured — add it to .env to ask peace' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({})) as { query?: unknown };
  const query = typeof body.query === 'string' ? body.query.trim() : '';

  if (!query) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  const startedAt = Date.now();

  try {
    const decision = await draftResponse({
      db,
      meetingId  : id,
      model      : getDefaultModel(),
      addressedBy: 'a teammate',
      query,
      mode       : 'addressed',
      log
    });

    log.info('ask.completed', {
      ms   : Date.now() - startedAt,
      kind : decision.kind,
      chars: query.length
    });

    if (decision.kind === 'speak') {
      return NextResponse.json({
        kind: 'speak',
        text: decision.text
      });
    }

    if (decision.kind === 'leave') {
      return NextResponse.json({
        kind: 'speak',
        text: decision.goodbye
      });
    }

    return NextResponse.json({
      kind  : 'silent',
      reason: decision.reason
    });
  } catch (error) {
    log.error('ask.failed', {
      ms: Date.now() - startedAt,
      ...errorFields(error)
    });

    return NextResponse.json({ error: error instanceof Error ? error.message : 'agent error' }, { status: 500 });
  }
}
