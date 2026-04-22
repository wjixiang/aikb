import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async () => {
    const runtime = fastify.agentRuntime;
    const stats = await runtime.getStats();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      runtime: stats,
    };
  });
};
