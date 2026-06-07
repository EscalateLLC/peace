import { NextResponse } from 'next/server';
import { listMeetings } from '@peace/db';
import { getDb } from '../../../src/db';

export const dynamic = 'force-dynamic';

export function GET () {
  return NextResponse.json(listMeetings(getDb()));
}
