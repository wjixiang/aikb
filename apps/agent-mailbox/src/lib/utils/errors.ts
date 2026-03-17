/**
 * Custom error classes for the mailbox system
 */

import { ErrorCode, type ErrorCodeType } from './response.js';

/**
 * Base application error
 */
export class AppError extends Error {
  /** Error code for programmatic handling */
  public readonly code: ErrorCodeType;
  /** HTTP status code */
  public readonly statusCode: number;
  /** Additional error details */
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCodeType = ErrorCode.INTERNAL_ERROR,
    statusCode: number = 500,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintain proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      stack: this.stack,
    };
  }
}

/**
 * Validation error - invalid input data
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, details);
  }
}

/**
 * Not found error - resource does not exist
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, ErrorCode.NOT_FOUND, 404);
  }
}

/**
 * Conflict error - resource already exists
 */
export class ConflictError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' already exists`
      : `${resource} already exists`;
    super(message, ErrorCode.ALREADY_EXISTS, 409);
  }
}

/**
 * Database error - database operation failed
 */
export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(
      message,
      ErrorCode.DATABASE_ERROR,
      500,
      originalError ? { originalError: originalError.message } : undefined,
    );
  }
}

/**
 * Unauthorized error - authentication required
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, ErrorCode.UNAUTHORIZED, 401);
  }
}

/**
 * Forbidden error - permission denied
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Permission denied') {
    super(message, ErrorCode.FORBIDDEN, 403);
  }
}

/**
 * Rate limit error - too many requests
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests', retryAfter?: number) {
    super(message, ErrorCode.RATE_LIMITED, 429, retryAfter ? { retryAfter } : undefined);
  }
}

/**
 * Service unavailable error
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, ErrorCode.SERVICE_UNAVAILABLE, 503);
  }
}

/**
 * Type guard to check if error is an AppError
 * @param error - Error to check
 * @returns True if error is AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convert unknown error to AppError
 * @param error - Unknown error
 * @returns AppError instance
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message);
  }

  return new AppError(String(error));
}

/**
 * Get error message from unknown error
 * @param error - Unknown error
 * @returns Error message string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Log error with context
 * @param error - Error to log
 * @param context - Additional context
 */
export function logError(error: unknown, context?: Record<string, unknown>): void {
  const appError = toAppError(error);
  console.error('[Error]', {
    name: appError.name,
    message: appError.message,
    code: appError.code,
    statusCode: appError.statusCode,
    ...(appError.details && { details: appError.details }),
    ...(context && { context }),
    stack: appError.stack,
  });
}
