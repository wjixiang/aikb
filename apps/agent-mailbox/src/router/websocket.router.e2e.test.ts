import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import mailRouter from './mail.router.js';
import websocketRouter from './websocket.router.js';
import { PostgreMailStorage } from '../lib/storage/postgreMailStorage.js';
import { MailAddress } from '../lib/storage/type.js';
import {
  type WebSocketMessage,
  type SubscribedMessage,
  type NewMailMessage,
  type PongMessage,
} from '../lib/websocket/types.js';
import WebSocket from 'ws';

describe('WebSocket Router E2E', () => {
  let app: ReturnType<typeof Fastify>;
  let storage: PostgreMailStorage;
  const testAddress: MailAddress = 'websocket-test@expert';
  const port = 3002;
  let baseUrl: string;

  beforeAll(async () => {
    // Create Fastify instance
    app = Fastify({ logger: false });

    // Create and initialize storage
    storage = new PostgreMailStorage();
    await storage.initialize();

    // Decorate with storage
    app.decorate('mailStorage', storage);

    // Register WebSocket plugin
    await app.register(websocket);

    // Register routes
    await app.register(mailRouter);
    await app.register(websocketRouter);

    // Start server
    await app.listen({ port });
    baseUrl = `http://localhost:${port}`;

    // Register test address
    await storage.registerAddress(testAddress);
  });

  afterAll(async () => {
    await app.close();
    await storage.close();
  });

  describe('WebSocket Connection', () => {
    it('should establish WebSocket connection', async () => {
      const wsUrl = `ws://localhost:${port}/api/v1/ws/subscribe/${encodeURIComponent(testAddress)}`;
      const ws = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          resolve();
        });
        ws.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);

      ws.close();
      await new Promise<void>((resolve) => ws.on('close', resolve));
    });

    it('should receive subscription confirmation', async () => {
      const wsUrl = `ws://localhost:${port}/api/v1/ws/subscribe/${encodeURIComponent(testAddress)}`;
      const ws = new WebSocket(wsUrl);

      const message = await new Promise<WebSocketMessage>((resolve, reject) => {
        ws.on('message', (data) => {
          resolve(JSON.parse(data.toString()) as WebSocketMessage);
        });
        ws.on('error', reject);
        setTimeout(() => reject(new Error('Message timeout')), 5000);
      });

      expect(message.type).toBe('subscribed');
      const subscribedMsg = message as SubscribedMessage;
      expect(subscribedMsg.address).toBe(testAddress);
      expect(subscribedMsg.timestamp).toBeDefined();

      ws.close();
      await new Promise<void>((resolve) => ws.on('close', resolve));
    });

    it('should receive new mail notification when mail is sent', async () => {
      const wsUrl = `ws://localhost:${port}/api/v1/ws/subscribe/${encodeURIComponent(testAddress)}`;
      const ws = new WebSocket(wsUrl);

      // Wait for subscription confirmation
      await new Promise<void>((resolve, reject) => {
        ws.on('message', () => resolve());
        ws.on('error', reject);
        setTimeout(() => reject(new Error('Subscription timeout')), 5000);
      });

      // Listen for new_mail notification
      const newMailPromise = new Promise<NewMailMessage>((resolve, reject) => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString()) as WebSocketMessage;
          if (msg.type === 'new_mail') {
            resolve(msg as NewMailMessage);
          }
        });
        ws.on('error', reject);
        setTimeout(() => reject(new Error('New mail notification timeout')), 5000);
      });

      // Send a mail to the subscribed address via HTTP
      const sendResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: 'sender@expert',
          to: testAddress,
          subject: 'WebSocket Test Subject',
          body: 'WebSocket test body',
          priority: 'high',
        },
      });

      expect(sendResponse.statusCode).toBe(200);

      // Wait for notification
      const notification = await newMailPromise;

      expect(notification.type).toBe('new_mail');
      expect(notification.mail.subject).toBe('WebSocket Test Subject');
      expect(notification.mail.from).toBe('sender@expert');
      expect(notification.mail.priority).toBe('high');
      expect(notification.timestamp).toBeDefined();

      ws.close();
      await new Promise<void>((resolve) => ws.on('close', resolve));
    });

    it('should handle ping/pong messages', async () => {
      const uniqueAddress = 'ping-test@expert';
      await storage.registerAddress(uniqueAddress);

      const wsUrl = `ws://localhost:${port}/api/v1/ws/subscribe/${encodeURIComponent(uniqueAddress)}`;
      const ws = new WebSocket(wsUrl);

      // Collect messages
      const messages: WebSocketMessage[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()) as WebSocketMessage);
      });

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      // Wait for subscription confirmation
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      // Send ping
      ws.send(JSON.stringify({ type: 'ping' }));

      // Wait for pong
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      // Find pong message
      const pong = messages.find((m): m is PongMessage => m.type === 'pong');
      expect(pong).toBeDefined();
      if (pong) {
        expect(pong.type).toBe('pong');
        expect(pong.timestamp).toBeDefined();
      }

      ws.close();
      await new Promise<void>((resolve) => ws.on('close', resolve));
    });
  });

  describe('WebSocket Stats', () => {
    it('should return WebSocket statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/ws/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as {
        totalSubscriptions: number;
        subscribedAddresses: string[];
      };
      expect(typeof body.totalSubscriptions).toBe('number');
      expect(Array.isArray(body.subscribedAddresses)).toBe(true);
    });
  });

  describe('Multiple Subscribers', () => {
    it('should notify multiple subscribers for the same address', async () => {
      const wsUrl = `ws://localhost:${port}/api/v1/ws/subscribe/${encodeURIComponent(testAddress)}`;

      // Create two WebSocket connections
      const ws1 = new WebSocket(wsUrl);
      const ws2 = new WebSocket(wsUrl);

      // Wait for both connections and confirmations
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          ws1.on('message', () => resolve());
          ws1.on('error', reject);
          setTimeout(() => reject(new Error('WS1 subscription timeout')), 5000);
        }),
        new Promise<void>((resolve, reject) => {
          ws2.on('message', () => resolve());
          ws2.on('error', reject);
          setTimeout(() => reject(new Error('WS2 subscription timeout')), 5000);
        }),
      ]);

      // Listen for notifications on both sockets
      interface NotificationWithSource extends NewMailMessage {
        source: string;
      }
      const notifications: NotificationWithSource[] = [];
      ws1.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as WebSocketMessage;
        if (msg.type === 'new_mail') {
          notifications.push({ source: 'ws1', ...(msg as NewMailMessage) });
        }
      });
      ws2.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as WebSocketMessage;
        if (msg.type === 'new_mail') {
          notifications.push({ source: 'ws2', ...(msg as NewMailMessage) });
        }
      });

      // Send a mail
      await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: 'sender@expert',
          to: testAddress,
          subject: 'Multiple Subscriber Test',
          body: 'Testing multiple subscribers',
        },
      });

      // Wait for notifications
      await new Promise<void>((resolve) => setTimeout(resolve, 500));

      // Both subscribers should receive the notification
      expect(notifications.length).toBe(2);
      expect(notifications.some((n) => n.source === 'ws1')).toBe(true);
      expect(notifications.some((n) => n.source === 'ws2')).toBe(true);

      ws1.close();
      ws2.close();
      await Promise.all([
        new Promise<void>((resolve) => ws1.on('close', resolve)),
        new Promise<void>((resolve) => ws2.on('close', resolve)),
      ]);
    });
  });
});
