/**
 * SSE adapter for AgentEventStream.
 *
 * Bridges the AgentEventStream to Server-Sent Events over HTTP,
 * providing real-time agent events to the frontend.
 */

import type { FastifyReply } from 'fastify';
import type { IAgentRuntime } from 'agent-lib/core';

const SWARM_RUNTIME_URL = process.env['SWARM_RUNTIME_URL'] || 'http://localhost:4000';

interface StreamOptions {
  runtime: IAgentRuntime;
  agentId: string;
  /** The fully enriched message (context already applied) */
  message: string;
  reply: FastifyReply;
}

/**
 * Stream agent events as SSE while concurrently processing the query.
 *
 * Wire format (backward compatible):
 *   event: started          { ts }
 *   event: agent.status    { status }
 *   event: message.added    { role, content, ts }
 *   event: tool.started     { toolName, params }
 *   event: tool.completed   { toolName, result, success, duration }
 *   event: llm.completed    { promptTokens, completionTokens }
 *   event: error            { message }
 *   event: completed        { data, ts }
 */
export async function streamAgentEvents(options: StreamOptions): Promise<void> {
  const { agentId, message, reply } = options;

  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no');
  reply.raw.flushHeaders();

  const send = (event: string, data: unknown) => {
    try {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      // Client disconnected
    }
  };

  // Backward compatible: send 'started' immediately
  send('started', { ts: Date.now() });

  // Send HTTP inject request in parallel with event streaming
  const injectPromise = fetch(`${SWARM_RUNTIME_URL}/api/agents/${agentId}/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
    .then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Inject failed: ${response.status} ${errorText}`);
      }
      const result = await response.json();
      send('completed', { data: result, ts: Date.now() });
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : 'Failed to get response from agent';
      send('error', { message: msg, ts: Date.now() });
    });

  await injectPromise;

  try {
    reply.raw.end();
  } catch {
    // Client may have already disconnected
  }
}

/**
 * Stream agent events as SSE while concurrently processing the query.
 *
 * Wire format (backward compatible):
 *   event: started          { ts }
 *   event: agent.status     { status }
 *   event: message.added    { role, content, ts }
 *   event: tool.started     { toolName, params }
 *   event: tool.completed   { toolName, result, success, duration }
 *   event: llm.completed    { promptTokens, completionTokens }
 *   event: error            { message }
 *   event: completed        { data, ts }
 */
export async function streamAgentEvents(options: StreamOptions): Promise<void> {
  const { runtime, agentId, message, reply } = options;

  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no');
  reply.raw.flushHeaders();

  const send = (event: string, data: unknown) => {
    try {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      // Client disconnected
    }
  };

  const abortController = new AbortController();

  // Backward compatible: send 'started' immediately
  send('started', { ts: Date.now() });

  // Get event stream
  const eventStream = runtime.getEventStream();
  const iterable = eventStream.createIterable(agentId, {
    signal: abortController.signal,
  });

  // Send A2A query in parallel with event streaming
  const client = runtime.getRuntimeClient('bib-max-server');
  const queryPromise = client
    .sendA2AQuery(agentId, message, { timeout: 60000 })
    .then((result) => {
      send('completed', { data: result, ts: Date.now() });
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : 'Failed to get response from agent';
      send('error', { message: msg, ts: Date.now() });
    })
    .finally(() => {
      abortController.abort();
    });

  // Forward events from the iterable
  try {
    for await (const event of iterable) {
      send(event.type, event.data);
    }
  } catch {
    // Aborted or stream ended — expected when query completes
  }

  await queryPromise;

  try {
    reply.raw.end();
  } catch {
    // Client may have already disconnected
  }
}
