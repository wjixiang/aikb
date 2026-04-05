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

export interface UserContext {
  route: string;
  itemId?: string;
  attId?: string;
}

// ============ API ============

const BASE = '/api/chat';

export interface StreamCallbacks {
  onStarted: () => void;
  onCompleted: (data: unknown) => void;
  onError: (message: string) => void;
}

export async function sendMessageStream(
  message: string,
  callbacks: StreamCallbacks,
  context?: UserContext,
): Promise<void> {
  const response = await fetch(`${BASE}/messages/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, context }),
  });

  if (!response.ok || !response.body) {
    callbacks.onError(`HTTP ${response.status}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ') && currentEvent) {
          const data = JSON.parse(line.slice(6));
          switch (currentEvent) {
            case 'started':
              callbacks.onStarted();
              break;
            case 'completed':
              callbacks.onCompleted(data.data);
              break;
            case 'error':
              callbacks.onError(data.message);
              break;
          }
          currentEvent = '';
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export const chatApi = {
  sendMessage(message: string, context?: UserContext): Promise<ChatMessageResponse> {
    return apiClient.post<ChatMessageResponse>(`${BASE}/messages`, { message, context });
  },

  getHistory(): Promise<ChatHistoryResponse> {
    return apiClient.get<ChatHistoryResponse>(`${BASE}/history`);
  },

  getStatus(): Promise<ChatStatusResponse> {
    return apiClient.get<ChatStatusResponse>(`${BASE}/status`);
  },
};
