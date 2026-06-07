import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTranscript } from '@peace/adapters';
import type { ConversationEvent } from '@peace/core';
import {
  createDb,
  createMeeting,
  findRepoRoot,
  insertArtifact,
  insertSegments,
  migrate,
  replaceActionItems,
  replaceDecisions,
  updateMeetingStatus
} from '@peace/db';

/**
 * Seeds a fully-populated demo meeting from fixtures/sample.txt WITHOUT any
 * LLM calls: artifacts are hand-authored from the fixture's known content,
 * with evidence pointing at the real ingested segment ids. Lets the
 * workspace UI be developed/demoed before an ANTHROPIC_API_KEY exists.
 */
export function seedDemo (): string {
  const db = createDb();

  migrate(db);

  const meeting = createMeeting(db, {
    title    : 'Customer feedback portal — Q3 launch sync (demo)',
    platform : 'upload',
    startedAt: Date.now()
  });
  const fixture = join(findRepoRoot(), 'apps', 'cli', 'fixtures', 'sample.txt');
  const events = parseTranscript(readFileSync(fixture, 'utf8'), meeting.id);

  insertSegments(db, events);

  // Evidence helper: fixture line numbers (0-based, comments excluded) → ids.
  const ids = (...indexes: number[]): string[] => indexes.map(index => (events[index] as ConversationEvent).id);
  const createdAt = Date.now();

  insertArtifact(db, {
    meetingId: meeting.id,
    type     : 'summary',
    title    : 'Summary',
    content  : {
      markdown: [
        'The team aligned on shipping the customer feedback portal for the Q3 launch.',
        '',
        '- **Roadmap view:** ships as the timeline variant (won usability testing 7/9).',
        '- **Moderation:** launches manual, spam classifier deferred to Q4 — avoids a six-week vendor DPA review.',
        '- **Remaining backend work:** rate limiting (blocks public beta) and the moderation queue, ~2 weeks.',
        '- **Beta:** five design partners to be recruited from eleven opted-in customers.',
        '- Codenames from the internal tracker will be scrubbed via a display-name mapping layer.'
      ].join('\n'),
      sourceSegmentIds: []
    },
    createdAt
  });

  const actionItems = [
    {
      description     : 'Finalize timeline view specs and hand off to Dev',
      assignee        : 'Priya',
      dueDate         : 'Friday',
      sourceSegmentIds: ids(8),
      uncertain       : false
    },
    {
      description     : 'Draft privacy policy update for newly collected data',
      assignee        : 'Sam',
      dueDate         : 'next Wednesday',
      sourceSegmentIds: ids(14),
      uncertain       : false
    },
    {
      description     : 'Implement rate limiting on the submission endpoint',
      assignee        : 'Dev',
      dueDate         : 'end of next sprint',
      sourceSegmentIds: ids(18),
      uncertain       : false
    },
    {
      description     : 'Recruit five design-partner customers for early access',
      assignee        : 'Priya',
      dueDate         : 'week after next',
      sourceSegmentIds: ids(20, 21),
      uncertain       : false
    },
    {
      description     : 'Add display-name mapping layer to scrub internal codenames',
      assignee        : 'Dev',
      dueDate         : null,
      sourceSegmentIds: ids(22, 23),
      uncertain       : false
    },
    {
      description     : 'Raise moderation-queue staffing with Jordan',
      assignee        : 'Maya',
      dueDate         : null,
      sourceSegmentIds: ids(17),
      uncertain       : false
    }
  ];

  insertArtifact(db, {
    meetingId: meeting.id,
    type     : 'action-items',
    title    : 'Action items',
    content  : { items: actionItems },
    createdAt
  });
  replaceActionItems(db, meeting.id, actionItems);

  const decisionsItems = [
    {
      description     : 'Roadmap view ships as the timeline variant',
      rationale       : 'Won the usability study — 7 of 9 participants found status faster',
      sourceSegmentIds: ids(6, 7),
      uncertain       : false
    },
    {
      description     : 'Launch with manual moderation; spam classifier deferred to Q4',
      rationale       : 'Vendor DPA review (~6 weeks) would kill the Q3 date; launch volume is under 100 submissions/day',
      sourceSegmentIds: ids(11, 12, 13),
      uncertain       : false
    },
    {
      description     : 'Pricing tier gating for voting is out of scope until the pricing review',
      rationale       : null,
      sourceSegmentIds: ids(25, 26),
      uncertain       : false
    }
  ];

  insertArtifact(db, {
    meetingId: meeting.id,
    type     : 'decisions',
    title    : 'Decisions',
    content  : { items: decisionsItems },
    createdAt
  });
  replaceDecisions(db, meeting.id, decisionsItems, createdAt);

  insertArtifact(db, {
    meetingId: meeting.id,
    type     : 'open-questions',
    title    : 'Open questions',
    content  : {
      items: [
        {
          question        : 'Who staffs the manual moderation queue (support is stretched; engineering rotation floated)?',
          sourceSegmentIds: ids(16, 17),
          uncertain       : false
        },
        {
          question        : 'Does the free tier get voting?',
          sourceSegmentIds: ids(25),
          uncertain       : false
        }
      ]
    },
    createdAt
  });

  insertArtifact(db, {
    meetingId: meeting.id,
    type     : 'key-points',
    title    : 'Key points',
    content  : {
      items: [
        {
          point           : 'Backend remainder is ~2 weeks: rate limiting + moderation queue',
          sourceSegmentIds: ids(3),
          uncertain       : false
        },
        {
          point           : 'Launch volume projected under 100 submissions/day',
          sourceSegmentIds: ids(12),
          uncertain       : false
        },
        {
          point           : 'Rate limiting blocks the public beta',
          sourceSegmentIds: ids(18),
          uncertain       : false
        },
        {
          point           : 'Portal currently exposes internal tracker codenames publicly',
          sourceSegmentIds: ids(22),
          uncertain       : false
        }
      ]
    },
    createdAt
  });

  insertArtifact(db, {
    meetingId: meeting.id,
    type     : 'diagram',
    title    : 'Q3 launch flow',
    content  : {
      mermaid: [
        'flowchart TD',
        '  A["Timeline specs final (Priya, Fri)"] --> B["Rate limiting (Dev, next sprint)"]',
        '  B --> C["Public beta: 5 design partners"]',
        '  A --> C',
        '  D["Privacy policy draft (Sam, Wed)"] --> E["Q3 launch"]',
        '  C --> E',
        '  F["Codename scrubbing layer (Dev)"] --> E',
        '  E --> G["Q4: revisit spam classifier"]'
      ].join('\n'),
      nodeEvidence: {
        A: ids(8),
        B: ids(18),
        C: ids(20, 21),
        D: ids(14),
        E: ids(0),
        F: ids(22, 23),
        G: ids(13)
      }
    },
    createdAt
  });

  updateMeetingStatus(db, meeting.id, 'complete', Date.now());

  return meeting.id;
}
