import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { initContainer, destroyContainer, getContainer } from './di/index.js';

// Import route handlers
import { registerAppRoutes } from './app/routes.js';
import { registerSearchRoutes } from './search/routes.js';
import { registerArticleAnalysisRoutes } from './article-analysis/routes.js';
import { registerLiteratureSummaryRoutes } from './literature-summary/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

/**
 * Create and configure Fastify server
 */
async function createServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    },
  });

  // Register CORS
  await fastify.register(cors, {
    origin: config.cors.origin,
    credentials: config.cors.credentials,
  });

  // Register multipart for file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: config.uploads.maxFileSize,
    },
    attachFieldsToBody: true,
    sharedSchemaId: 'MultipartFileType',
  });

  // Register Swagger if enabled
  if (config.swagger.enabled) {
    await fastify.register(swagger, {
      openapi: {
        info: {
          title: 'Auto Review API',
          description: 'API for epidemiology literature review and article analysis',
          version: '1.0.0',
        },
        servers: [
          {
            url: `http://localhost:${config.port}`,
            description: 'Development server',
          },
        ],
        components: {
          schemas: {
            MultipartFileType: {
              type: 'object',
              properties: {
                file: {
                  type: 'string',
                  format: 'binary',
                },
              },
            },
          },
        },
      },
    });

    await fastify.register(swaggerUi, {
      routePrefix: config.swagger.path,
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
      },
      staticCSP: true,
    });
  }

  // Register health check
  fastify.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Initialize service container
  const container = await initContainer();

  // Register route handlers
  registerAppRoutes(fastify, container);
  registerSearchRoutes(fastify, container);
  registerArticleAnalysisRoutes(fastify, container);
  registerLiteratureSummaryRoutes(fastify, container);

  // Global error handler
  const { errorHandler } = await import('./utils/error-handler.js');
  fastify.setErrorHandler(errorHandler);

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    fastify.log.info(`${signal} received, closing server...`);
    await fastify.close();
    await destroyContainer();
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return fastify;
}

/**
 * Start server
 */
async function start() {
  const fastify = await createServer();

  try {
    const address = await fastify.listen({
      port: config.port,
      host: '0.0.0.0',
    });

    console.log(`Server listening at ${address}`);
    console.log(`API documentation available at http://localhost:${config.port}${config.swagger.path}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Start server if this is the main module
start().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});

export { createServer };
