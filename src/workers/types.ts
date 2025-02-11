export enum MessageType {
  SUBSCRIBE = 1,
  UNSUBSCRIBE = 2,
  UNSUBSCRIBE_ALL = 3,
  PUBLISH = 4,
}

export type TTopic = string;
export type TClientId = string;

export interface IWebSocketServerOptions {
  host: string;
  port: number;
  autoRun?: boolean;
  doLog?: boolean;
}
