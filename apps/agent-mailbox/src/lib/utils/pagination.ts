/**
 * Pagination utilities
 */

/**
 * Pagination parameters
 */
export interface PaginationParams {
  /** Page number (1-based) */
  page?: number;
  /** Number of items per page */
  limit?: number;
  /** Number of items to skip */
  offset?: number;
}

/**
 * Pagination result metadata
 */
export interface PaginationMeta {
  /** Current page number */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNext: boolean;
  /** Whether there is a previous page */
  hasPrev: boolean;
  /** Offset for the current page */
  offset: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  /** List of items */
  data: T[];
  /** Pagination metadata */
  meta: PaginationMeta;
}

/**
 * Default pagination values
 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Normalize pagination parameters
 * @param params - Raw pagination parameters
 * @returns Normalized parameters
 */
export function normalizePagination(params: PaginationParams): { page: number; limit: number; offset: number } {
  let page = params.page ?? DEFAULT_PAGE;
  let limit = params.limit ?? DEFAULT_LIMIT;

  // Ensure positive values
  page = Math.max(1, page);
  limit = Math.max(1, Math.min(limit, MAX_LIMIT));

  // Calculate offset from page if not provided
  const offset = params.offset ?? (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Create pagination metadata
 * @param total - Total number of items
 * @param params - Pagination parameters
 * @returns Pagination metadata
 */
export function createPaginationMeta(total: number, params: PaginationParams): PaginationMeta {
  const { page, limit, offset } = normalizePagination(params);
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
    offset,
  };
}

/**
 * Create a paginated response
 * @param data - List of items
 * @param total - Total number of items
 * @param params - Pagination parameters
 * @returns Paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams,
): PaginatedResponse<T> {
  return {
    data,
    meta: createPaginationMeta(total, params),
  };
}

/**
 * Slice array based on pagination parameters
 * @param array - Array to paginate
 * @param params - Pagination parameters
 * @returns Sliced array
 */
export function paginateArray<T>(array: T[], params: PaginationParams): T[] {
  const { offset, limit } = normalizePagination(params);
  return array.slice(offset, offset + limit);
}

/**
 * Calculate skip value for database queries
 * @param page - Page number (1-based)
 * @param limit - Items per page
 * @returns Skip value
 */
export function calculateSkip(page: number, limit: number): number {
  return (Math.max(1, page) - 1) * Math.max(1, limit);
}

/**
 * Create cursor-based pagination parameters
 * @param cursor - Cursor string
 * @param limit - Items per page
 * @returns Cursor pagination params
 */
export function createCursorParams(cursor?: string, limit: number = DEFAULT_LIMIT): {
  cursor?: string;
  limit: number;
} {
  return {
    cursor,
    limit: Math.min(Math.max(1, limit), MAX_LIMIT),
  };
}
