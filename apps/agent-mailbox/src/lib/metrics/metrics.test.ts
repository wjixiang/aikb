import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  register,
  emailsSentCounter,
  inboxQueriesCounter,
  websocketConnectionsGauge,
  requestDurationHistogram,
  errorCounter,
  messageOperationCounter,
  searchQueriesCounter,
  addressRegistrationCounter,
  websocketMessagesCounter,
  extractDomain,
  recordEmailSent,
  recordInboxQuery,
  recordWebSocketConnected,
  recordWebSocketDisconnected,
  recordError,
  recordMessageOperation,
  recordSearchQuery,
  recordAddressRegistration,
  recordWebSocketMessage,
  getMetrics,
  getMetricsContentType,
} from './metrics.js';

describe('Metrics', () => {
  beforeEach(() => {
    // Reset metrics before each test
    register.resetMetrics();
  });

  describe('extractDomain', () => {
    it('should extract domain from email address', () => {
      expect(extractDomain('user@expert')).toBe('expert');
      expect(extractDomain('agent@mailbox')).toBe('mailbox');
    });

    it('should return unknown for addresses without domain', () => {
      expect(extractDomain('user')).toBe('unknown');
    });

    it('should handle empty string', () => {
      expect(extractDomain('')).toBe('unknown');
    });
  });

  describe('recordEmailSent', () => {
    it('should increment email sent counter for single recipient', async () => {
      recordEmailSent('sender@expert', 'recipient@mailbox', 'high');

      const metrics = await getMetrics();
      expect(metrics).toContain('mailbox_emails_sent_total');
      expect(metrics).toContain('from_domain="expert"');
      expect(metrics).toContain('to_domain="mailbox"');
      expect(metrics).toContain('priority="high"');
    });

    it('should increment counter for multiple recipients', async () => {
      recordEmailSent('sender@expert', ['recipient1@mailbox', 'recipient2@other'], 'normal');

      const metrics = await getMetrics();
      expect(metrics).toContain('to_domain="mailbox"');
      expect(metrics).toContain('to_domain="other"');
    });

    it('should use normal priority when not specified', async () => {
      recordEmailSent('sender@expert', 'recipient@mailbox');

      const metrics = await getMetrics();
      expect(metrics).toContain('priority="normal"');
    });
  });

  describe('recordInboxQuery', () => {
    it('should increment inbox query counter', async () => {
      recordInboxQuery('user@expert', true, false);

      const metrics = await getMetrics();
      expect(metrics).toContain('mailbox_inbox_queries_total');
      expect(metrics).toContain('address_domain="expert"');
      expect(metrics).toContain('unread_only="true"');
      expect(metrics).toContain('starred_only="false"');
    });

    it('should handle undefined filter values', async () => {
      recordInboxQuery('user@expert', undefined, undefined);

      const metrics = await getMetrics();
      expect(metrics).toContain('unread_only="false"');
      expect(metrics).toContain('starred_only="false"');
    });
  });

  describe('recordWebSocketConnected/Disconnected', () => {
    it('should track active WebSocket connections', async () => {
      recordWebSocketConnected('user@expert');

      let metrics = await getMetrics();
      expect(metrics).toContain('mailbox_websocket_connections_active');
      expect(metrics).toContain('address_domain="expert"');

      recordWebSocketDisconnected('user@expert');

      metrics = await getMetrics();
      // After disconnect, the gauge should be 0
      expect(metrics).toContain('mailbox_websocket_connections_active');
    });
  });

  describe('recordError', () => {
    it('should increment error counter', async () => {
      recordError('storage', '/mail/send', 'sendMail');

      const metrics = await getMetrics();
      expect(metrics).toContain('mailbox_errors_total');
      expect(metrics).toContain('type="storage"');
      expect(metrics).toContain('route="/mail/send"');
      expect(metrics).toContain('operation="sendMail"');
    });
  });

  describe('recordMessageOperation', () => {
    it('should increment message operation counter', async () => {
      recordMessageOperation('markAsRead', 'success');

      const metrics = await getMetrics();
      expect(metrics).toContain('mailbox_message_operations_total');
      expect(metrics).toContain('operation="markAsRead"');
      expect(metrics).toContain('status="success"');
    });
  });

  describe('recordSearchQuery', () => {
    it('should increment search query counter', async () => {
      recordSearchQuery();

      const metrics = await getMetrics();
      expect(metrics).toContain('mailbox_search_queries_total');
    });
  });

  describe('recordAddressRegistration', () => {
    it('should increment registration counter for success', async () => {
      recordAddressRegistration(true);

      const metrics = await getMetrics();
      expect(metrics).toContain('mailbox_address_registrations_total');
      expect(metrics).toContain('status="success"');
    });

    it('should increment registration counter for failure', async () => {
      recordAddressRegistration(false);

      const metrics = await getMetrics();
      expect(metrics).toContain('status="failure"');
    });
  });

  describe('recordWebSocketMessage', () => {
    it('should increment WebSocket message counter for sent messages', async () => {
      recordWebSocketMessage('sent', 'notification');

      const metrics = await getMetrics();
      expect(metrics).toContain('mailbox_websocket_messages_total');
      expect(metrics).toContain('direction="sent"');
      expect(metrics).toContain('type="notification"');
    });

    it('should increment WebSocket message counter for received messages', async () => {
      recordWebSocketMessage('received', 'ping');

      const metrics = await getMetrics();
      expect(metrics).toContain('direction="received"');
      expect(metrics).toContain('type="ping"');
    });
  });

  describe('getMetrics', () => {
    it('should return metrics in Prometheus format', async () => {
      recordSearchQuery();
      recordEmailSent('test@expert', 'recipient@mailbox');

      const metrics = await getMetrics();
      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('# HELP');
      expect(metrics).toContain('# TYPE');
    });
  });

  describe('getMetricsContentType', () => {
    it('should return correct content type', () => {
      const contentType = getMetricsContentType();
      expect(contentType).toContain('text/plain');
    });
  });
});
