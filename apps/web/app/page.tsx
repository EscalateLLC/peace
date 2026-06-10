import { listMeetings } from '@peace/db';
import { getDb } from '../src/db';
import { MeetingListClient } from './meeting-list-client';
import { ThemeMenu } from './theme-menu';
import './home.css';

export const dynamic = 'force-dynamic';

export default function HomePage () {
  const meetings = listMeetings(getDb());

  return (
    <main className="home">
      <header className="home-bar">
        <div className="home-brand">
          <span className="home-wordmark">peace</span>
          <span className="home-tag">conversations → evidence-linked artifacts</span>
        </div>
        <ThemeMenu />
      </header>
      <MeetingListClient meetings={meetings} />
    </main>
  );
}
