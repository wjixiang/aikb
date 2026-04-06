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

// ============ Stream Event Types ============

export interface ToolStartedEvent {
  toolName: string;
  params: Record<string, unknown>;
}

export interface ToolCompletedEvent {
  toolName: string;
  result: unknown;
  success: boolean;
  duration: number;
  error?: string;
}

export interface AgentStatusEvent {
  status: string;
  reason?: string;
}

export interface LlmCompletedEvent {
  promptTokens: number;
  completionTokens: number;
}

// ============ API ============

const BASE = '/api/chat';

export interface StreamCallbacks {
  /** New message added to agent memory (assistant text, tool_use, tool_result) */
  onMessageAdded?: (message: ChatMessage) => void;
  /** A tool execution started */
  onToolStarted?: (data: ToolStartedEvent) => void;
  /** A tool execution completed */
  onToolCompleted?: (data: ToolCompletedEvent) => void;
  /** Agent lifecycle status changed (completed, aborted, sleeping) — primary turn-end signal */
  onStatusChange?: (data: AgentStatusEvent) => void;
  /** Agent final output (from A2A query result) */
  onCompleted?: (data: unknown) => void;
  /** Agent error occurred */
  onError?: (message: string) => void;
}

export interface StreamResult {
  /** Cancel the in-progress stream */
  cancel: () => void;
}

export async function sendMessageStream(
  message: string,
  callbacks: StreamCallbacks,
  context?: UserContext,
): Promise<StreamResult> {
  const abortController = new AbortController();

  const response = await fetch(`${BASE}/messages/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, context }),
    signal: abortController.signal,
  });

  if (!response.ok || !response.body) {
    callbacks.onError?.(`HTTP ${response.status}`);
    return { cancel: () => {} };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';

  (async () => {
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
            try {
              const data = JSON.parse(line.slice(6));
              switch (currentEvent) {
                case 'message.added':
                  callbacks.onMessageAdded?.(data as ChatMessage);
                  break;
                case 'tool.started':
                  callbacks.onToolStarted?.(data as ToolStartedEvent);
                  break;
                case 'tool.completed':
                  callbacks.onToolCompleted?.(data as ToolCompletedEvent);
                  break;
                case 'agent.status':
                  callbacks.onStatusChange?.(data as AgentStatusEvent);
                  break;
                case 'llm.completed':
                  // consumed silently
                  break;
                case 'completed':
                  callbacks.onCompleted?.(data.data);
                  break;
                case 'error':
                  callbacks.onError?.(data.message);
                  break;
              }
            } catch {
              // Ignore JSON parse errors
            }
            currentEvent = '';
          }
        }
      }
    } catch {
      // Aborted or stream ended
    } finally {
      reader.releaseLock();
    }
  })();

  return {
    cancel: () => abortController.abort(),
  };
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
