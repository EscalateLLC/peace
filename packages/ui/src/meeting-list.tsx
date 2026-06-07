'use client';

import type { Meeting } from '@peace/core';
import { formatDate } from './format';

export interface MeetingListProps {
  meetings: Meeting[];

  /** Navigation is the host app's concern (Next router, Electron view, …). */
  onSelect: (meetingId: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  live  : 'bg-emerald-950/60 text-emerald-300',
  failed: 'bg-red-950/60 text-red-300'
};

export function MeetingList ({ meetings, onSelect }: MeetingListProps) {
  if (meetings.length === 0) {
    return (
      <div className="mt-16 text-center text-sm text-zinc-500">
        <p>No meetings yet.</p>
        <p className="mt-1">
          Seed one: <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs">pnpm --filter @peace/cli start seed-demo</code>
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {meetings.map(meeting => (
        <li key={meeting.id}>
          <button
            type="button"
            onClick={() => onSelect(meeting.id)}
            className="flex w-full items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-200">{meeting.title}</p>
              {/* Local time differs between server and client renders by design. */}
              <p
                className="mt-0.5 text-xs text-zinc-500"
                suppressHydrationWarning
              >
                {formatDate(meeting.startedAt)} · {meeting.platform}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[meeting.status] ?? 'bg-zinc-800 text-zinc-400'}`}>
              {meeting.status}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
