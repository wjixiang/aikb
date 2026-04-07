import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { validatorCompiler, serializerCompiler, jsonSchemaTransform } from 'fastify-type-provider-zod';
import { config } from './config.js';
import { registerRoutes } from './routes/index.js';
import { initLlmPool } from './services/llm-pool.js';
import { initAgentRuntime, registerRuntimeHooks } from './services/agent-runtime.js';
import { NotFoundError, BadRequestError, UpstreamError } from './errors.js';
import { bibItemPlugin } from 'bib-item-plugin';
import { createItemRepository } from './adapters/item-repository.js';
import { createAttachmentRepository } from './adapters/attachment-repository.js';
import { getStorage } from './storage/instance.js';

const swaggerOptions = {
  openapi: {
    info: {
      title: 'Bib Max API',
      description:
        '文献/书籍管理系统 API — 提供文献和书籍的 CRUD 管理、智能标签化分类、批量操作等功能。所有数据扁平存储，通过标签实现灵活分类。',
      version: '1.0.0',
      contact: { name: 'AIKB Team' },
    },
    servers: [{ url: 'http://localhost:3000', description: 'Development' }],
    tags: [
      { name: 'Items', description: '文献/书籍管理' },
      { name: 'Tags', description: '标签管理' },
      { name: 'Attachments', description: '附件管理' },
      { name: 'Chat', description: 'AI 助手对话' },
    ],
  },
};

export async function createApp() {
  const app = Fastify({
    logger: {
      level: 'info',
      transport:
        process.env['NODE_ENV'] === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, {
    origin: config.corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  });

  await app.register(swagger, {
    ...swaggerOptions,
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, { routePrefix: '/docs' });

  // Register bib-item-plugin (Item + Attachment management)
  await app.register(bibItemPlugin, {
    prefix: '/api',
    itemRepository: createItemRepository(),
    attachmentRepository: createAttachmentRepository(),
    storage: getStorage(),
    notFoundError: (entity, id) => new NotFoundError(entity, id),
  });

  initLlmPool();
  registerRoutes(app);
  await initAgentRuntime();
  registerRuntimeHooks(app);

  app.setErrorHandler((err: unknown, _request, reply) => {
    if (err instanceof NotFoundError) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: err.message,
      });
    }

    if (err instanceof BadRequestError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message,
      });
    }

    if (err instanceof UpstreamError) {
      return reply.status(502).send({
        statusCode: 502,
        error: 'Upstream Service Error',
        message: err.message,
      });
    }

    const error = err as FastifyError & { validation?: unknown };
    if (error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation error',
        details: error.validation,
      });
    }

    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      app.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      });
    }

    reply.status(statusCode).send({
      statusCode,
      error: error.code ?? 'Error',
      message: error.message,
    });
  });

  return app;
}
