import {
  createDb,
  createMeeting,
  getLatestArtifacts,
  getSegments,
  insertArtifact,
  insertSegments,
  migrate
} from '../src/index';

const db = createDb();

migrate(db);

const meeting = createMeeting(db, {
  title    : 'Seed meeting',
  platform : 'upload',
  startedAt: Date.now()
});

insertSegments(db, [{
  id          : crypto.randomUUID(),
  meetingId   : meeting.id,
  speakerId   : 'user:alice',
  speakerLabel: 'Alice',
  text        : 'Let us ship the Discord bot first.',
  tStart      : 0,
  tEnd        : 2500,
  confidence  : 1,
  source      : 'transcript-file'
}]);

const artifact = insertArtifact(db, {
  meetingId: meeting.id,
  type     : 'summary',
  title    : 'Summary',
  content  : {
    markdown        : 'Seed summary.',
    sourceSegmentIds: []
  },
  createdAt: Date.now()
});

console.log('meeting :', meeting.id, meeting.title);
console.log('segments:', getSegments(db, meeting.id).length);
console.log('artifact:', artifact.type, `v${String(artifact.version)}`);
console.log('latest  :', getLatestArtifacts(db, meeting.id).map(item => `${item.type}@v${item.version}`)
  .join(', '));
