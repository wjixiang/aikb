/**
 * Conversation - Conversation management for two-phase response protocol
 *
 * Manages the lifecycle of a request-response conversation including
 * tracking ACK and result messages.
 */

import type {
  Conversation,
  ConversationStatus,
  TopologyMessage,
  MessageHandler,
} from '../types.js';
import { createConversation } from '../types.js';

export interface IConversationManager {
  create(
    request: TopologyMessage,
    config?: {
      ackTimeout?: number;
      resultTimeout?: number;
      maxRetries?: number;
    },
  ): Conversation;
  get(conversationId: string): Conversation | undefined;
  getByTaskId(taskId: string): Conversation | undefined;
  setAck(conversationId: string, ack: TopologyMessage): void;
  setResult(conversationId: string, result: TopologyMessage): void;
  updateStatus(conversationId: string, status: ConversationStatus): void;
  incrementRetry(conversationId: string): number;
  getPending(): Conversation[];
  getActive(): Conversation[];
  getAll(): Conversation[];
  remove(conversationId: string): void;
  onConversationUpdate(handler: (conversation: Conversation) => void): void;
}

export class ConversationManager implements IConversationManager {
  private conversations: Map<string, Conversation> = new Map();
  private updateHandlers: Set<(conversation: Conversation) => void> = new Set();

  create(
    request: TopologyMessage,
    config?: {
      ackTimeout?: number;
      resultTimeout?: number;
      maxRetries?: number;
    },
  ): Conversation {
    const conversation = createConversation(request, config);
    this.conversations.set(conversation.conversationId, conversation);
    return conversation;
  }

  get(conversationId: string): Conversation | undefined {
    return this.conversations.get(conversationId);
  }

  getByTaskId(taskId: string): Conversation | undefined {
    for (const conversation of this.conversations.values()) {
      const a2aContent = conversation.request.content as { taskId?: string };
      if (a2aContent?.taskId === taskId) {
        return conversation;
      }
    }
    return undefined;
  }

  setAck(conversationId: string, ack: TopologyMessage): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.ack = ack;
      conversation.status = 'acknowledged';
      this.notifyUpdate(conversation);
    }
  }

  setResult(conversationId: string, result: TopologyMessage): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.result = result;
      conversation.status = 'completed';
      this.notifyUpdate(conversation);
    }
  }

  updateStatus(conversationId: string, status: ConversationStatus): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.status = status;
      this.notifyUpdate(conversation);
    }
  }

  incrementRetry(conversationId: string): number {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.retryCount++;
      this.notifyUpdate(conversation);
      return conversation.retryCount;
    }
    return 0;
  }

  getPending(): Conversation[] {
    return Array.from(this.conversations.values()).filter(
      (c) => c.status === 'pending',
    );
  }

  getActive(): Conversation[] {
    return Array.from(this.conversations.values()).filter(
      (c) => c.status === 'pending' || c.status === 'acknowledged',
    );
  }

  getAll(): Conversation[] {
    return Array.from(this.conversations.values());
  }

  remove(conversationId: string): void {
    this.conversations.delete(conversationId);
  }

  onConversationUpdate(handler: (conversation: Conversation) => void): void {
    this.updateHandlers.add(handler);
  }

  private notifyUpdate(conversation: Conversation): void {
    for (const handler of this.updateHandlers) {
      try {
        handler(conversation);
      } catch (error) {
        console.error('[ConversationManager] Update handler error:', error);
      }
    }
  }

  cleanup(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let removed = 0;

    for (const [id, conversation] of this.conversations) {
      if (
        (conversation.status === 'completed' ||
          conversation.status === 'failed' ||
          conversation.status === 'timeout') &&
        now - conversation.createdAt > maxAgeMs
      ) {
        this.conversations.delete(id);
        removed++;
      }
    }

    return removed;
  }
}

export function createConversationManager(): IConversationManager {
  return new ConversationManager();
}
