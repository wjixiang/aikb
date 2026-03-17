import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import mailRouter from './router/mail.router.js';
import websocketRouter from './router/websocket.router.js';
import metricsRouter from './router/metrics.router.js';
import { config } from './config.js';
import { websocketConnectionTracker } from './lib/security/rateLimit.js';
import { registerErrorHandler } from './lib/errors/index.js';

/**
 * Create and configure Fastify instance
 */
async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: config.server.logLevel,
    },
    trustProxy: true, // Trust proxy for IP extraction
  });

  // ==================== Security Middleware ====================

  // Register CORS
  if (config.security.enableCors) {
    await fastify.register(cors, {
      origin: config.cors.origin,
      methods: config.cors.methods,
      allowedHeaders: config.cors.allowedHeaders,
      credentials: config.cors.credentials,
      exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'X-RateLimit-Retry-After',
      ],
    });
  }

  // Register Helmet for security headers
  if (config.security.enableHelmet) {
    await fastify.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'wss:', 'ws:'],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // Allow embedding for Swagger UI
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    });
  }

  // Register Rate Limiting
  if (config.rateLimit.enabled) {
    await fastify.register(rateLimit, {
      max: config.rateLimit.maxRequests,
      timeWindow: config.rateLimit.windowMs,
      addHeadersOnExceeding: {
        'x-ratelimit-limit': true,
        'x-ratelimit-remaining': true,
        'x-ratelimit-reset': true,
      },
      addHeaders: {
        'x-ratelimit-limit': true,
        'x-ratelimit-remaining': true,
        'x-ratelimit-reset': true,
        'x-ratelimit-retry-after': true,
      },
      errorResponseBuilder: (req, context) => ({
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${context.max} requests per ${Math.ceil(config.rateLimit.windowMs / 1000)} seconds.`,
        retryAfter: Math.ceil(context.after / 1000),
      }),
    });
  }

  // ==================== Swagger Documentation ====================

  await fastify.register(swagger, {
    swagger: {
      info: {
        title: 'Agent Mailbox API',
        description: 'Email-style message system for multi-agent communication',
        version: '1.0.0',
      },
      servers: [
        { url: `http://localhost:${config.server.port}`, description: 'Development server' },
      ],
      tags: [
        { name: 'mail', description: 'Mail operations' },
        { name: 'health', description: 'Health check endpoints' },
        { name: 'websocket', description: 'WebSocket subscription endpoints' },
        { name: 'metrics', description: 'Prometheus metrics endpoints' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // ==================== WebSocket Support ====================

  await fastify.register(websocket);

  // Decorate fastify with WebSocket connection tracker
  fastify.decorate('wsConnectionTracker', websocketConnectionTracker);

  // ==================== Error Handler ====================

  // Register global error handler
  await registerErrorHandler(fastify);

  // ==================== Health Check ====================

  fastify.get('/health', {
    schema: {
      description: 'Health check endpoint',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            health: { type: 'boolean' },
            timestamp: { type: 'string' },
            version: { type: 'string' },
          },
        },
      },
    },
  }, (request, reply) => {
    return {
      health: true,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  });

  // ==================== Routes ====================

  await fastify.register(mailRouter);
  await fastify.register(websocketRouter);
  await fastify.register(metricsRouter);

  return fastify;
}

/**
 * Start the server
 */
async function start() {
  try {
    const fastify = await buildServer();

    await fastify.listen({
      port: config.server.port,
      host: config.server.host,
    });

    fastify.log.info(`Server listening on port ${config.server.port}`);
    fastify.log.info(`Swagger UI available at http://localhost:${config.server.port}/docs`);
    fastify.log.info(`Security features enabled: Helmet=${config.security.enableHelmet}, CORS=${config.security.enableCors}, RateLimit=${config.rateLimit.enabled}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

// Start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  start();
}

// Export for testing
export { buildServer };
export default buildServer;
