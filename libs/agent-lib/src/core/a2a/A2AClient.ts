/**
 * A2A Client - Client for sending A2A messages to other agents
 *
 * Wraps the Topology MessageBus to provide high-level A2A communication.
 */

import { getLogger } from '@shared/logger';
import type { IMessageBus } from '../runtime/topology/messaging/MessageBus.js';
import { createMessage } from '../runtime/topology/types.js';
import type {
  A2AMessage,
  A2AMessageType,
  A2APayload,
  A2AClientConfig,
  A2ATaskStatus,
} from './types.js';
import {
  createA2AMessage,
  createA2AQueryMessage,
  createA2AResponseMessage,
  createA2AEventMessage,
} from './types.js';
import type { AgentCardRegistry, IAgentCardRegistry } from './AgentCard.js';

export interface IA2AClient {
  /**
   * Send a query to another agent and wait for response.
   * When ackOnly is true, returns conversationId immediately after ACK.
   */
  sendQuery(
    targetAgentId: string,
    query: string,
    options?: {
      expectedFormat?: string;
      input?: Record<string, unknown>;
      description?: string;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      ackOnly?: boolean;
    },
  ): Promise<unknown>;

  /** Send a response to a previous message */
  sendResponse(
    targetAgentId: string,
    output: unknown,
    status: A2ATaskStatus,
    options?: {
      conversationId?: string;
      referenceId?: string;
      taskId?: string;
      error?: string;
    },
  ): Promise<void>;

  /** Send an event notification to another agent */
  sendEvent(
    targetAgentId: string,
    eventType: string,
    data: unknown,
  ): Promise<void>;

  /** Send a cancel message for a query */
  sendCancel(
    targetAgentId: string,
    conversationId: string,
  ): Promise<void>;

  /** Wait for result of a previously sent query (by conversationId) */
  waitForResult(conversationId: string): Promise<{
    status: A2ATaskStatus;
    output?: unknown;
    error?: string;
    taskId?: string;
  }>;

  /** Get the client instance ID */
  getInstanceId(): string;
}

/**
 * A2A Client implementation
 *
 * Provides high-level A2A communication by wrapping the Topology MessageBus.
 * Handles message serialization, correlation, and response tracking.
 */
export class A2AClient implements IA2AClient {
  private readonly logger = getLogger('A2AClient');
  private readonly instanceId: string;
  private readonly messageBus: IMessageBus;
  private readonly agentRegistry: IAgentCardRegistry;

  constructor(
    messageBus: IMessageBus,
    agentRegistry: IAgentCardRegistry,
    config: A2AClientConfig,
  ) {
    this.instanceId = config.instanceId;
    this.messageBus = messageBus;
    this.agentRegistry = agentRegistry;
  }

  /**
   * Send a query to another agent.
   * By default waits for the full result. Set ackOnly to return after ACK only.
   */
  async sendQuery(
    targetAgentId: string,
    query: string,
    options?: {
      expectedFormat?: string;
      input?: Record<string, unknown>;
      description?: string;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      ackOnly?: boolean;
    },
  ): Promise<unknown> {
    this.logger.info({ targetAgentId, query, ackOnly: options?.ackOnly }, 'Sending query to agent');

    const resolvedId = this.agentRegistry.resolveAgentId(targetAgentId);
    if (!resolvedId) {
      const availableAgents = this.agentRegistry
        .getAllAgents()
        .map(
          (a) =>
            `${a.name} (${a.instanceId}${a.alias ? `, alias: ${a.alias}` : ''})`,
        )
        .join(', ');

      this.logger.error(
        { targetAgentId, availableAgents: availableAgents || 'none' },
        'Target agent not found in registry',
      );

      throw new Error(
        `Target agent not found: ${targetAgentId}. Available agents: ${availableAgents || 'none'}`,
      );
    }

    const a2aMessage = createA2AQueryMessage(
      this.instanceId,
      resolvedId,
      query,
      options,
    );

    const topologyMessage = this.convertToTopologyMessage(a2aMessage);

    try {
      const ack = await this.messageBus.send(topologyMessage);
      this.logger.debug({ ack: ack.messageId }, 'Received ACK for query');

      if (options?.ackOnly) {
        this.logger.info(
          { conversationId: a2aMessage.conversationId },
          'ACK-only mode, returning conversationId',
        );
        return a2aMessage.conversationId;
      }

      // Wait for result
      const result = await this.waitForResult(a2aMessage.conversationId);

      if (result.status === 'failed') {
        throw new Error(result.error ?? 'Query failed');
      }

      return result.output;
    } catch (error) {
      this.logger.error(
        { error, targetAgentId, query },
        'Failed to send query',
      );
      throw error;
    }
  }

