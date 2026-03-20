import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getContainer, ServiceContainer } from '../di/index.js';
import { SearchService, PubmedSearchParams } from './search.service.js';
import { HttpError, BadRequestError, NotFoundError } from '../utils/validation.js';
import { SortOrder } from './dto/search.dto.js';
import {
  SearchResponseDto,
  ArticleDetailResponseDto,
} from './dto/search.dto.js';

/**
 * Register search routes
 */
export function registerSearchRoutes(fastify: FastifyInstance, container: ServiceContainer) {
  const searchService = container.search;

  /**
   * GET /search/pubmed - PubMed search
   */
  fastify.get('/search/pubmed', {
    schema: {
      description: 'Search PubMed for articles',
      tags: ['search'],
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', description: 'Search query' },
          page: { type: 'number', description: 'Page number' },
          sort: {
            type: 'string',
            enum: Object.values(SortOrder),
            description: 'Sort order',
            default: SortOrder.MATCH,
          },
          filter: {
            type: 'string',
            description: 'Filter (comma-separated for multiple)',
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
                totalResults: { type: 'number', nullable: true },
                totalPages: { type: 'number', nullable: true },
                articleProfiles: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      pmid: { type: 'string' },
                      title: { type: 'string' },
                      authors: { type: 'string' },
                      journalCitation: { type: 'string' },
                      snippet: { type: 'string' },
                      doi: { type: 'string', nullable: true },
                      position: { type: 'number', nullable: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request: any, reply: any) => {
    try {
      const { q, page, sort, filter } = request.query;

      if (!q) {
        throw new BadRequestError('Query parameter "q" is required');
      }

      const params: PubmedSearchParams = {
        term: q,
        sort: (sort as SortOrder) || SortOrder.MATCH,
        filter: filter ? (filter as string).split(',') : [],
        page: page ? parseInt(String(page), 10) : null,
      };

      const result = await searchService.searchPubMed(params);

      return {
        success: true,
        data: result,
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
   * GET /search/pubmed/:pmid - Get article detail
   */
  fastify.get('/search/pubmed/:pmid', {
    schema: {
      description: 'Get article details by PMID',
      tags: ['search'],
      params: {
        type: 'object',
        required: ['pmid'],
        properties: {
          pmid: { type: 'string', description: 'PubMed ID' },
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
                pmid: { type: 'string' },
                doi: { type: 'string' },
                title: { type: 'string' },
                abstract: { type: 'string' },
                authors: { type: 'array' },
                affiliations: { type: 'array' },
                keywords: { type: 'array' },
                meshTerms: { type: 'array' },
                publicationTypes: { type: 'array', items: { type: 'string' } },
                references: { type: 'array' },
                similarArticles: { type: 'array' },
                fullTextSources: { type: 'array' },
                conflictOfInterestStatement: { type: 'string' },
                relatedInformation: { type: 'object' },
                journalInfo: { type: 'object' },
              },
            },
          },
        },
      },
    },
  }, async (request: any, reply: any) => {
    try {
      const pmid = request.params.pmid;

      if (!pmid || !/^\d+$/.test(pmid)) {
        throw new BadRequestError('Valid PMID is required');
      }

      const article = await searchService.getArticleDetail(pmid);

      if (!article.title) {
        throw new NotFoundError(`Article with PMID ${pmid} not found`);
      }

      return {
        success: true,
        data: article,
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
