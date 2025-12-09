export interface Message {
  id: string;
  type: 'user' | 'assistant' | 'tool_result' | 'system';
  content: string;
  timestamp: number;
  toolCallId?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface ClientMessage {
  type: 'user_input' | 'new_conversation' | 'conversation_history';
  conversationId?: string;
  content?: string;
  clientId?: string;
}

export interface ServerMessage {
  type: 'stream_chunk' | 'conversation_update' | 'error';
  conversationId?: string;
  chunk?: StreamChunk;
  error?: string;
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

export interface AgentInput {
  conversationId: string;
  content: string;
  clientId?: string;
}

export interface ConversationContext {
  messages: Message[];
  availableTools: Tool[];
  systemPrompt?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}