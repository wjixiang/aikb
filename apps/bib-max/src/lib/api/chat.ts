import { apiClient } from '../apiClient';

// ============ Types ============

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: Array<Record<string, unknown>>;
  ts?: number;
}

export interface ChatMessageResponse {
  success: boolean;
  data: unknown;
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
}

export interface ChatStatusResponse {
  status: string | null;
  agentId: string | null;
}

// ============ API ============

const BASE = '/api/chat';

export const chatApi = {
  sendMessage(message: string): Promise<ChatMessageResponse> {
    return apiClient.post<ChatMessageResponse>(`${BASE}/messages`, { message });
  },

  getHistory(): Promise<ChatHistoryResponse> {
    return apiClient.get<ChatHistoryResponse>(`${BASE}/history`);
  },

  getStatus(): Promise<ChatStatusResponse> {
    return apiClient.get<ChatStatusResponse>(`${BASE}/status`);
  },
};
