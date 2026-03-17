import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import mailRouter from './router/mail.router.js';

const fastify = Fastify({
  logger: true,
});

// Swagger configuration
await fastify.register(swagger, {
  swagger: {
    info: {
      title: 'Agent Mailbox API',
      description: 'Email-style message system for multi-agent communication',
      version: '1.0.0',
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Development server' },
    ],
    tags: [
      { name: 'mail', description: 'Mail operations' },
      { name: 'health', description: 'Health check endpoints' },
    ],
  },
});

// Swagger UI
await fastify.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false,
  },
});

// Health check
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
        },
      },
    },
  },
}, (request, reply) => {
  return { health: true, timestamp: new Date().toISOString() };
});

// Register mail routes
fastify.register(mailRouter);

// Start server
fastify.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Server listening on ${address}`);
  fastify.log.info(`Swagger UI available at ${address}/docs`);
});

export default fastify;
