import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getContainer, ServiceContainer } from '../di/index.js';
import {
  LiteratureSummaryService,
  LiteratureSummaryResult,
  PICOExtractionResult,
} from './literature-summary.service.js';
import { HttpError } from '../utils/validation.js';
import { summarizeLiteratureSchema, extractPICOSchema, summarizeBatchSchema, validateBody } from '../utils/validation.js';

/**
 * Register literature summary routes
 */
export function registerLiteratureSummaryRoutes(fastify: FastifyInstance, container: ServiceContainer) {
  const literatureSummaryService = container.literatureSummary;

  /**
   * POST /literature-summary/summarize - Summarize paper
   */
  fastify.post('/literature-summary/summarize', {
    schema: {
      description: 'Summarize a single medical literature article',
      tags: ['literature-summary'],
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', description: 'Full text or extracted content from paper' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            error: { type: 'string', nullable: true },
            processingTimeMs: { type: 'number', nullable: true },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    try {
      const body = validateBody(summarizeLiteratureSchema, request.body);
      const result: LiteratureSummaryResult = await literatureSummaryService.summarizeLiterature(body.content);

      return {
        success: result.success,
        data: result.summary,
        error: result.error,
        processingTimeMs: result.processingTimeMs,
      };
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

  /**
   * POST /literature-summary/extract-pico - Extract PICO
   */
  fastify.post('/literature-summary/extract-pico', {
    schema: {
      description: 'Extract PICO elements from literature',
      tags: ['literature-summary'],
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', description: 'Text content to extract PICO from' },
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
                population: { type: 'object' },
                intervention: { type: 'object' },
                outcome: { type: 'object' },
              },
            },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    try {
      const body = validateBody(extractPICOSchema, request.body);
      const result: PICOExtractionResult = await literatureSummaryService.extractPICO(body.content);

      return {
        success: result.success,
        data: {
          population: result.population,
          intervention: result.intervention,
          outcome: result.outcome,
        },
        error: result.error,
      };
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

  /**
   * POST /literature-summary/summarize-batch - Batch summarize
   */
  fastify.post('/literature-summary/summarize-batch', {
    schema: {
      description: 'Summarize multiple papers for systematic review',
      tags: ['literature-summary'],
      body: {
        type: 'object',
        required: ['papers'],
        properties: {
          papers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                content: { type: 'string' },
                title: { type: 'string' },
                citation: { type: 'string' },
              },
              required: ['content'],
            },
          },
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
                summaries: { type: 'array', items: { type: 'object' } },
                synthesis: { type: 'string' },
                themes: { type: 'array', items: { type: 'string' } },
                conflicts: { type: 'array', items: { type: 'string' } },
                gaps: { type: 'array', items: { type: 'string' } },
              },
            },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    try {
      const body = validateBody(summarizeBatchSchema, request.body);
      const result = await literatureSummaryService.summarizeMultiplePapers(body.papers);

      return {
        success: result.success,
        data: {
          summaries: result.summaries,
          synthesis: result.synthesis,
          themes: result.themes,
          conflicts: result.conflicts,
          gaps: result.gaps,
        },
        error: result.error,
      };
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
