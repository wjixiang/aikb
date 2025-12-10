import { WebSocketService } from './websocket.service';

export interface AgentInput {
  conversationId: string;
  content: string;
  clientId?: string;
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'error';
  id?: string;
  text?: string;
  name?: string;
  arguments?: Record<string, any>;
  result?: any;
  toolCallId?: string;
  error?: string;
}

export interface ServerMessage {
  type: 'stream_chunk' | 'conversation_update' | 'error';
  conversationId?: string;
  chunk?: StreamChunk;
  error?: string;
}

export interface ClientMessage {
  type: 'user_input' | 'new_conversation' | 'conversation_history';
  conversationId?: string;
  content?: string;
  clientId?: string;
}

export class AgentService {
  private wsService: WebSocketService;
  private baseUrl: string;

  constructor(wsUrl: string, baseUrl: string = '') {
    this.wsService = new WebSocketService(wsUrl);
    this.baseUrl = baseUrl;
  }

  async connect(): Promise<void> {
    await this.wsService.connect();
  }

  disconnect(): void {
    this.wsService.disconnect();
  }

  sendMessage(input: AgentInput): void {
    const message: ClientMessage = {
      type: 'user_input',
      conversationId: input.conversationId,
      content: input.content,
      clientId: input.clientId,
    };

    this.wsService.send(message);
  }

  createNewConversation(): string {
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const message: ClientMessage = {
      type: 'new_conversation',
      conversationId,
    };

    this.wsService.send(message);
    return conversationId;
  }

  getConversationHistory(conversationId: string): void {
    const message: ClientMessage = {
      type: 'conversation_history',
      conversationId,
    };

    this.wsService.send(message);
  }

  onStreamChunk(
    handler: (chunk: StreamChunk, conversationId?: string) => void,
  ): void {
    this.wsService.onMessage('stream_chunk', (message: ServerMessage) => {
      if (message.chunk) {
        handler(message.chunk, message.conversationId);
      }
    });
  }

  onConversationUpdate(handler: (conversationId: string) => void): void {
    this.wsService.onMessage(
      'conversation_update',
      (message: ServerMessage) => {
        if (message.conversationId) {
          handler(message.conversationId);
        }
      },
    );
  }

  onError(handler: (error: string) => void): void {
    this.wsService.onMessage('error', (message: ServerMessage) => {
      if (message.error) {
        handler(message.error);
      }
    });
  }

  offStreamChunk(
    handler: (chunk: StreamChunk, conversationId?: string) => void,
  ): void {
    this.wsService.offMessage('stream_chunk', handler);
  }

  offConversationUpdate(handler: (conversationId: string) => void): void {
    this.wsService.offMessage('conversation_update', handler);
  }

  offError(handler: (error: string) => void): void {
    this.wsService.offMessage('error', handler);
  }

  isConnected(): boolean {
    return this.wsService.isConnected();
  }

  getConnectionState(): string {
    return this.wsService.getConnectionState();
  }

  // HTTP API methods for additional functionality
  async getConversations(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/conversations`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  async getConversation(conversationId: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/conversations/${conversationId}`,
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching conversation:', error);
      throw error;
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/conversations/${conversationId}`,
        {
          method: 'DELETE',
        },
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }
}
