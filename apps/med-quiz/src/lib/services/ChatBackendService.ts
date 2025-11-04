import { EventEmitter } from 'events';
import { getApiUrl } from '@/lib/config/environment';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system' | 'status';
  content: string;
  data?: any;
  timestamp: string;
}

interface ChatSession {
  sessionId: string;
  messages: ChatMessage[];
  status: 'active' | 'completed' | 'error';
  createdAt: string;
  lastActivity: string;
}

export class ChatBackendService {
  private static instance: ChatBackendService;
  private sessions: Map<string, ChatSession> = new Map();
  private emitter = new EventEmitter();

  private constructor() {}

  static getInstance(): ChatBackendService {
    if (!ChatBackendService.instance) {
      ChatBackendService.instance = new ChatBackendService();
    }
    return ChatBackendService.instance;
  }

  /**
   * Create a new chat session
   */
  createSession(sessionId?: string): string {
    const id =
      sessionId ||
      `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.sessions.set(id, {
      sessionId: id,
      messages: [],
      status: 'active',
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    });

    return id;
  }

  /**
   * Ensure session exists
   */
  ensureSession(sessionId: string): void {
    if (!this.sessions.has(sessionId)) {
      this.createSession(sessionId);
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ChatSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Push a message to frontend via API
   */
  async pushMessage(
    sessionId: string,
    message: Omit<ChatMessage, 'id' | 'timestamp'>,
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const fullMessage: ChatMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    session.messages.push(fullMessage);
    session.lastActivity = new Date().toISOString();

    // Send to frontend via API (only if server is running)
    const baseUrl = getApiUrl();
    try {
      await fetch(`${baseUrl}/api/chat/stream`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          type: message.type,
          content: message.content,
          data: message.data,
        }),
      });
    } catch (error) {
      // In development/testing, just log the error but don't fail
      console.warn(
        'Could not push message to frontend (server may not be running):',
        error,
      );
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

    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'completed';
    }

    // Send completion signal
    await fetch(`${getApiUrl()}/api/chat/stream`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        type: 'done',
      }),
    });
  }

  /**
   * Get conversation history
   */
  getHistory(sessionId: string): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    return session ? session.messages : [];
  }

  /**
   * Clear session
   */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Process user query with agent and stream responses
   */
  async processWithAgent(
    sessionId: string,
    userQuery: string,
    agentConfig: any,
  ): Promise<void> {
    try {
      // Send initial status
      await this.sendStatus(sessionId, '正在分析您的问题...');

      // Import agent service dynamically to avoid circular dependencies
      const { AgentService } = await import('@/lib/services/agentService');
      const { Agent } = await import('@/lib/agents/Agent');

      const agent = new Agent(agentConfig);
      const agentService = new AgentService(agent, agentConfig);

      const agentStream = agentService.processRequest({
        mode: 'agent',
        messages: [
          {
            content: userQuery,
            sender: 'user',
            timestamp: new Date(),
            isVisible: true,
            messageType: 'content',
          },
        ],
        rag_config: agentConfig.rag_config,
      });

      const transformedStream = agentService.transformAgentStream(agentStream);

      // Stream agent responses
      for await (const step of transformedStream) {
        switch (step.type) {
          case 'step':
            await this.sendStatus(sessionId, step.content);
            break;
          case 'update':
            await this.pushMessage(sessionId, {
              type: 'ai',
              content: step.content,
            });
            break;
          case 'done':
            await this.completeConversation(sessionId, step.content);
            break;
          case 'error':
            await this.pushMessage(sessionId, {
              type: 'system',
              content: `错误: ${step.content}`,
            });
            break;
          case 'quizzes':
            const quizzesData = (step as any).quizzes;
            if (quizzesData) {
              await this.pushMessage(sessionId, {
                type: 'ai',
                content: '为您找到了相关练习题',
                data: { quizzes: quizzesData },
              });
            }
            break;
        }
      }
    } catch (error) {
      console.error('Error processing with agent:', error);
      await this.pushMessage(sessionId, {
        type: 'system',
        content: `处理失败: ${error instanceof Error ? error.message : '未知错误'}`,
      });
    }
  }
}

// Export singleton instance
export const chatBackendService = ChatBackendService.getInstance();
