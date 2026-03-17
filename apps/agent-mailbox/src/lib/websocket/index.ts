export {
  SubscriptionManager,
  subscriptionManager,
} from './subscriptionManager.js';

export type {
  WebSocketMessageType,
  WebSocketMessage,
  SubscribedMessage,
  NewMailMessage,
  PingMessage,
  PongMessage,
  ErrorMessage,
  IncomingWebSocketMessage,
  OutgoingWebSocketMessage,
} from './types.js';

export {
  isSubscribedMessage,
  isNewMailMessage,
  isPingMessage,
  isPongMessage,
  isErrorMessage,
} from './types.js';
