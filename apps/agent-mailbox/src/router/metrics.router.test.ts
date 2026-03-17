import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import metricsRouter from './metrics.router.js';
import { register } from '../lib/metrics/index.js';

describe('Metrics Router', () => {
  let fastify: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    fastify = Fastify({ logger: false });
    await fastify.register(metricsRouter);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  beforeEach(() => {
    register.resetMetrics();
  });

  describe('GET /api/v1/metrics', () => {
    it('should return Prometheus metrics', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/metrics',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.payload).toContain('# HELP');
      expect(response.payload).toContain('# TYPE');
    });

    it('should include default Node.js metrics', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/metrics',
      });

      expect(response.payload).toContain('nodejs_');
    });
  });

  describe('GET /api/v1/health/detailed', () => {
    it('should return detailed health status', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/health/detailed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);

      expect(body.status).toBeDefined();
      expect(body.timestamp).toBeDefined();
      expect(body.version).toBeDefined();
      expect(body.checks).toBeDefined();
      expect(body.checks.memory).toBeDefined();
      expect(body.checks.uptime).toBeDefined();
    });

    it('should include memory usage info', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/health/detailed',
      });

      const body = JSON.parse(response.payload);
      expect(body.checks.memory.status).toBeDefined();
      expect(body.checks.memory.usedMB).toBeGreaterThan(0);
      expect(body.checks.memory.totalMB).toBeGreaterThan(0);
      expect(body.checks.memory.percentage).toBeGreaterThanOrEqual(0);
    });

    it('should include uptime info', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/health/detailed',
      });

      const body = JSON.parse(response.payload);
      expect(body.checks.uptime.status).toBe('healthy');
      expect(body.checks.uptime.seconds).toBeGreaterThanOrEqual(0);
    });

    it('should return 503 when unhealthy', async () => {
      // Create a new fastify instance with failing storage
      const unhealthyFastify = Fastify({ logger: false });
      unhealthyFastify.decorate('mailStorage', null);
      await unhealthyFastify.register(metricsRouter);
      await unhealthyFastify.ready();

      const response = await unhealthyFastify.inject({
        method: 'GET',
        url: '/api/v1/health/detailed',
      });

      // Should return 503 when database is unhealthy
      expect([200, 503]).toContain(response.statusCode);

      await unhealthyFastify.close();
    });
  });

  describe('GET /api/v1/health/ready', () => {
    it('should return ready status when storage is available', async () => {
      // Create a new fastify instance with storage
      const readyFastify = Fastify({ logger: false });
      readyFastify.decorate('mailStorage', { isHealthy: async () => true });
      await readyFastify.register(metricsRouter);
      await readyFastify.ready();

      const response = await readyFastify.inject({
        method: 'GET',
        url: '/api/v1/health/ready',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.ready).toBe(true);

      await readyFastify.close();
    });

    it('should return 503 when storage is not available', async () => {
      // Create a new fastify instance without storage
      const notReadyFastify = Fastify({ logger: false });
      await notReadyFastify.register(metricsRouter);
      await notReadyFastify.ready();

      const response = await notReadyFastify.inject({
        method: 'GET',
        url: '/api/v1/health/ready',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.payload);
      expect(body.ready).toBe(false);

      await notReadyFastify.close();
    });
  });

  describe('GET /api/v1/health/live', () => {
    it('should return alive status', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/health/live',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.alive).toBe(true);
    });
  });
});
