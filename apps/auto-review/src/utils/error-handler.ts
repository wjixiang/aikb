import type { FastifyRequest, FastifyReply } from 'fastify';
import { ValidationError, HttpError, BadRequestError, NotFoundError, InternalServerError } from './validation.js';

/**
 * Error response formatter
 */
export function formatErrorResponse(error: Error | HttpError | ValidationError) {
  if (error instanceof ValidationError) {
    return {
      success: false,
      error: 'Validation failed',
      details: error.details,
    };
  }

  if (error instanceof HttpError) {
    return {
      success: false,
      error: error.message,
      details: error.details,
    };
  }

  return {
    success: false,
    error: 'Internal server error',
  };
}

/**
 * Get HTTP status code from error
 */
export function getErrorStatusCode(error: Error | HttpError | ValidationError): number {
  if (error instanceof ValidationError) {
    return 400;
  }

  if (error instanceof HttpError) {
    return error.statusCode;
  }

  return 500;
}

/**
 * Global error handler for Fastify
 */
export async function errorHandler(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  request.log.error(error);

  const statusCode = getErrorStatusCode(error);
  const response = formatErrorResponse(error);

  reply.status(statusCode).send(response);
}
