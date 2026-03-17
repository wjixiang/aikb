/**
 * Error handling module exports
 */

export {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  DatabaseError,
  StorageError,
  BadRequestError,
  RateLimitError,
} from './AppError.js';

export {
  handleError,
  registerErrorHandler,
  convertZodError,
  type ErrorResponse,
} from './errorHandler.js';
