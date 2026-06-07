'use client';

import { useRouter } from 'next/navigation';
import type { Meeting } from '@peace/core';
import { MeetingList } from '@peace/ui';

export function MeetingListClient ({ meetings }: { meetings: Meeting[] }) {
  const router = useRouter();

  return (
    <MeetingList
      meetings={meetings}
      onSelect={meetingId => router.push(`/meeting/${meetingId}`)}
    />
  );
}
