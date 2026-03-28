/**
 * AgentRuntime Plugin for Fastify
 */

import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyInstance } from 'fastify';
import {
  createAgentRuntime,
  type IAgentRuntime,
  type AgentRuntimeConfig,
  type AgentEventPayload,
} from 'agent-lib/core';
import { loadConfig, validateConfig } from '../config.js';

export interface AgentRuntimePluginOptions {
  runtimeConfig: AgentRuntimeConfig;
  serverId: string;
  port: number;
}

const agentRuntimePluginFunc = async (
  fastify: any,
  options: AgentRuntimePluginOptions,
): Promise<void> => {
  const { runtimeConfig, serverId, port } = options;

  validateConfig(loadConfig());

  const runtime = createAgentRuntime(runtimeConfig);

  runtime.on('agent:created', (event: { payload: AgentEventPayload }) => {
    fastify.log.debug(
      { event: 'agent:created', instanceId: event.payload.instanceId },
      'Agent created',
    );
  });

  runtime.on('agent:started', (event: { payload: AgentEventPayload }) => {
    fastify.log.info(
      { event: 'agent:started', instanceId: event.payload.instanceId },
      'Agent started',
    );
  });

  runtime.on('agent:stopped', (event: { payload: AgentEventPayload }) => {
    fastify.log.info(
      { event: 'agent:stopped', instanceId: event.payload.instanceId },
      'Agent stopped',
    );
  });

  runtime.on('agent:destroyed', (event: { payload: AgentEventPayload }) => {
    fastify.log.info(
      { event: 'agent:destroyed', instanceId: event.payload.instanceId },
      'Agent destroyed',
    );
  });

  runtime.on('agent:error', (event: { payload: AgentEventPayload }) => {
    fastify.log.error(
      {
        event: 'agent:error',
        instanceId: event.payload.instanceId,
        error: event.payload.error,
      },
      'Agent error',
    );
  });

  runtime.on('agent:idle', (event: { payload: AgentEventPayload }) => {
    fastify.log.debug(
      { event: 'agent:idle', instanceId: event.payload.instanceId },
      'Agent idle',
    );
  });

  await runtime.start();
  fastify.log.info(
    {
      serverId,
      messageBus: runtimeConfig.messageBus?.mode || 'memory',
    },
    'AgentRuntime started',
  );

  fastify.decorate('agentRuntime', runtime);
  fastify.decorate('serverId', serverId);
  fastify.decorate('serverPort', port);

  fastify.addHook('onClose', async (instance: any) => {
    instance.log.info('Stopping AgentRuntime...');
    await runtime.stop();
    instance.log.info('AgentRuntime stopped');
  });
};

export const agentRuntimePlugin = fp(
  agentRuntimePluginFunc,
) as unknown as FastifyPluginAsync<AgentRuntimePluginOptions>;

declare module 'fastify' {
  interface FastifyInstance {
    agentRuntime: IAgentRuntime;
    serverId: string;
    serverPort: number;
  }
}
