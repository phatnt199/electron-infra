import { MessageType, TTopic } from './types';

export class WebSocketMessage {
  messageType: MessageType;
  topic: TTopic;
  payload: any;

  constructor(opts: { messageType: MessageType; topic: TTopic; payload: any }) {
    const { messageType, topic, payload } = opts;
    this.messageType = messageType;
    this.topic = topic;
    this.payload = payload;
  }

  serialize(): string {
    return JSON.stringify({
      messageType: this.messageType,
      topic: this.topic,
      payload: this.payload,
    });
  }

  static deserialize(rawMessage: string): WebSocketMessage | null {
    try {
      const parsed = new WebSocketMessage(JSON.parse(rawMessage));
      if (!parsed.messageType) {
        console.error('[WebSocketMessage][deserialize] Missing type');
        return null;
      }
      return parsed;
    } catch (e) {
      console.error('[WebSocketMessage][deserialize] Invalid JSON:', e);
      return null;
    }
  }
}
