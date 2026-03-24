/**
 * A2A Client - Client for sending A2A messages to other agents
 *
 * Wraps the Topology MessageBus to provide high-level A2A communication.
 */

import pino from 'pino';
import type { IMessageBus } from '../runtime/topology/messaging/MessageBus.js';
import { createMessage } from '../runtime/topology/types.js';
import type {
  A2AMessage,
  A2AMessageType,
  A2APayload,
  A2ATaskResult,
  A2AClientConfig,
  A2ATaskStatus,
} from './types.js';
import {
  createA2AMessage,
  createA2ATaskMessage,
  createA2AQueryMessage,
  createA2AResponseMessage,
  createA2AEventMessage,
  createConversationId,
} from './types.js';
import type { AgentCardRegistry, IAgentCardRegistry } from './AgentCard.js';

export interface IA2AClient {
  /** Send a task to another agent and wait for result */
  sendTask(
    targetAgentId: string,
    taskId: string,
    description: string,
    input: Record<string, unknown>,
    options?: { priority?: 'low' | 'normal' | 'high' | 'urgent' },
  ): Promise<A2ATaskResult>;

  /** Send a query to another agent and wait for response */
  sendQuery(
    targetAgentId: string,
    query: string,
    options?: { expectedFormat?: string },
  ): Promise<unknown>;

  /** Send a response to a previous message */
  sendResponse(
    targetAgentId: string,
    output: unknown,
    status: A2ATaskStatus,
    options?: { conversationId?: string; referenceId?: string; taskId?: string; error?: string },
  ): Promise<void>;

  /** Send an event notification to another agent */
  sendEvent(targetAgentId: string, eventType: string, data: unknown): Promise<void>;

  /** Send a cancel message for a task */
  sendCancel(targetAgentId: string, taskId: string, conversationId: string): Promise<void>;

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
  private readonly logger: pino.Logger;
  private readonly instanceId: string;
  private readonly messageBus: IMessageBus;
  private readonly agentRegistry: IAgentCardRegistry;
  private readonly defaultTimeout: number;
  private readonly retryConfig?: { maxAttempts: number; backoffMs: number };

  constructor(
    messageBus: IMessageBus,
    agentRegistry: IAgentCardRegistry,
    config: A2AClientConfig,
  ) {
    this.logger = pino({
      level: 'debug',
      timestamp: pino.stdTimeFunctions.isoTime,
    });
    this.instanceId = config.instanceId;
    this.messageBus = messageBus;
    this.agentRegistry = agentRegistry;
    this.defaultTimeout = config.defaultTimeout ?? 60000;
    this.retryConfig = config.retry;
  }

  /**
   * Send a task to another agent and wait for result
   */
  async sendTask(
    targetAgentId: string,
    taskId: string,
    description: string,
    input: Record<string, unknown>,
    options?: { priority?: 'low' | 'normal' | 'high' | 'urgent' },
  ): Promise<A2ATaskResult> {
    this.logger.info(
      { targetAgentId, taskId, description },
      'Sending task to agent',
    );

    // Create A2A task message
    const a2aMessage = createA2ATaskMessage(
      this.instanceId,
      targetAgentId,
      taskId,
      description,
      input,
      options,
    );

    // Convert to Topology message and send
    const topologyMessage = this.convertToTopologyMessage(a2aMessage);

    // Use retry config or defaults
    const maxAttempts = this.retryConfig?.maxAttempts ?? 3;
    const backoffMs = this.retryConfig?.backoffMs ?? 1000;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Send via MessageBus and wait for result
        const ack = await this.messageBus.send(topologyMessage);

        this.logger.debug({ ack: ack.messageId }, 'Received ACK for task');

        // Wait for result
        const result = await this.waitForResult(a2aMessage.conversationId);

        return this.parseTaskResult(result.content as A2APayload);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if it's a timeout error and we have retries left
        const isTimeout = lastError.message.includes('Timeout');
        const hasRetries = attempt < maxAttempts;

        if (isTimeout && hasRetries) {
          this.logger.warn(
            { attempt, maxAttempts, backoffMs, error: lastError.message },
            'Task timed out, retrying with backoff',
          );
          await this.sleep(backoffMs * attempt); // Exponential backoff
          continue;
        }

        // Non-timeout error or no retries left
        this.logger.error(
          { error, targetAgentId, taskId, attempt },
          'Failed to send task',
        );
        throw error;
      }
    }

    // Should not reach here, but just in case
    throw lastError ?? new Error('Task failed after retries');
  }

  /**
   * Send a query to another agent and wait for response
   */
  async sendQuery(
    targetAgentId: string,
    query: string,
    options?: { expectedFormat?: string },
  ): Promise<unknown> {
    this.logger.info({ targetAgentId, query }, 'Sending query to agent');

    // Create A2A query message
    const a2aMessage = createA2AQueryMessage(
      this.instanceId,
      targetAgentId,
      query,
      options,
    );

    // Convert to Topology message and send
    const topologyMessage = this.convertToTopologyMessage(a2aMessage);

    try {
      const ack = await this.messageBus.send(topologyMessage);

      this.logger.debug({ ack: ack.messageId }, 'Received ACK for query');

      // Wait for result
      const result = await this.waitForResult(a2aMessage.conversationId);

      const payload = result.content as A2APayload;
      if (payload.status === 'failed') {
        throw new Error(payload.error ?? 'Query failed');
      }

      return payload.output;
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

    // Create A2A response message
    const a2aMessage = createA2AResponseMessage(
      this.instanceId,
      targetAgentId,
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
  async sendEvent(targetAgentId: string, eventType: string, data: unknown): Promise<void> {
    this.logger.info({ targetAgentId, eventType }, 'Sending event to agent');

    // Create A2A event message
    const a2aMessage = createA2AEventMessage(
      this.instanceId,
      targetAgentId,
      eventType,
      data,
    );

    // Convert to Topology message and send (fire-and-forget)
    const topologyMessage = this.convertToTopologyMessage(a2aMessage);
    this.messageBus.publish(topologyMessage);
  }

  /**
   * Send a cancel message for a task
   */
  async sendCancel(targetAgentId: string, taskId: string, conversationId: string): Promise<void> {
    this.logger.info({ targetAgentId, taskId, conversationId }, 'Sending cancel to agent');

    const payload: A2APayload = {
      taskId,
      status: 'cancelled',
    };

    const a2aMessage = createA2AMessage(
      this.instanceId,
      targetAgentId,
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
   * Wait for result message in a conversation
   */
  private async waitForResult(conversationId: string): Promise<any> {
    const startTime = Date.now();
    const timeout = this.defaultTimeout;

    while (Date.now() - startTime < timeout) {
      const conversation = this.messageBus.getConversation(conversationId);

      if (conversation?.status === 'completed' && conversation.result) {
        return conversation.result;
      }

      if (conversation?.status === 'failed' || conversation?.status === 'timeout') {
        throw new Error(`Conversation ${conversation.status}: ${conversationId}`);
      }

      // Wait a bit before checking again
      await this.sleep(100);
    }

    throw new Error(`Timeout waiting for result: ${conversationId}`);
  }

  /**
   * Parse task result from A2A payload
   */
  private parseTaskResult(payload: A2APayload): A2ATaskResult {
    return {
      taskId: payload.taskId ?? '',
      status: payload.status ?? 'failed',
      output: payload.output,
      error: payload.error,
      metadata: payload.metadata,
    };
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
