import get from 'lodash/get';
import WebSocket from 'ws';
import { IWebSocketServerOptions, MessageType, TClientId, TTopic } from './types';
import { WebSocketMessage } from './web-socket-message';

export class WebSocketServer {
  private host: string;
  private port: number;
  private server: WebSocket.Server;
  private topicToClients: Map<TTopic, Set<TClientId>> = new Map();
  private clients: Map<TClientId, WebSocket> = new Map();
  private options: IWebSocketServerOptions;

  constructor(opts: IWebSocketServerOptions) {
    const { host, port, autoRun = false } = opts;

    this.options = opts;
    this.host = host;
    this.port = port;

    if (autoRun) {
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
        for (const [, clientSet] of this.topicToClients) {
          clientSet.delete(clientId);
        }

        console.log('[WebSocketServer] Client %s disconnected', clientId);
      });
    });
  }

  // ----------------------------------------------------------------------------------------------------
  private handleMessageData(opts: { clientId: string; data: WebSocket.RawData }) {
    const { clientId, data } = opts;

    try {
      const parsedData = WebSocketMessage.deserialize(data.toString());
      if (!parsedData) {
        console.log('[WebSocketServer][handleMessageData] Unsupported data');
        return;
      }

      const { messageType, topic, payload } = parsedData;
      switch (messageType) {
        case MessageType.SUBSCRIBE: {
          this.subscribe({ clientId, topic });
          break;
        }
        case MessageType.UNSUBSCRIBE: {
          this.unsubscribe({ clientId, topic });
          break;
        }
        case MessageType.UNSUBSCRIBE_ALL: {
          this.unsubscribeAll({ clientId });
          break;
        }
        case MessageType.PUBLISH: {
          this.publish({ topic, payload });
          break;
        }
        default: {
          console.log('[WebSocketServer][handleMessageData] Unsupported data');
        }
      }
    } catch (e) {
      console.log('[WebsocketServer][handleMessageData] Error: %s', e);
    }
  }

  // ----------------------------------------------------------------------------------------------------
  private subscribe(opts: { clientId: string; topic: string }) {
    const { clientId, topic } = opts;

    const client = this.clients.get(clientId);
    if (!client) {
      console.log(
        '[WebSocketServer][subscribe] Client %s subscribered faild | Client is not exist',
        clientId,
      );
      return;
    }

    let clientSet = this.topicToClients.get(topic);
    if (!clientSet) {
      clientSet = new Set();
      clientSet.add(clientId);
      this.topicToClients.set(topic, clientSet);
    } else {
      clientSet.add(clientId);
    }

    console.log(
      '[WebSocketServer][subscribe] Client %s is subscribered to topic %s sucessful | Number of clients: %d',
      clientId,
      topic,
      clientSet.size,
    );
  }

  // ----------------------------------------------------------------------------------------------------
  private unsubscribe(opts: { clientId: string; topic: string }) {
    const { clientId, topic } = opts;

    const clientSet = this.topicToClients.get(topic);
    if (!clientSet) {
      console.log(
        '[WebSocketServer][unsubscribe] Client %s not exist in topic %s',
        clientId,
        topic,
      );
      return;
    }

    const isDeleted = clientSet.delete(clientId);
    if (!isDeleted) {
      console.log(
        '[WebSocketServer][unsubscribe] Client %s not exist in topic %s',
        clientId,
        topic,
      );
      return;
    }

    console.log(
      '[WebSocketServer][unsubscribe] Client %s is unsubscribered from topic %s sucessful | Number of clients: %d',
      clientId,
      topic,
      clientSet.size,
    );
  }

  // ----------------------------------------------------------------------------------------------------
  private unsubscribeAll(opts: { clientId: string }) {
    const { clientId } = opts;

    let count = 0;
    for (const [_topic, clientSet] of this.topicToClients) {
      const isDeleted = clientSet.delete(clientId);
      if (isDeleted) {
        count++;
      }
    }

    console.log(
      '[WebSocketServer][unsubscribeAll] Client %s is unsubscribered from all sucessful | Number of unsubscribered topic: %d',
      clientId,
      count,
    );
  }

  // ----------------------------------------------------------------------------------------------------
  private publish(opts: { topic: string; payload: any }) {
    const { payload, topic } = opts;

    const clientSet = this.topicToClients.get(topic);
    if (!clientSet) {
      return;
    }

    const message = new WebSocketMessage({
      messageType: MessageType.PUBLISH,
      topic,
      payload,
    }).serialize();

    try {
      for (const clientId of clientSet) {
        const client = this.clients.get(clientId);
        if (!client) {
          continue;
        }

        client.send(message);
      }

      if (this.options.doLog) {
        console.log(
          '[WebsocketServer][publish] Publish to topic %s successful | Payload: %s',
          topic,
          payload,
        );
      }
    } catch (e) {
      console.log('[WebsocketServer][publish] Error: %s', e);
    }
  }
}
