/**
 * Base Application Error Class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON response format
   */
  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
      },
    };
  }
}

/**
 * Validation Error - 400 Bad Request
 * Used when request validation fails
 */
export class ValidationError extends AppError {
  public readonly details: Array<{ field: string; message: string }>;

  constructor(
    message: string = 'Validation failed',
    details: Array<{ field: string; message: string }> = [],
  ) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      error: {
        ...super.toJSON().error,
        details: this.details,
      },
    };
  }
}

/**
 * Not Found Error - 404 Not Found
 * Used when a requested resource is not found
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', identifier?: string) {
    const message = identifier
      ? `${resource} not found: ${identifier}`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * Conflict Error - 409 Conflict
 * Used when there's a conflict with the current state
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Conflict with current state') {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * Unauthorized Error - 401 Unauthorized
 * Used when authentication is required but not provided or invalid
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/**
 * Forbidden Error - 403 Forbidden
 * Used when the user doesn't have permission to access the resource
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * Database Error - 500 Internal Server Error
 * Used when a database operation fails
 */
export class DatabaseError extends AppError {
  public readonly originalError?: Error;

  constructor(message: string = 'Database operation failed', originalError?: Error) {
    super(message, 500, 'DATABASE_ERROR', false);
    this.originalError = originalError;
  }
}

/**
 * Storage Error - 500 Internal Server Error
 * Used when a storage operation fails
 */
export class StorageError extends AppError {
  public readonly originalError?: Error;

  constructor(message: string = 'Storage operation failed', originalError?: Error) {
    super(message, 500, 'STORAGE_ERROR', false);
    this.originalError = originalError;
  }
}

/**
 * Bad Request Error - 400 Bad Request
 * Used when the request is malformed or invalid
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request') {
    super(message, 400, 'BAD_REQUEST');
  }
}

/**
 * Rate Limit Error - 429 Too Many Requests
 * Used when rate limit is exceeded
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.retryAfter = retryAfter;
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      error: {
        ...super.toJSON().error,
        retryAfter: this.retryAfter,
      },
    };
  }
}
