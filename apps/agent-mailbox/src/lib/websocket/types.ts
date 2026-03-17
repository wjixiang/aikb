/**
 * WebSocket message types
 */

import type { MailAddress, MailMessage } from '../storage/type.js';

/**
 * WebSocket message type
 */
export type WebSocketMessageType =
  | 'subscribed'
  | 'new_mail'
  | 'ping'
  | 'pong'
  | 'error';

/**
 * Base WebSocket message interface
 */
export interface WebSocketMessage {
  type: WebSocketMessageType;
  timestamp?: string;
}

/**
 * Subscription confirmation message
 */
export interface SubscribedMessage extends WebSocketMessage {
  type: 'subscribed';
  address: MailAddress;
  timestamp: string;
}

/**
 * New mail notification message
 */
export interface NewMailMessage extends WebSocketMessage {
  type: 'new_mail';
  mail: {
    messageId: string;
    subject: string;
    from: MailAddress;
    to: MailAddress | MailAddress[];
    sentAt: string;
    priority: string;
  };
  timestamp: string;
}

/**
 * Ping message (client to server)
 */
export interface PingMessage extends WebSocketMessage {
  type: 'ping';
}

/**
 * Pong message (server to client)
 */
export interface PongMessage extends WebSocketMessage {
  type: 'pong';
  timestamp: string;
}

/**
 * Error message
 */
export interface ErrorMessage extends WebSocketMessage {
  type: 'error';
  error: string;
  code?: string;
  timestamp: string;
}

/**
 * Union type for all incoming WebSocket messages
 */
export type IncomingWebSocketMessage = PingMessage;

/**
 * Union type for all outgoing WebSocket messages
 */
export type OutgoingWebSocketMessage =
  | SubscribedMessage
  | NewMailMessage
  | PongMessage
  | ErrorMessage;

/**
 * Type guard for subscribed message
 */
export function isSubscribedMessage(
  msg: WebSocketMessage,
): msg is SubscribedMessage {
  return msg.type === 'subscribed';
}

/**
 * Type guard for new mail message
 */
export function isNewMailMessage(
  msg: WebSocketMessage,
): msg is NewMailMessage {
  return msg.type === 'new_mail';
}

/**
 * Type guard for ping message
 */
export function isPingMessage(msg: WebSocketMessage): msg is PingMessage {
  return msg.type === 'ping';
}

/**
 * Type guard for pong message
 */
export function isPongMessage(msg: WebSocketMessage): msg is PongMessage {
  return msg.type === 'pong';
}

/**
 * Type guard for error message
 */
export function isErrorMessage(msg: WebSocketMessage): msg is ErrorMessage {
  return msg.type === 'error';
}
