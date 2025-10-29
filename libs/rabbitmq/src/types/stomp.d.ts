export interface StompHeaders {
  [key: string]: string | number | boolean;
}

export interface StompFrame {
  command: string;
  headers: StompHeaders;
  body?: string;
}

export interface StompConnectionConfig {
  hostname?: string;
  port?: number;
  brokerURL?: string;
  username?: string;
  passcode?: string;
  vhost?: string;
  heartbeat?: number;
}

export interface StompConfig {
  brokerURL: string;
  connectHeaders?: StompHeaders;
  reconnectDelay?: number;
  heartbeatIncoming?: number;
  heartbeatOutgoing?: number;
  debug?: (str: string) => void;
}

export interface StompSubscription {
  unsubscribe(): void;
}

export interface StompMessage {
  headers: StompHeaders;
  body: string;
  ack(): void;
  nack(): void;
}

export class Client {
  constructor(config: StompConfig);
  
  brokerURL: string;
  connectHeaders: StompHeaders;
  reconnectDelay: number;
  heartbeatIncoming: number;
  heartbeatOutgoing: number;
  
  onConnect: (frame: StompFrame) => void;
  onStompError: (frame: StompFrame) => void;
  onDisconnect: () => void;
  
  activate(): void;
  deactivate(): void;
  publish(params: { destination: string; body: string; headers?: StompHeaders }): void;
  subscribe(destination: string, callback: (message: StompMessage) => void, headers?: StompHeaders): StompSubscription;
}

declare module '@stomp/stompjs' {
  export { Client, StompSubscription, StompFrame, StompMessage, StompHeaders, StompConfig };
}