  /**
   * Send a response to a previous message
   */
  async sendResponse(
    targetAgentId: string,
    output: unknown,
    status: A2ATaskStatus,
    options?: {
      conversationId?: string;
      referenceId?: string;
      taskId?: string;
      error?: string;
    },
  ): Promise<void> {
    this.logger.info(
      { targetAgentId, status, taskId: options?.taskId },
      'Sending response to agent',
    );

    const resolvedId =
      this.agentRegistry.resolveAgentId(targetAgentId) ?? targetAgentId;

    const a2aMessage = createA2AResponseMessage(
      this.instanceId,
      resolvedId,
      output,
      status,
      options,
    );

    // Convert to Topology message and send (fire-and-forget for responses)
    const topologyMessage = this.convertToTopologyMessage(a2aMessage);
    this.messageBus.publish(topologyMessage);
  }

  /**
   * Send an event notification to another agent
   */
  async sendEvent(
    targetAgentId: string,
    eventType: string,
    data: unknown,
  ): Promise<void> {
    this.logger.info({ targetAgentId, eventType }, 'Sending event to agent');

    const resolvedId = this.agentRegistry.resolveAgentId(targetAgentId);
    if (!resolvedId) {
      throw new Error(`Target agent not found: ${targetAgentId}`);
    }

    const a2aMessage = createA2AEventMessage(
      this.instanceId,
      resolvedId,
      eventType,
      data,
    );

    // Convert to Topology message and send (fire-and-forget)
    const topologyMessage = this.convertToTopologyMessage(a2aMessage);
    this.messageBus.publish(topologyMessage);
  }

  /**
   * Send a cancel message for a query
   */
  async sendCancel(
    targetAgentId: string,
    conversationId: string,
  ): Promise<void> {
    this.logger.info(
      { targetAgentId, conversationId },
      'Sending cancel to agent',
    );

    const resolvedId =
      this.agentRegistry.resolveAgentId(targetAgentId) ?? targetAgentId;

    const payload: A2APayload = {
      status: 'cancelled',
    };

    const a2aMessage = createA2AMessage(
      this.instanceId,
      resolvedId,
      'cancel',
      payload,
      { conversationId },
    );

    const topologyMessage = this.convertToTopologyMessage(a2aMessage);
    this.messageBus.publish(topologyMessage);
  }

  /**
   * Get the client instance ID
   */
  getInstanceId(): string {
    return this.instanceId;
  }

  /**
   * Convert A2A message to Topology message
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private convertToTopologyMessage(a2aMessage: any) {
    return createMessage(
      a2aMessage.from,
      a2aMessage.to,
      a2aMessage,
      'request',
      { conversationId: a2aMessage.conversationId },
    );
  }

  /**
   * Wait for result message in a conversation (event-driven)
   */
  async waitForResult(
    conversationId: string,
  ): Promise<{
    status: A2ATaskStatus;
    output?: unknown;
    error?: string;
    taskId?: string;
  }> {
    const rawResult = await new Promise<unknown>((resolve, reject) => {
      const handleEvent = (event: { type: string; payload: unknown }) => {
        const payload = event.payload as {
          conversationId?: string;
          result?: unknown;
          error?: string;
        };

        if (payload.conversationId !== conversationId) {
          return;
        }

        if (event.type === 'conversation:completed') {
          unsubscribe();
          resolve(payload.result);
        } else if (
          event.type === 'conversation:failed' ||
          event.type === 'conversation:timeout'
        ) {
          unsubscribe();
          reject(
            new Error(
              `Conversation ${event.type}: ${payload.error || conversationId}`,
            ),
          );
        }
      };

      const unsubscribe = this.messageBus.onEvent(handleEvent);

      const conversation = this.messageBus.getConversation(conversationId);
      if (conversation?.status === 'completed' && conversation.result) {
        unsubscribe();
        resolve(conversation.result);
      } else if (
        conversation?.status === 'failed' ||
        conversation?.status === 'timeout'
      ) {
        unsubscribe();
        reject(
          new Error(`Conversation ${conversation.status}: ${conversationId}`),
        );
      }
    });

    const topologyMsg = rawResult as {
      content?: { content?: A2APayload };
    };
    const maybePayload = topologyMsg.content?.content ?? topologyMsg.content;
    const a2aPayload =
      (maybePayload as A2APayload) ?? (rawResult as A2APayload);
    return {
      taskId: a2aPayload.taskId,
      status: a2aPayload.status ?? 'failed',
      output: a2aPayload.output,
      error: a2aPayload.error,
    };
  }
}

/**
 * Create an A2A Client instance
 */
export function createA2AClient(
  messageBus: IMessageBus,
  agentRegistry: IAgentCardRegistry,
  config: A2AClientConfig,
): A2AClient {
  return new A2AClient(messageBus, agentRegistry, config);
}
