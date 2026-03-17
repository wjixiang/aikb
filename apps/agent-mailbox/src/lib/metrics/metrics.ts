import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

/**
 * Prometheus Metrics Registry
 * Central registry for all application metrics
 */
export const register = new Registry();

// Collect default Node.js metrics
collectDefaultMetrics({ register });

/**
 * Email Sent Counter
 * Tracks the total number of emails sent
 * Labels: from (sender domain), to (recipient domain), priority
 */
export const emailsSentCounter = new Counter({
  name: 'mailbox_emails_sent_total',
  help: 'Total number of emails sent',
  labelNames: ['from_domain', 'to_domain', 'priority'],
  registers: [register],
});

/**
 * Inbox Query Counter
 * Tracks the total number of inbox queries
 * Labels: address (recipient domain), unread_only, starred_only
 */
export const inboxQueriesCounter = new Counter({
  name: 'mailbox_inbox_queries_total',
  help: 'Total number of inbox queries',
  labelNames: ['address_domain', 'unread_only', 'starred_only'],
  registers: [register],
});

/**
 * WebSocket Connections Gauge
 * Tracks the current number of active WebSocket connections
 * Labels: address
 */
export const websocketConnectionsGauge = new Gauge({
  name: 'mailbox_websocket_connections_active',
  help: 'Current number of active WebSocket connections',
  labelNames: ['address_domain'],
  registers: [register],
});

/**
 * WebSocket Connection Duration Histogram
 * Tracks the duration of WebSocket connections
 */
export const websocketConnectionDurationHistogram = new Histogram({
  name: 'mailbox_websocket_connection_duration_seconds',
  help: 'Duration of WebSocket connections in seconds',
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
  registers: [register],
});

/**
 * Request Duration Histogram
 * Tracks the duration of HTTP requests
 * Labels: method, route, status_code
 */
export const requestDurationHistogram = new Histogram({
  name: 'mailbox_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

/**
 * Error Counter
 * Tracks the total number of errors
 * Labels: type, route, operation
 */
export const errorCounter = new Counter({
  name: 'mailbox_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'route', 'operation'],
  registers: [register],
});

/**
 * Message Operation Counter
 * Tracks message operations (read, star, delete, etc.)
 * Labels: operation, status
 */
export const messageOperationCounter = new Counter({
  name: 'mailbox_message_operations_total',
  help: 'Total number of message operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

/**
 * Search Query Counter
 * Tracks the total number of search queries
 */
export const searchQueriesCounter = new Counter({
  name: 'mailbox_search_queries_total',
  help: 'Total number of search queries',
  registers: [register],
});

/**
 * Address Registration Counter
 * Tracks the total number of address registrations
 * Labels: status
 */
export const addressRegistrationCounter = new Counter({
  name: 'mailbox_address_registrations_total',
  help: 'Total number of address registrations',
  labelNames: ['status'],
  registers: [register],
});

/**
 * WebSocket Messages Counter
 * Tracks WebSocket messages sent/received
 * Labels: direction (sent/received), type
 */
export const websocketMessagesCounter = new Counter({
  name: 'mailbox_websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['direction', 'type'],
  registers: [register],
});

/**
 * Helper function to extract domain from email address
 * e.g., "user@expert" -> "expert"
 */
export function extractDomain(address: string): string {
  const parts = address.split('@');
  return parts.length > 1 ? parts[1] : 'unknown';
}

/**
 * Helper function to record email sent metric
 */
export function recordEmailSent(
  from: string,
  to: string | string[],
  priority: string = 'normal',
): void {
  const fromDomain = extractDomain(from);
  const recipients = Array.isArray(to) ? to : [to];

  for (const recipient of recipients) {
    const toDomain = extractDomain(recipient);
    emailsSentCounter.inc({
      from_domain: fromDomain,
      to_domain: toDomain,
      priority: priority || 'normal',
    });
  }
}

/**
 * Helper function to record inbox query metric
 */
export function recordInboxQuery(
  address: string,
  unreadOnly?: boolean,
  starredOnly?: boolean,
): void {
  const addressDomain = extractDomain(address);
  inboxQueriesCounter.inc({
    address_domain: addressDomain,
    unread_only: String(unreadOnly ?? false),
    starred_only: String(starredOnly ?? false),
  });
}

/**
 * Helper function to record WebSocket connection
 */
export function recordWebSocketConnected(address: string): void {
  const addressDomain = extractDomain(address);
  websocketConnectionsGauge.inc({ address_domain: addressDomain });
}

/**
 * Helper function to record WebSocket disconnection
 */
export function recordWebSocketDisconnected(address: string): void {
  const addressDomain = extractDomain(address);
  websocketConnectionsGauge.dec({ address_domain: addressDomain });
}

/**
 * Helper function to record error
 */
export function recordError(
  type: string,
  route: string,
  operation: string,
): void {
  errorCounter.inc({ type, route, operation });
}

/**
 * Helper function to record message operation
 */
export function recordMessageOperation(operation: string, status: string): void {
  messageOperationCounter.inc({ operation, status });
}

/**
 * Helper function to record search query
 */
export function recordSearchQuery(): void {
  searchQueriesCounter.inc();
}

/**
 * Helper function to record address registration
 */
export function recordAddressRegistration(success: boolean): void {
  addressRegistrationCounter.inc({ status: success ? 'success' : 'failure' });
}

/**
 * Helper function to record WebSocket message
 */
export function recordWebSocketMessage(direction: 'sent' | 'received', type: string): void {
  websocketMessagesCounter.inc({ direction, type });
}

/**
 * Get all metrics as Prometheus format string
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Get metrics content type
 */
export function getMetricsContentType(): string {
  return register.contentType;
}
