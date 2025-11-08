/**
 * Client-safe version of ChatBackendService
 * This service only makes HTTP API calls and doesn't import any server-side dependencies
 */

import { getApiUrl } from '@/lib/config/environment';

export interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system' | 'status';
  content: string;
  data?: any;
  timestamp: string;
}

export interface ChatSession {
  sessionId: string;
  messages: ChatMessage[];
  status: 'active' | 'completed' | 'error';
  createdAt: string;
  lastActivity: string;
}

export class ChatBackendServiceClient {
  private static instance: ChatBackendServiceClient;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = getApiUrl();
  }

  static getInstance(): ChatBackendServiceClient {
    if (!ChatBackendServiceClient.instance) {
      ChatBackendServiceClient.instance = new ChatBackendServiceClient();
    }
    return ChatBackendServiceClient.instance;
  }

  /**
   * Create a new chat session
   */
  async createSession(sessionId?: string): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/api/chat/backend/create-session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      },
    );

    if (!response.ok) {
      throw new Error('Failed to create session');
    }

    const data = await response.json();
    return data.sessionId;
  }

  /**
   * Push a message to frontend via API
   */
  async pushMessage(
    sessionId: string,
    message: Omit<ChatMessage, 'id' | 'timestamp'>,
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/chat/backend/push-message`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          type: message.type,
          content: message.content,
          data: message.data,
        }),
      },
    );

    if (!response.ok) {
      throw new Error('Failed to push message');
    }
  }

  /**
   * Start a multi-round conversation from backend
   */
  async startConversation(
    sessionId: string,
    initialPrompt: string,
  ): Promise<void> {
    await this.pushMessage(sessionId, {
      type: 'ai',
      content: initialPrompt,
    });
  }

  /**
   * Continue conversation with next message
   */
  async continueConversation(
    sessionId: string,
    message: string,
    data?: any,
  ): Promise<void> {
    await this.pushMessage(sessionId, {
      type: 'ai',
      content: message,
      data,
    });
  }

  /**
   * Send status update
   */
  async sendStatus(
    sessionId: string,
    status: string,
    data?: any,
  ): Promise<void> {
    await this.pushMessage(sessionId, {
      type: 'status',
      content: status,
      data,
    });
  }

  /**
   * Complete conversation
   */
  async completeConversation(
    sessionId: string,
    finalMessage?: string,
  ): Promise<void> {
    if (finalMessage) {
      await this.pushMessage(sessionId, {
        type: 'ai',
        content: finalMessage,
      });
    }

    // Send completion signal
    await fetch(`${this.baseUrl}/api/chat/backend/complete-conversation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        finalMessage,
      }),
    });
  }

  /**
   * Process user query with agent and stream responses
   */
  async processWithAgent(
    sessionId: string,
    userQuery: string,
    agentConfig: any,
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/chat/backend/process-with-agent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          userQuery,
          agentConfig,
        }),
      },
    );

    if (!response.ok) {
      throw new Error('Failed to process with agent');
    }
  }

  /**
   * Get conversation history
   */
  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    const response = await fetch(
      `${this.baseUrl}/api/chat/backend/history/${sessionId}`,
    );

    if (!response.ok) {
      throw new Error('Failed to get history');
    }

    const data = await response.json();
    return data.messages || [];
  }

  /**
   * Clear session
   */
  async clearSession(sessionId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/chat/backend/clear-session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      },
    );

    if (!response.ok) {
      throw new Error('Failed to clear session');
    }
  }

  /**
   * Get all active sessions
   */
  async getActiveSessions(): Promise<string[]> {
    const response = await fetch(
      `${this.baseUrl}/api/chat/backend/active-sessions`,
    );

    if (!response.ok) {
      throw new Error('Failed to get active sessions');
    }

    const data = await response.json();
    return data.sessions || [];
  }
}

// Export singleton instance
export const chatBackendServiceClient = ChatBackendServiceClient.getInstance();
