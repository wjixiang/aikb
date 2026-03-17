/**
 * Rate Limiting Configuration Module
 *
 * Provides rate limiting configurations for different endpoints
 * and WebSocket connection tracking.
 */

import type { FastifyInstance } from 'fastify';

/**
 * Rate limit configuration interface
 */
export interface RateLimitConfig {
  /** Maximum number of requests */
  max: number;
  /** Time window in milliseconds */
  timeWindow: number;
  /** Optional key generator function */
  keyGenerator?: (req: { ip: string; headers: Record<string, unknown> }) => string;
  /** Error response body when rate limit is exceeded */
  errorResponseBuilder?: (req: unknown, context: { max: number; after: string }) => {
    statusCode: number;
    error: string;
    message: string;
    retryAfter: number;
  };
}

/**
 * Default rate limit configuration
 */
const defaultRateLimit: RateLimitConfig = {
  max: 60,
  timeWindow: 60 * 1000, // 1 minute
};

/**
 * Rate limit configurations for specific routes
 */
export const rateLimitConfig = {
  // Strict limit for sending mail (100 per minute)
  sendMail: {
    max: 100,
    timeWindow: 60 * 1000, // 1 minute
    errorResponseBuilder: (_req: unknown, context: { max: number; after: string }) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded for sending mail. Maximum ${context.max} requests per minute.`,
      retryAfter: Math.ceil(parseInt(context.after) / 1000),
    }),
  } as RateLimitConfig,

  // More lenient limit for inbox queries (300 per minute)
  getInbox: {
    max: 300,
    timeWindow: 60 * 1000, // 1 minute
    errorResponseBuilder: (_req: unknown, context: { max: number; after: string }) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded for inbox queries. Maximum ${context.max} requests per minute.`,
      retryAfter: Math.ceil(parseInt(context.after) / 1000),
    }),
  } as RateLimitConfig,

  // Default for other mail operations
  default: defaultRateLimit,

  // Strict limit for address registration (10 per minute)
  registerAddress: {
    max: 10,
    timeWindow: 60 * 1000, // 1 minute
    errorResponseBuilder: (_req: unknown, context: { max: number; after: string }) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded for address registration. Maximum ${context.max} requests per minute.`,
      retryAfter: Math.ceil(parseInt(context.after) / 1000),
    }),
  } as RateLimitConfig,

  // Limit for search operations (50 per minute)
  search: {
    max: 50,
    timeWindow: 60 * 1000, // 1 minute
    errorResponseBuilder: (_req: unknown, context: { max: number; after: string }) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded for search. Maximum ${context.max} requests per minute.`,
      retryAfter: Math.ceil(parseInt(context.after) / 1000),
    }),
  } as RateLimitConfig,
};

/**
 * WebSocket connection tracker for limiting connections per IP
 */
export class WebSocketConnectionTracker {
  private connections: Map<string, Set<string>> = new Map();
  private maxConnectionsPerIp: number;

  constructor(maxConnectionsPerIp: number = 10) {
    this.maxConnectionsPerIp = maxConnectionsPerIp;
  }

  /**
   * Check if an IP can establish a new connection
   */
  canConnect(ip: string): boolean {
    const existingConnections = this.connections.get(ip);
    if (!existingConnections) {
      return true;
    }
    return existingConnections.size < this.maxConnectionsPerIp;
  }

  /**
   * Add a new connection
   */
  addConnection(ip: string, connectionId: string): boolean {
    if (!this.canConnect(ip)) {
      return false;
    }

    if (!this.connections.has(ip)) {
      this.connections.set(ip, new Set());
    }

    this.connections.get(ip)!.add(connectionId);
    return true;
  }

  /**
   * Remove a connection
   */
  removeConnection(ip: string, connectionId: string): void {
    const existingConnections = this.connections.get(ip);
    if (existingConnections) {
      existingConnections.delete(connectionId);
      if (existingConnections.size === 0) {
        this.connections.delete(ip);
      }
    }
  }

  /**
   * Get the number of connections for an IP
   */
  getConnectionCount(ip: string): number {
    return this.connections.get(ip)?.size ?? 0;
  }

  /**
   * Get all tracked IPs
   */
  getTrackedIps(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Clear all connections (useful for testing)
   */
  clear(): void {
    this.connections.clear();
  }

  /**
   * Set max connections per IP
   */
  setMaxConnections(max: number): void {
    this.maxConnectionsPerIp = max;
  }
}

// Global WebSocket connection tracker instance
export const websocketConnectionTracker = new WebSocketConnectionTracker(10);

/**
 * Generate a unique connection ID
 */
export function generateConnectionId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Register rate limit headers hook
 * Adds X-RateLimit headers to responses
 */
export async function registerRateLimitHeaders(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onSend', async (request, reply, payload) => {
    // Check if rate limit information is available in the request
    const rateLimitInfo = (request as unknown as Record<string, unknown>).rateLimit;

    if (rateLimitInfo && typeof rateLimitInfo === 'object') {
      const info = rateLimitInfo as {
        limit?: number;
        remaining?: number;
        reset?: number;
      };

      if (info.limit !== undefined) {
        reply.header('X-RateLimit-Limit', String(info.limit));
      }
      if (info.remaining !== undefined) {
        reply.header('X-RateLimit-Remaining', String(info.remaining));
      }
      if (info.reset !== undefined) {
        reply.header('X-RateLimit-Reset', String(info.reset));
      }
    }

    return payload;
  });
}
