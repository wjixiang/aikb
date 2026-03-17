import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { AppError, ValidationError } from './AppError.js';
import { ZodError } from 'zod';

/**
 * Error response format
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: unknown;
  };
}

/**
 * Convert ZodError to ValidationError
 */
export function convertZodError(zodError: ZodError): ValidationError {
  const details = zodError.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));

  return new ValidationError('Request validation failed', details);
}

/**
 * Global error handler function
 */
export function handleError(error: unknown, request: FastifyRequest, reply: FastifyReply): ErrorResponse {
  // Log error for debugging
  request.log.error({
    err: error,
    url: request.url,
    method: request.method,
    body: request.body,
    params: request.params,
    query: request.query,
  }, 'Error occurred during request processing');

  // Handle AppError (our custom errors)
  if (error instanceof AppError) {
    const statusCode = error.statusCode;
    const response = error.toJSON();
    reply.status(statusCode).send(response);
    return response as ErrorResponse;
  }

  // Handle Fastify validation errors (schema validation)
  if (isFastifyValidationError(error)) {
    const validationError = new ValidationError(
      'Request validation failed',
      error.validation?.map((v: { instancePath?: string; message?: string }) => ({
        field: v.instancePath?.replace(/^\//, '') || 'unknown',
        message: v.message || 'Invalid value',
      })) || []
    );
    const response = validationError.toJSON();
    reply.status(400).send(response);
    return response as ErrorResponse;
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationError = convertZodError(error);
    const response = validationError.toJSON();
    reply.status(400).send(response);
    return response as ErrorResponse;
  }

  // Handle Prisma errors
  if (isPrismaError(error)) {
    const { statusCode, code, message } = handlePrismaError(error);
    const response: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        statusCode,
      },
    };
    reply.status(statusCode).send(response);
    return response;
  }

  // Handle generic errors
  const isOperational = error instanceof Error && 'isOperational' in error
    ? (error as AppError).isOperational
    : false;

  const statusCode = isOperational ? 400 : 500;
  const code = isOperational ? 'BAD_REQUEST' : 'INTERNAL_ERROR';
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';

  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message: isOperational ? message : 'Internal server error',
      statusCode,
    },
  };

  // Only include detailed error message in development
  if (process.env.NODE_ENV === 'development' && error instanceof Error) {
    response.error.details = {
      message: error.message,
      stack: error.stack,
    };
  }

  reply.status(statusCode).send(response);
  return response;
}

/**
 * Type guard for Fastify validation errors
 */
function isFastifyValidationError(error: unknown): error is FastifyError & { validation: Array<{ instancePath?: string; message?: string }> } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'validation' in error &&
    Array.isArray((error as { validation: unknown }).validation)
  );
}

/**
 * Type guard for Prisma errors
 */
function isPrismaError(error: unknown): error is Error & { code?: string; meta?: Record<string, unknown> } {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as { code?: string }).code === 'string' &&
    (error as { code?: string }).code?.startsWith('P') === true
  );
}

/**
 * Handle Prisma errors and return appropriate status code and message
 */
function handlePrismaError(error: Error & { code?: string; meta?: Record<string, unknown> }): {
  statusCode: number;
  code: string;
  message: string;
} {
  const prismaCode = error.code || 'P0000';

  switch (prismaCode) {
    // Unique constraint violations
    case 'P2002':
      return {
        statusCode: 409,
        code: 'DUPLICATE_ENTRY',
        message: `Unique constraint violation: ${error.meta?.target || 'unknown field'}`,
      };

    // Foreign key constraint violations
    case 'P2003':
      return {
        statusCode: 409,
        code: 'FOREIGN_KEY_VIOLATION',
        message: `Foreign key constraint violation: ${error.meta?.field_name || 'unknown field'}`,
      };

    // Record not found
    case 'P2001':
    case 'P2025':
      return {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Record not found',
      };

    // Required field missing
    case 'P2011':
      return {
        statusCode: 400,
        code: 'NULL_VIOLATION',
        message: `Required field missing: ${error.meta?.constraint || 'unknown field'}`,
      };

    // Invalid data
    case 'P2006':
    case 'P2007':
      return {
        statusCode: 400,
        code: 'INVALID_DATA',
        message: `Invalid data provided: ${error.message}`,
      };

    // Connection/timeout errors
    case 'P1001':
    case 'P1002':
    case 'P1008':
    case 'P2024':
      return {
        statusCode: 503,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is temporarily unavailable',
      };

    // Default case
    default:
      return {
        statusCode: 500,
        code: 'DATABASE_ERROR',
        message: 'Database operation failed',
      };
  }
}

/**
 * Register global error handler with Fastify instance
 */
export async function registerErrorHandler(fastify: FastifyInstance): Promise<void> {
  // Set error handler
  fastify.setErrorHandler((error, request, reply) => {
    handleError(error, request, reply);
  });

  // Set not found handler
  fastify.setNotFoundHandler((request, reply) => {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
        statusCode: 404,
      },
    };
    reply.status(404).send(response);
  });
}
