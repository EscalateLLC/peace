import { listMeetings } from '@peace/db';
import { getDb } from '../src/db';
import { MeetingListClient } from './meeting-list-client';

export const dynamic = 'force-dynamic';

export default function HomePage () {
  const meetings = listMeetings(getDb());

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-baseline gap-3">
        <h1 className="text-xl font-semibold text-zinc-100">peace</h1>
        <p className="text-sm text-zinc-500">conversations → evidence-linked artifacts</p>
      </div>
      <MeetingListClient meetings={meetings} />
    </main>
  );
}
