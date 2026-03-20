import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getContainer, ServiceContainer } from '../di/index.js';
import {
  validateBody,
  reviewRequestSchema,
  progressRequestSchema,
  HttpError,
} from '../utils/validation.js';
import type { ProgressResponse } from './app.dto.js';
import type { ReviewSection } from '../article-search/base.engine.js';

/**
 * Register app routes
 */
export function registerAppRoutes(
  fastify: FastifyInstance,
  container: ServiceContainer,
) {
  let appService: any;

  const getService = async () => {
    if (!appService) {
      const { AppService } = await import('./app.service.js');
      appService = new AppService(
        container.prisma,
        container.epidemiologyEngine,
        container.pathophysiologyEngine,
        container.clinicalEngine,
        container.treatmentEngine,
      );
    }
    return appService;
  };

  /**
   * POST /app/review - Create review task for specific section
   */
  fastify.post(
    '/app/review',
    {
      schema: {
        description: 'Create a new review task for a specific section',
        tags: ['app'],
        body: {
          type: 'object',
          required: ['reviewTarget'],
          properties: {
            reviewTarget: {
              type: 'string',
              description: 'Disease or topic to review',
            },
            section: {
              type: 'string',
              enum: [
                'epidemiology',
                'pathophysiology',
                'clinical',
                'treatment',
                'all',
              ],
              default: 'epidemiology',
              description: 'Review section to search',
            },
            embed: {
              type: 'boolean',
              default: true,
              description: 'Whether to generate embeddings for search results',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              taskInput: { type: 'string' },
              section: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: { reviewTarget: string; section?: string; embed?: boolean };
      }>,
      reply: FastifyReply,
    ) => {
      const service = await getService();
      try {
        const body = request.body as {
          reviewTarget: string;
          section?: string;
          embed?: boolean;
        };
        const result =
          body.section === 'all'
            ? await service.createAllSectionsTask({
                taskInput: body.reviewTarget,
                embed: body.embed,
              })
            : await service.createTask({
                taskInput: body.reviewTarget,
                section: (body.section as ReviewSection) || 'epidemiology',
                embed: body.embed,
              });
        return result;
      } catch (error) {
        console.error(error);
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
    },
  );

  /**
   * POST /app/progress - Check task progress
   */
  fastify.post(
    '/app/progress',
    {
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
              section: { type: 'string' },
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
    },
    async (
      request: FastifyRequest<{ Body: { reviewTarget: string } }>,
      reply: FastifyReply,
    ) => {
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
    },
  );

  /**
   * GET /app/sections - List available review sections
   */
  fastify.get(
    '/app/sections',
    {
      schema: {
        description: 'List available review sections',
        tags: ['app'],
        response: {
          200: {
            type: 'object',
            properties: {
              sections: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async () => {
      return {
        sections: [
          {
            id: 'epidemiology',
            name: 'Epidemiology',
            description:
              'Prevalence, incidence, risk factors, population studies',
          },
          {
            id: 'pathophysiology',
            name: 'Pathophysiology',
            description: 'Disease mechanisms, cellular and molecular processes',
          },
          {
            id: 'clinical',
            name: 'Clinical Manifestations',
            description: 'Signs, symptoms, diagnosis, clinical presentation',
          },
          {
            id: 'treatment',
            name: 'Treatment',
            description:
              'Therapeutic interventions, drug treatments, procedures',
          },
          {
            id: 'all',
            name: 'All Sections',
            description: 'Run all four sections sequentially',
          },
        ],
      };
    },
  );

  /**
   * GET /app/search-results/:taskId - Get search results for a task
   */
  fastify.get(
    '/app/search-results/:taskId',
    {
      schema: {
        description: 'Get search results for a task',
        tags: ['app'],
        params: {
          type: 'object',
          required: ['taskId'],
          properties: {
            taskId: { type: 'string', description: 'Task ID' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { taskId: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { taskId } = request.params;
        const results = await container.searchResult.getSearchResults(taskId);
        return { success: true, data: results };
      } catch (error) {
        reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  /**
   * GET /app/search-results/:taskId/final - Get final search result for a task
   */
  fastify.get(
    '/app/search-results/:taskId/final',
    {
      schema: {
        description: 'Get final search result for a task',
        tags: ['app'],
        params: {
          type: 'object',
          required: ['taskId'],
          properties: {
            taskId: { type: 'string', description: 'Task ID' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { taskId: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { taskId } = request.params;
        const result =
          await container.searchResult.getFinalSearchResult(taskId);
        if (!result) {
          reply.status(404).send({
            success: false,
            error: 'Final search result not found',
          });
          return;
        }
        return { success: true, data: result };
      } catch (error) {
        reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  /**
   * POST /app/embed/:taskId - Generate embeddings for task search results
   */
  fastify.post(
    '/app/embed/:taskId',
    {
      schema: {
        description: 'Generate embeddings for task search results',
        tags: ['app'],
        params: {
          type: 'object',
          required: ['taskId'],
          properties: {
            taskId: { type: 'string', description: 'Task ID' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  totalArticles: { type: 'number' },
                  processedArticles: { type: 'number' },
                  embeddedArticles: { type: 'number' },
                  errors: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { taskId: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { taskId } = request.params;
        const progress = await container.embedding.embedSearchResults(taskId);
        return { success: true, data: progress };
      } catch (error) {
        reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  /**
   * GET /app/articles/:taskId - Get all unique articles for a task
   */
  fastify.get(
    '/app/articles/:taskId',
    {
      schema: {
        description: 'Get all unique articles for a task',
        tags: ['app'],
        params: {
          type: 'object',
          required: ['taskId'],
          properties: {
            taskId: { type: 'string', description: 'Task ID' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { taskId: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { taskId } = request.params;
        const articles = await container.searchResult.getAllArticles(taskId);
        return { success: true, data: articles };
      } catch (error) {
        reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );
}
