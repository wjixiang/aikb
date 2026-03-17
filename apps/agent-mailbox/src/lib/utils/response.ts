/**
 * HTTP Response formatting utilities
 */

import type { FastifyReply } from 'fastify';

/**
 * Standard API response structure
 */
export interface ApiResponse<T = unknown> {
  /** Whether the operation was successful */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error message if operation failed */
  error?: string;
  /** Error code for programmatic handling */
  errorCode?: string;
  /** Response timestamp */
  timestamp: string;
  /** Request ID for tracing */
  requestId?: string;
}

/**
 * Success response options
 */
export interface SuccessResponseOptions<T> {
  /** Response data */
  data?: T;
  /** HTTP status code */
  statusCode?: number;
  /** Request ID for tracing */
  requestId?: string;
}

/**
 * Error response options
 */
export interface ErrorResponseOptions {
  /** Error message */
  message: string;
  /** Error code for programmatic handling */
  errorCode?: string;
  /** HTTP status code */
  statusCode?: number;
  /** Request ID for tracing */
  requestId?: string;
}

/**
 * Create a success response
 * @param options - Response options
 * @returns API response object
 */
export function createSuccessResponse<T>(options: SuccessResponseOptions<T> = {}): ApiResponse<T> {
  const { data, requestId } = options;

  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    ...(requestId && { requestId }),
  };
}

/**
 * Create an error response
 * @param options - Error options
 * @returns API response object
 */
export function createErrorResponse(options: ErrorResponseOptions): ApiResponse<never> {
  const { message, errorCode, requestId } = options;

  return {
    success: false,
    error: message,
    ...(errorCode && { errorCode }),
    timestamp: new Date().toISOString(),
    ...(requestId && { requestId }),
  };
}

/**
 * Send a success response via Fastify reply
 * @param reply - Fastify reply object
 * @param options - Response options
 */
export function sendSuccess<T>(
  reply: FastifyReply,
  options: SuccessResponseOptions<T> = {},
): FastifyReply {
  const { statusCode = 200 } = options;
  const response = createSuccessResponse(options);

  return reply.status(statusCode).send(response);
}

/**
 * Send an error response via Fastify reply
 * @param reply - Fastify reply object
 * @param options - Error options
 */
export function sendError(reply: FastifyReply, options: ErrorResponseOptions): FastifyReply {
  const { statusCode = 500 } = options;
  const response = createErrorResponse(options);

  return reply.status(statusCode).send(response);
}

/**
 * Common HTTP status codes
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Common error codes
 */
export const ErrorCode = {
  // Client errors (4xx)
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',

  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

/**
 * Type for error codes
 */
export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

/**
 * Map error codes to HTTP status codes
 */
export function getHttpStatusForErrorCode(errorCode: ErrorCodeType): number {
  const mapping: Record<ErrorCodeType, number> = {
    [ErrorCode.BAD_REQUEST]: HttpStatus.BAD_REQUEST,
    [ErrorCode.VALIDATION_ERROR]: HttpStatus.BAD_REQUEST,
    [ErrorCode.NOT_FOUND]: HttpStatus.NOT_FOUND,
    [ErrorCode.ALREADY_EXISTS]: HttpStatus.CONFLICT,
    [ErrorCode.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
    [ErrorCode.FORBIDDEN]: HttpStatus.FORBIDDEN,
    [ErrorCode.RATE_LIMITED]: HttpStatus.TOO_MANY_REQUESTS,
    [ErrorCode.INTERNAL_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
    [ErrorCode.DATABASE_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
    [ErrorCode.SERVICE_UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  };

  return mapping[errorCode] ?? HttpStatus.INTERNAL_SERVER_ERROR;
}

/**
 * Create a validation error response
 * @param reply - Fastify reply object
 * @param message - Validation error message
 * @returns Fastify reply
 */
export function sendValidationError(reply: FastifyReply, message: string): FastifyReply {
  return sendError(reply, {
    message,
    errorCode: ErrorCode.VALIDATION_ERROR,
    statusCode: HttpStatus.BAD_REQUEST,
  });
}

/**
 * Create a not found error response
 * @param reply - Fastify reply object
 * @param resource - Resource name
 * @param id - Resource identifier
 * @returns Fastify reply
 */
export function sendNotFoundError(reply: FastifyReply, resource: string, id: string): FastifyReply {
  return sendError(reply, {
    message: `${resource} with id '${id}' not found`,
    errorCode: ErrorCode.NOT_FOUND,
    statusCode: HttpStatus.NOT_FOUND,
  });
}

/**
 * Create a database error response
 * @param reply - Fastify reply object
 * @param message - Error message
 * @returns Fastify reply
 */
export function sendDatabaseError(reply: FastifyReply, message: string): FastifyReply {
  return sendError(reply, {
    message,
    errorCode: ErrorCode.DATABASE_ERROR,
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  });
}
