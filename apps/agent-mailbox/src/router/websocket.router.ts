import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { subscriptionManager } from '../lib/websocket/subscriptionManager.js';
import {
  recordWebSocketConnected,
  recordWebSocketDisconnected,
  recordWebSocketMessage,
  websocketConnectionDurationHistogram,
} from '../lib/metrics/index.js';
import { createLogger } from '../lib/logger.js';
import { config } from '../config.js';
import {
  websocketConnectionTracker,
  generateConnectionId,
} from '../lib/security/rateLimit.js';
import { validateMailAddress } from '../lib/security/index.js';

/**
 * WebSocket Router Plugin
 * Provides WebSocket endpoints for real-time mail notifications
 */
const websocketRouterPlugin: FastifyPluginAsync = async (
  fastify: FastifyInstance,
) => {
  const routeLogger = createLogger(undefined, { component: 'websocket-router' });

  // WebSocket subscription endpoint
  // ws://localhost:3000/api/v1/ws/subscribe/:address
  fastify.get<{
    Params: { address: string };
  }>(
    '/api/v1/ws/subscribe/:address',
    {
      websocket: true,
      schema: {
        description: 'WebSocket subscription for new mail notifications',
        tags: ['websocket'],
        params: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'Mailbox address to subscribe (e.g., "pubmed@expert")',
            },
          },
        },
      },
    },
    (socket, request) => {
      const { address } = request.params;
      const clientIp = request.ip;
      const connectionId = generateConnectionId();
      const connectionStartTime = Date.now();
      const logger = createLogger(request, {
        component: 'websocket',
        operation: 'connection',
        address,
      });

      // Validate address format
      if (config.security.enableValidation) {
        const validationResult = validateMailAddress(address);
        if (!validationResult.valid) {
          logger.warn(`Invalid address format rejected: ${address}`);
          socket.close(1008, 'Invalid address format');
          return;
        }
      }

      // Check connection limit per IP
      if (config.rateLimit.enabled) {
        websocketConnectionTracker.setMaxConnections(config.rateLimit.maxWsConnectionsPerIp);
        if (!websocketConnectionTracker.canConnect(clientIp)) {
          logger.warn(`Connection limit exceeded for IP: ${clientIp}`);
          socket.close(1008, 'Connection limit exceeded');
          return;
        }
        websocketConnectionTracker.addConnection(clientIp, connectionId);
      }

      logger.info(
        `WebSocket client connected: ${address} from ${clientIp}`,
      );

      // Record WebSocket connection metric
      recordWebSocketConnected(address);
      recordWebSocketMessage('received', 'connection');

      // Subscribe this socket to the address
      subscriptionManager.subscribe(socket, address);

      // Handle incoming messages (optional - for ping/pong or client commands)
      socket.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          logger.debug(`WebSocket message from ${address}:`, data);

          // Record received message metric
          recordWebSocketMessage('received', data.type || 'unknown');

          // Handle ping
          if (data.type === 'ping') {
            const pongResponse = JSON.stringify({
              type: 'pong',
              timestamp: new Date().toISOString(),
            });
            socket.send(pongResponse);
            recordWebSocketMessage('sent', 'pong');
          }
        } catch {
          // Ignore invalid JSON
          logger.warn(`Invalid WebSocket message from ${address}`);
          recordWebSocketMessage('received', 'invalid');
        }
      });

      // Handle close
      socket.on('close', () => {
        const duration = (Date.now() - connectionStartTime) / 1000;
        logger.info(`WebSocket client disconnected: ${address}`, {
          durationSeconds: duration,
        });

        // Record disconnection metrics
        recordWebSocketDisconnected(address);
        recordWebSocketMessage('sent', 'disconnection');
        websocketConnectionDurationHistogram.observe(duration);

        // Remove connection from tracker
        if (config.rateLimit.enabled) {
          websocketConnectionTracker.removeConnection(clientIp, connectionId);
        }

        subscriptionManager.unsubscribe(socket);
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`WebSocket error for ${address}:`, error);
        subscriptionManager.unsubscribe(socket);
      });
    },
  );

  // REST endpoint to get subscription statistics (for monitoring)
  fastify.get('/api/v1/ws/stats', {
    schema: {
      description: 'Get WebSocket subscription statistics',
      tags: ['websocket'],
      response: {
        200: {
          type: 'object',
          properties: {
            totalSubscriptions: { type: 'number' },
            subscribedAddresses: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
  }, async (request) => {
    const logger = createLogger(request, { operation: 'getWebSocketStats' });
    logger.debug('WebSocket stats retrieved');

    return {
      totalSubscriptions: subscriptionManager.getTotalSubscriptions(),
      subscribedAddresses: subscriptionManager.getSubscribedAddresses(),
    };
  });

  routeLogger.info('WebSocket router registered');
};

export default websocketRouterPlugin;
