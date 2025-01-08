import get from 'lodash/get';
import WebSocket from 'ws';

enum MessageType {
  SUBSCRIBE = 1,
  UNSUBSCRIBE = 2,
  PUBLISH = 3,
}

type TTopic = string;
type TClientId = string;
type TClientMap = Map<TClientId, WebSocket>;

export class WebSocketServer {
  private host: string;
  private port: number;
  private server: WebSocket.Server;
  private subscribers: Map<TTopic, TClientMap> = new Map();
  private clients: TClientMap = new Map();

  constructor(opts: { host: string; port: number; autoRun?: boolean }) {
    this.host = opts.host;
    this.port = opts.port;

    if (opts.autoRun) {
      this.start();
    }
  }

  // ----------------------------------------------------------------------------------------------------
  start() {
    this.server = new WebSocket.Server({ host: this.host, port: this.port });

    this.server.on('connection', (ws, request) => {
      const clientId = get(request.headers, 'sec-websocket-key')?.toString() ?? '';
      console.log('[WebSocketServer] Client connected | Key: ', clientId);

      this.clients.set(clientId, ws);

      ws.on('message', (data: WebSocket.RawData) => {
        this.handleMessageData({ clientId, data });
      });

      ws.on('error', error => {
        console.log('[WebSocketServer] Error: %s', error);
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        for (const [, map] of this.subscribers) {
          map.delete(clientId);
        }

        console.log('[WebSocketServer] Client %s disconnected', clientId);
      });
    });
  }

  // ----------------------------------------------------------------------------------------------------
  private subscribe(opts: { clientId: string; topic: string }) {
    const { clientId, topic } = opts;

    const currentSubscribers = this.subscribers.get(topic) ?? new Map();
    const client = this.clients.get(clientId);
    const isExisted = Boolean(currentSubscribers.get(clientId));

    if (!client) {
      console.log(
        '[WebSocketServer][subscribe] Client %s subscribered faild | Client is not exist',
        clientId,
      );
      return;
    }

    if (!client || isExisted) {
      console.log(
        '[WebSocketServer][subscribe] Client %s subscribered faild | Client already subscribered',
        clientId,
      );
      return;
    }

    const newSubscribers = currentSubscribers.set(clientId, client);
    this.subscribers.set(topic, newSubscribers);
    console.log(
      '[WebSocketServer][subscribe] Client %s is subscribered to topic %s sucessful | Number of clients: %d',
      clientId,
      topic,
      newSubscribers.size,
    );
  }

  // ----------------------------------------------------------------------------------------------------
  private unsubscribe(opts: { clientId: string; topic: string }) {
    const { clientId, topic } = opts;

    const currentSubscribers = this.subscribers.get(topic);
    if (!currentSubscribers) {
      return;
    }

    const isDeleted = currentSubscribers.delete(clientId);
    if (!isDeleted) {
      console.log(
        '[WebSocketServer][unsubscribe] Client %s not exist in topic %s',
        clientId,
        topic,
      );
      return;
    }

    const newSubscribers = currentSubscribers;
    this.subscribers.set(topic, newSubscribers);
    console.log(
      '[WebSocketServer][unsubscribe] Client %s is subscribered to topic %s sucessful | Number of clients: %d',
      clientId,
      topic,
      newSubscribers.size,
    );
  }

  // ----------------------------------------------------------------------------------------------------
  private publish(opts: { clientId: string; topic: string; payload: any }) {
    const { payload, topic } = opts;

    const currentTopicMap = this.subscribers.get(topic);
    if (!currentTopicMap) {
      return;
    }

    for (const [, client] of currentTopicMap) {
      client.send(payload);
    }
  }

  // ----------------------------------------------------------------------------------------------------
  private handleMessageData(opts: { clientId: string; data: WebSocket.RawData }) {
    const { clientId, data } = opts;

    try {
      const parsedData = JSON.parse(data.toString());
      console.log(
        '[WebSocketServer][handleMessageData] Key: %s | Data: %s',
        clientId,
        parsedData,
      );

      const messageType = get(parsedData, 'messageType', '');
      switch (messageType) {
        case MessageType.SUBSCRIBE: {
          this.subscribe({ clientId, topic: get(parsedData, 'topic', '') });
          break;
        }
        case MessageType.UNSUBSCRIBE: {
          this.unsubscribe({ clientId, topic: get(parsedData, 'topic', '') });
          break;
        }
        case MessageType.PUBLISH: {
          this.publish({
            clientId,
            topic: get(parsedData, 'topic', ''),
            payload: get(parsedData, 'payload', undefined),
          });
          break;
        }
        default: {
          console.log('[WebSocketServer][handleMessageData] Unsupported data');
        }
      }
    } catch (e) {
      console.log('[WebSocketServer][handleMessageData] Error: %s', e);
    }
  }
}
