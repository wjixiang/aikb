import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getContainer, ServiceContainer } from '../di/index.js';
import { validateBody, reviewRequestSchema, progressRequestSchema, HttpError } from '../utils/validation.js';
import type { ProgressResponse } from './app.dto.js';

/**
 * Register app routes
 */
export function registerAppRoutes(fastify: FastifyInstance, container: ServiceContainer) {
  // Import service dynamically to avoid circular dependency
  let appService: any;

  const getService = async () => {
    if (!appService) {
      const { AppService } = await import('./app.service.js');
      appService = new AppService(
        container.prisma,
        container.researchEngine,
      );
    }
    return appService;
  };

  /**
   * POST /app/review - Create review task
   */
  fastify.post('/app/review', {
    schema: {
      description: 'Create a new review task',
      tags: ['app'],
      body: {
        type: 'object',
        required: ['reviewTarget'],
        properties: {
          reviewTarget: { type: 'string', description: 'Disease or topic to review' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            taskInput: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { reviewTarget: string } }>, reply: FastifyReply) => {
    const service = await getService();
    try {
      const body = validateBody(reviewRequestSchema, request.body);
      const result = await service.createTask({
        taskInput: body.reviewTarget,
      });
      return result;
    } catch (error) {
      console.error(error)
      if (error instanceof HttpError) {
        reply.status(error.statusCode).send({
          success: false,
          error: error.message,
        });
        return;
      }
      reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /app/progress - Check task progress
   */
  fastify.post('/app/progress', {
    schema: {
      description: 'Get task progress',
      tags: ['app'],
      body: {
        type: 'object',
        required: ['reviewTarget'],
        properties: {
          reviewTarget: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            taskId: { type: 'string' },
            taskInput: { type: 'string' },
            progress: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  done: { type: 'string' },
                  log: { type: 'string' },
                  ts: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { reviewTarget: string } }>, reply: FastifyReply) => {
    const service = await getService();
    try {
      const body = validateBody(progressRequestSchema, request.body);
      const result = await service.getTaskProgress(body.reviewTarget);
      if (!result) {
        reply.status(404).send({
          success: false,
          error: 'Task not found',
        });
        return;
      }
      return result;
    } catch (error) {
      if (error instanceof HttpError) {
        reply.status(error.statusCode).send({
          success: false,
          error: error.message,
        });
        return;
      }
      reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
