import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { wsServerMessageSchema, type ConversationEvent, type WsServerMessage } from '@peace/core';
import { createLogger } from '@peace/logger';
import { createDeltaServer, type DeltaServer } from './server';

const log = createLogger('transport-test', { dir: join(tmpdir(), 'peace-transport-test-logs') });

let server: DeltaServer | null = null;
let sockets: WebSocket[] = [];

afterEach(async () => {
  for (const socket of sockets) {
    socket.close();
  }

  sockets = [];

  const closing = server;

  server = null;
  await closing?.close();
});

function connect (port: number): Promise<WebSocket> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);

  sockets.push(socket);

  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

function nextMessage (socket: WebSocket): Promise<WsServerMessage> {
  return new Promise(resolve => {
    socket.once('message', raw => {
      resolve(wsServerMessageSchema.parse(JSON.parse(String(raw))));
    });
  });
}

function segment (meetingId: string, text: string): ConversationEvent {
  return {
    id          : crypto.randomUUID(),
    meetingId,
    speakerId   : 'user:alice',
    speakerLabel: 'Alice',
    text,
    tStart      : 0,
    tEnd        : 1000,
    confidence  : 1,
    source      : {
      platform: 'upload',
      medium  : 'text'
    }
  };
}

describe('createDeltaServer', () => {
  it('acks subscriptions and fans out only to that meeting\'s subscribers', async () => {
    server = await createDeltaServer({
      port: 0,
      log
    });

    const subscribed = await connect(server.port);
    const other = await connect(server.port);

    subscribed.send(JSON.stringify({
      v        : 1,
      subscribe: 'meeting-1'
    }));
    other.send(JSON.stringify({
      v        : 1,
      subscribe: 'meeting-2'
    }));

    const ack = await nextMessage(subscribed);

    expect(ack).toMatchObject({
      kind     : 'subscribed',
      meetingId: 'meeting-1',
      seq      : 0
    });
    await nextMessage(other);

    const received: WsServerMessage[] = [];
    const wrongMeeting: WsServerMessage[] = [];

    subscribed.on('message', raw => received.push(wsServerMessageSchema.parse(JSON.parse(String(raw)))));
    other.on('message', raw => wrongMeeting.push(wsServerMessageSchema.parse(JSON.parse(String(raw)))));

    server.publish({
      type   : 'segment.committed',
      payload: segment('meeting-1', 'hello')
    });
    server.publish({
      type   : 'segment.committed',
      payload: segment('meeting-1', 'world')
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(received).toHaveLength(2);
    expect(received[0]).toMatchObject({
      kind : 'delta',
      delta: {
        type: 'segment.committed',
        seq : 1
      }
    });
    expect(received[1]).toMatchObject({ delta: { seq: 2 } });
    expect(wrongMeeting).toHaveLength(0);
  });

  it('keeps per-meeting sequences independent and reports current seq on subscribe', async () => {
    server = await createDeltaServer({
      port: 0,
      log
    });

    server.publish({
      type   : 'segment.committed',
      payload: segment('meeting-1', 'before any subscriber')
    });
    server.publish({
      type   : 'meeting.status',
      payload: {
        meetingId: 'meeting-1',
        status   : 'complete'
      }
    });

    const socket = await connect(server.port);

    socket.send(JSON.stringify({
      v        : 1,
      subscribe: 'meeting-1',
      lastSeq  : 0
    }));

    const ack = await nextMessage(socket);

    // Client sees seq 2 > its lastSeq 0 → takes a snapshot to resync.
    expect(ack).toMatchObject({
      kind: 'subscribed',
      seq : 2
    });
  });

  it('ignores malformed messages without dropping the connection', async () => {
    server = await createDeltaServer({
      port: 0,
      log
    });

    const socket = await connect(server.port);

    socket.send(JSON.stringify({ nonsense: true }));
    socket.send(JSON.stringify({
      v        : 1,
      subscribe: 'meeting-1'
    }));

    const ack = await nextMessage(socket);

    expect(ack).toMatchObject({
      kind     : 'subscribed',
      meetingId: 'meeting-1'
    });
  });
});
