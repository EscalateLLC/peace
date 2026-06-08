import { WebSocket, WebSocketServer } from 'ws';
import {
  wsClientMessageSchema,
  type Artifact,
  type ConversationEvent,
  type InterimSegment,
  type MeetingNotice,
  type MeetingStatusDelta,
  type ProvisionalExtraction,
  type WorkspaceDelta,
  type WsServerMessage
} from '@peace/core';
import { errorFields, type Logger } from '@peace/logger';

const DEFAULT_PORT = 8787;
const HEARTBEAT_MS = 15000;
const BACKPRESSURE_WARN_BYTES = 1024 * 1024;

/**
 * What producers hand to publish(): a WorkspaceDelta minus `seq` — the server
 * owns per-meeting sequence assignment so every producer (session commits,
 * meeting status changes, artifact inserts) shares one ordered stream.
 */
export type DeltaInput =
  | { type: 'segment.committed'; payload: ConversationEvent }
  | { type: 'segment.interim'; payload: InterimSegment }
  | { type: 'artifact.provisional'; payload: ProvisionalExtraction }
  | { type: 'artifact.committed'; payload: Artifact }
  | { type: 'meeting.status'; payload: MeetingStatusDelta }
  | { type: 'meeting.notice'; payload: MeetingNotice };

// Notices are deliberately NOT sequenced: they're ephemeral signals with no DB
// row, so they take the unsequenced fan-out path and never consume a meeting's
// committed-stream seq (which would desync reconnect/polling catch-up).
const SEQUENCED_TYPES = new Set(['segment.committed', 'artifact.committed', 'meeting.status']);

export interface DeltaServerOptions {

  /** 0 binds an ephemeral port (tests). Default 8787 / PEACE_WS_PORT. */
  port?: number;
  log: Logger;
}

export interface DeltaServer {

  /** Assign seq (committed types) and fan out to this meeting's subscribers. */
  publish: (input: DeltaInput) => void;

  /** The actually-bound port. */
  port: number;
  close: () => Promise<void>;
}

interface ClientState {
  socket: WebSocket;
  meetings: Set<string>;
  alive: boolean;
}

/**
 * The realtime fan-out (realtime/04): SQLite stays the source of truth; this
 * socket is delivery only, which is what makes the workspace's polling
 * fallback lossless. Hosted by whichever process runs the live session — the
 * Discord bot today, the CLI replay harness for demos, other platform
 * workers later.
 */
export function createDeltaServer (options: DeltaServerOptions): Promise<DeltaServer> {
  const { log } = options;
  const port = options.port ?? Number(process.env.PEACE_WS_PORT ?? DEFAULT_PORT);
  const clients = new Set<ClientState>();
  const seqByMeeting = new Map<string, number>();
  let nextClientId = 1;

  const server = new WebSocketServer({ port });

  server.on('connection', socket => {
    const clientId = nextClientId++;
    const state: ClientState = {
      socket,
      meetings: new Set(),
      alive   : true
    };

    clients.add(state);
    log.info('ws.client_connected', { clientId });

    socket.on('pong', () => {
      state.alive = true;
    });

    socket.on('message', raw => {
      let json: unknown = null;

      try {
        json = JSON.parse(String(raw));
      } catch {
        // fall through to the schema failure below
      }

      const parsed = wsClientMessageSchema.safeParse(json);

      if (!parsed.success) {
        log.warn('ws.bad_message', {
          clientId,
          preview: String(raw).slice(0, 200)
        });

        return;
      }

      const { subscribe, unsubscribe, lastSeq } = parsed.data;

      if (subscribe) {
        state.meetings.add(subscribe);

        const seq = seqByMeeting.get(subscribe) ?? 0;

        send(socket, {
          kind     : 'subscribed',
          v        : 1,
          meetingId: subscribe,
          seq
        });
        log.info('ws.subscribed', {
          clientId,
          meetingId: subscribe,
          lastSeq  : lastSeq ?? null,
          seq
        });
      }

      if (unsubscribe) {
        state.meetings.delete(unsubscribe);
      }
    });

    socket.on('close', () => {
      clients.delete(state);
      log.info('ws.client_dropped', {
        clientId,
        meetings: [...state.meetings]
      });
    });

    socket.on('error', error => {
      log.warn('ws.client_error', {
        clientId,
        ...errorFields(error)
      });
    });
  });

  const heartbeat = setInterval(() => {
    for (const state of clients) {
      if (!state.alive) {
        state.socket.terminate();
        clients.delete(state);
        log.info('ws.client_dropped', { reason: 'heartbeat' });
        continue;
      }

      state.alive = false;
      state.socket.ping();
    }
  }, HEARTBEAT_MS);

  function send (socket: WebSocket, message: WsServerMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  function publish (input: DeltaInput): void {
    const meetingId = input.payload.meetingId;
    let delta: WorkspaceDelta;

    if (SEQUENCED_TYPES.has(input.type)) {
      const seq = (seqByMeeting.get(meetingId) ?? 0) + 1;

      seqByMeeting.set(meetingId, seq);
      delta = {
        ...input,
        seq
      } as WorkspaceDelta;
    } else {
      delta = input as WorkspaceDelta;
    }

    let delivered = 0;

    for (const state of clients) {
      if (!state.meetings.has(meetingId)) {
        continue;
      }

      if (state.socket.bufferedAmount > BACKPRESSURE_WARN_BYTES) {
        log.warn('ws.backpressure', {
          meetingId,
          bufferedBytes: state.socket.bufferedAmount
        });
      }

      send(state.socket, {
        kind: 'delta',
        v   : 1,
        delta
      });
      delivered++;
    }

    log.debug('ws.push', {
      meetingId,
      type: input.type,
      delivered
    });
  }

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('listening', () => {
      const bound = (server.address() as { port: number }).port;

      log.info('ws.server_started', { port: bound });
      resolve({
        publish,
        port : bound,
        close: () => {
          clearInterval(heartbeat);

          for (const state of clients) {
            state.socket.close();
          }

          return new Promise<void>((resolveClose, rejectClose) => {
            server.close(error => {
              if (error) {
                rejectClose(error);
              } else {
                log.info('ws.server_stopped', {});
                resolveClose();
              }
            });
          });
        }
      });
    });
  });
}
