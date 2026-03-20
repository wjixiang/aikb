import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { getContainer, ServiceContainer } from '../di/index.js';
import { ArticleAnalysisService, PdfExtractOptions, PdfExtractResult } from './article-analysis.service.js';
import { HttpError, BadRequestError } from '../utils/validation.js';
import { extractPdfSchema } from '../utils/validation.js';
import { validateBody } from '../utils/validation.js';
import { join } from 'node:path';
import * as fs from 'node:fs/promises';
import * as crypto from 'node:crypto';
import config from '../config.js';

/**
 * Register article analysis routes
 */
export function registerArticleAnalysisRoutes(fastify: FastifyInstance, container: ServiceContainer) {
  const articleAnalysisService = container.articleAnalysis;

  /**
   * POST /article-analysis/extract/url - Extract PDF from URL
   */
  fastify.post('/article-analysis/extract/url', {
    schema: {
      description: 'Extract PDF content from URL',
      tags: ['article-analysis'],
      body: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'PDF URL' },
          language: { type: 'string', enum: ['en', 'ch'], default: 'ch' },
          isOcr: { type: 'boolean', default: false },
          enableFormula: { type: 'boolean', default: true },
          enableTable: { type: 'boolean', default: true },
          pageRanges: { type: 'string', description: 'Page ranges (e.g., "1-5,10-15")' },
          useAgentApi: { type: 'boolean', default: false },
          useDocling: { type: 'boolean', default: false },
        },
        required: ['url'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                markdown: { type: 'string' },
                images: { type: 'array', items: { type: 'string' } },
                taskId: { type: 'string' },
                downloadedFiles: { type: 'array', items: { type: 'string' } },
                backend: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    try {
      const body = validateBody(extractPdfSchema, request.body);

      const result = await articleAnalysisService.extractFromUrl({
        url: body.url,
        language: body.language || 'ch',
        isOcr: body.isOcr ?? false,
        enableFormula: body.enableFormula ?? true,
        enableTable: body.enableTable ?? true,
        pageRanges: body.pageRanges,
        useAgentApi: body.useAgentApi ?? false,
        useDocling: body.useDocling ?? false,
      });

      return { success: true, data: result };
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
   * POST /article-analysis/extract/file - Extract PDF from uploaded file
   */
  fastify.post('/article-analysis/extract/file', {
    schema: {
      description: 'Extract PDF content from uploaded file',
      tags: ['article-analysis'],
      consumes: ['multipart/form-data'],
      body: {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description: 'PDF file to upload',
          },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          language: { type: 'string', enum: ['en', 'ch'], default: 'ch' },
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
                markdown: { type: 'string' },
                images: { type: 'array', items: { type: 'string' } },
                taskId: { type: 'string' },
                downloadedFiles: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    },
  }, async (request: any, reply: any) => {
    try {
      const data = await request.file();

      if (!data) {
        throw new BadRequestError('File is required');
      }

      // Ensure uploads directory exists
      await fs.mkdir(config.uploads.dir, { recursive: true });

      // Generate unique filename
      const ext = data.filename.split('.').pop() || 'pdf';
      const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
      const filePath = join(config.uploads.dir, uniqueName);

      // Save file to disk
      const buffer = await data.toBuffer();
      await fs.writeFile(filePath, buffer);

      // Extract content
      const result = await articleAnalysisService.extractFromFile(filePath, {
        language: (request.query.language as 'en' | 'ch') || 'ch',
        useAgentApi: true,
      });

      return { success: true, data: result };
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
   * GET /article-analysis/task/:taskId - Get task result
   */
  fastify.get('/article-analysis/task/:taskId', {
    schema: {
      description: 'Get task result by ID',
      tags: ['article-analysis'],
      params: {
        type: 'object',
        required: ['taskId'],
        properties: {
          taskId: { type: 'string' },
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
  }, async (request: any, reply: any) => {
    try {
      const result = await articleAnalysisService.getTaskResult(request.params.taskId);
      return { success: true, data: result };
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
   * GET /article-analysis/validate-token - Validate MinerU token
   */
  fastify.get('/article-analysis/validate-token', {
    schema: {
      description: 'Validate MinerU token',
      tags: ['article-analysis'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                isValid: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, async (request: any, reply: any) => {
    try {
      const isValid = await articleAnalysisService.validateToken();
      return { success: true, data: { isValid } };
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
