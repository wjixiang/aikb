/**
 * Utility functions for agent-mailbox
 */

// Date utilities
export {
  formatISO,
  formatDateTime,
  formatDate,
  nowISO,
  now,
  parseISO,
  isValidDate,
  addMilliseconds,
  addSeconds,
  addMinutes,
  addHours,
  addDays,
  differenceInMilliseconds,
  differenceInSeconds,
  differenceInMinutes,
} from './date.js';

// Pagination utilities
export {
  type PaginationParams,
  type PaginationMeta,
  type PaginatedResponse,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  normalizePagination,
  createPaginationMeta,
  createPaginatedResponse,
  paginateArray,
  calculateSkip,
  createCursorParams,
} from './pagination.js';

// Response utilities
export {
  type ApiResponse,
  type SuccessResponseOptions,
  type ErrorResponseOptions,
  type ErrorCodeType,
  createSuccessResponse,
  createErrorResponse,
  sendSuccess,
  sendError,
  HttpStatus,
  ErrorCode,
  getHttpStatusForErrorCode,
  sendValidationError,
  sendNotFoundError,
  sendDatabaseError,
} from './response.js';

// Error classes
export {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
  ServiceUnavailableError,
  isAppError,
  toAppError,
  getErrorMessage,
  logError,
} from './errors.js';
