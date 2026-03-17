import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getMetrics, getMetricsContentType } from '../lib/metrics/index.js';
import { createLogger } from '../lib/logger.js';

declare module 'fastify' {
  interface FastifyInstance {
    mailStorage: {
      isHealthy?: () => Promise<boolean>;
    };
  }
}

/**
 * Metrics and Health Router Plugin
 * Provides Prometheus metrics and detailed health check endpoints
 */
const metricsRouterPlugin: FastifyPluginAsync = async (
  fastify: FastifyInstance,
) => {
  const logger = createLogger(undefined, { component: 'metrics-router' });

  // ==================== Prometheus Metrics Endpoint ====================

  /**
   * GET /api/v1/metrics
   * Prometheus metrics endpoint for scraping
   */
  fastify.get('/api/v1/metrics', {
    schema: {
      description: 'Prometheus metrics endpoint',
      tags: ['metrics'],
      response: {
        200: {
          type: 'string',
          description: 'Prometheus metrics in text format',
        },
      },
    },
  }, async (request, reply) => {
    const requestLogger = createLogger(request);
    const startTime = Date.now();

    try {
      const metrics = await getMetrics();

      reply.header('Content-Type', getMetricsContentType());

      requestLogger.info('Metrics endpoint called', {
        durationMs: Date.now() - startTime,
      });

      return metrics;
    } catch (error) {
      requestLogger.error(
        'Failed to generate metrics',
        error instanceof Error ? error : undefined,
      );
      reply.status(500);
      return 'Error generating metrics';
    }
  });

  // ==================== Detailed Health Check ====================

  /**
   * GET /api/v1/health/detailed
   * Detailed health check including database connection status
   */
  fastify.get('/api/v1/health/detailed', {
    schema: {
      description: 'Detailed health check with database status',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            version: { type: 'string' },
            checks: {
              type: 'object',
              properties: {
                database: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    responseTimeMs: { type: 'number' },
                  },
                },
                memory: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    usedMB: { type: 'number' },
                    totalMB: { type: 'number' },
                    percentage: { type: 'number' },
                  },
                },
                uptime: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    seconds: { type: 'number' },
                  },
                },
              },
            },
          },
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            version: { type: 'string' },
            checks: { type: 'object' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const requestLogger = createLogger(request);
    const startTime = Date.now();
    const checks: Record<string, unknown> = {};
    let overallStatus = 'healthy';

    // Check database connection
    const dbCheckStart = Date.now();
    try {
      // Try to access mailStorage to verify DB connection
      let dbHealthy = false;
      let dbStatus: string;
      if (fastify.mailStorage) {
        // If storage has a health check method, use it
        if (typeof fastify.mailStorage.isHealthy === 'function') {
          dbHealthy = await fastify.mailStorage.isHealthy();
          dbStatus = dbHealthy ? 'healthy' : 'unhealthy';
        } else {
          // Assume healthy if storage is decorated
          dbHealthy = true;
          dbStatus = 'healthy';
        }
      } else {
        // No storage configured - mark as unknown but not unhealthy
        dbStatus = 'unknown';
        dbHealthy = true; // Don't fail overall health for missing storage in test
      }

      checks.database = {
        status: dbStatus,
        responseTimeMs: Date.now() - dbCheckStart,
      };

      if (dbStatus === 'unhealthy') {
        overallStatus = 'unhealthy';
      }
    } catch (error) {
      checks.database = {
        status: 'unhealthy',
        responseTimeMs: Date.now() - dbCheckStart,
        error: error instanceof Error ? error.message : String(error),
      };
      overallStatus = 'unhealthy';
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const percentage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

    checks.memory = {
      status: percentage > 90 ? 'warning' : 'healthy',
      usedMB,
      totalMB,
      percentage,
    };

    if (percentage > 95) {
      overallStatus = 'unhealthy';
    } else if (percentage > 90 && overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }

    // Check uptime
    checks.uptime = {
      status: 'healthy',
      seconds: Math.round(process.uptime()),
    };

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      checks,
    };

    requestLogger.info('Health check completed', {
      status: overallStatus,
      durationMs: Date.now() - startTime,
    });

    // Return 503 if unhealthy
    if (overallStatus === 'unhealthy') {
      reply.status(503);
    }

    return response;
  });

  // ==================== Readiness Check ====================

  /**
   * GET /api/v1/health/ready
   * Kubernetes-style readiness probe
   */
  fastify.get('/api/v1/health/ready', {
    schema: {
      description: 'Readiness probe for Kubernetes',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            ready: { type: 'boolean' },
          },
        },
        503: {
          type: 'object',
          properties: {
            ready: { type: 'boolean' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const requestLogger = createLogger(request);

    try {
      // Check if storage is available
      const isReady = !!fastify.mailStorage;

      if (isReady) {
        requestLogger.debug('Readiness check passed');
        return { ready: true };
      } else {
        requestLogger.warn('Readiness check failed - storage not available');
        reply.status(503);
        return { ready: false };
      }
    } catch (error) {
      requestLogger.error(
        'Readiness check failed',
        error instanceof Error ? error : undefined,
      );
      reply.status(503);
      return { ready: false };
    }
  });

  // ==================== Liveness Check ====================

  /**
   * GET /api/v1/health/live
   * Kubernetes-style liveness probe
   */
  fastify.get('/api/v1/health/live', {
    schema: {
      description: 'Liveness probe for Kubernetes',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            alive: { type: 'boolean' },
          },
        },
      },
    },
  }, async (request) => {
    const requestLogger = createLogger(request);
    requestLogger.debug('Liveness check passed');
    return { alive: true };
  });

  logger.info('Metrics and health router registered');
};

export default metricsRouterPlugin;
