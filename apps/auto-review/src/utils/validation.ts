import { z } from 'zod';

/**
 * Validation utilities using zod
 */

/**
 * Validate request body against a schema
 */
export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    throw new ValidationError('Validation failed', errors);
  }
  return result.data;
}

/**
 * Validate query parameters against a schema
 */
export function validateQuery<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    throw new ValidationError('Validation failed', errors);
  }
  return result.data;
}

/**
 * Validate path parameters against a schema
 */
export function validateParams<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    throw new ValidationError('Validation failed', errors);
  }
  return result.data;
}

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(message: string, public details: Array<{ path: string; message: string }>) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * HTTP error class
 */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * HTTP 400 Bad Request
 */
export class BadRequestError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(400, message, details);
    this.name = 'BadRequestError';
  }
}

/**
 * HTTP 404 Not Found
 */
export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

/**
 * HTTP 500 Internal Server Error
 */
export class InternalServerError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(500, message, details);
    this.name = 'InternalServerError';
  }
}

/**
 * Common validation schemas
 */
export const reviewRequestSchema = z.object({
  reviewTarget: z.string().min(1, 'Review target is required'),
  section: z.enum(['epidemiology', 'pathophysiology', 'clinical', 'treatment', 'all']).optional().default('epidemiology'),
});

export const progressRequestSchema = z.object({
  reviewTarget: z.string().min(1, 'Review target is required'),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Query is required'),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  sort: z.enum(['match', 'date', 'pubdate', 'fauth', 'jour']).optional(),
  filter: z.string().optional().transform(val => val ? val.split(',') : []),
});

export const articlePmidSchema = z.object({
  pmid: z.string().regex(/^\d+$/, 'Valid PMID is required'),
});

export const extractPdfSchema = z.object({
  url: z.string().url('Valid URL is required'),
  language: z.enum(['en', 'ch']).optional(),
  isOcr: z.boolean().optional(),
  enableFormula: z.boolean().optional(),
  enableTable: z.boolean().optional(),
  pageRanges: z.string().optional(),
  useAgentApi: z.boolean().optional(),
  useDocling: z.boolean().optional(),
});

export const summarizeLiteratureSchema = z.object({
  content: z.string().min(1, 'Content is required'),
});

export const extractPICOSchema = z.object({
  content: z.string().min(1, 'Content is required'),
});

export const summarizeBatchSchema = z.object({
  papers: z.array(
    z.object({
      content: z.string().min(1, 'Content is required'),
      title: z.string().optional(),
      citation: z.string().optional(),
    })
  ).min(1, 'At least one paper is required'),
});
