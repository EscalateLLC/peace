'use client';

import { useRouter } from 'next/navigation';
import type { Meeting } from '@peace/core';

function formatWhen (epochMs: number): string {
  return new Date(epochMs).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export function MeetingListClient ({ meetings }: { meetings: Meeting[] }) {
  const router = useRouter();

  if (meetings.length === 0) {
    return (
      <div className="home-empty">
        <p>No meetings yet.</p>
        <p>Seed one: <code>pnpm --filter @peace/cli start seed-demo</code></p>
      </div>
    );
  }

  return (
    <ul className="home-list">
      {meetings.map(meeting => (
        <li key={meeting.id}>
          <button
            type="button"
            className="home-card"
            onClick={() => router.push(`/meeting/${meeting.id}`)}
          >
            <span className="home-card-main">
              <span className="home-card-title">{meeting.title}</span>
              {/* Local time differs between server and client renders by design. */}
              <span
                className="home-card-meta"
                suppressHydrationWarning>
                {formatWhen(meeting.startedAt)} · {meeting.platform}
              </span>
            </span>
            <span
              className="home-status"
              data-status={meeting.status}>{meeting.status}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
