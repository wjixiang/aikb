import type { FastifyPluginAsync } from 'fastify';

export const eventRoutes: FastifyPluginAsync = async (fastify) => {
  const runtime = fastify.agentRuntime;
  const eventStream = runtime.getEventStream();

  fastify.get('/events', async (request, reply) => {
    const query = request.query as { instanceId?: string };

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const unsubscribe = query.instanceId
      ? eventStream.subscribe(query.instanceId, (event) => {
          reply.raw.write(
            `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
          );
        })
      : eventStream.subscribeAll((event) => {
          reply.raw.write(
            `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
          );
        });

    request.raw.on('close', () => {
      unsubscribe();
    });

    reply.hijack();
  });
};
