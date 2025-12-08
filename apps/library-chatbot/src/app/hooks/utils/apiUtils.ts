import { type Message } from 'ui/components/chat-message';

export interface ApiRequestOptions {
  messages: Message[];
  attachments?: Message['experimental_attachments'];
  api: string;
  stream: boolean;
}

export interface StreamProcessorCallbacks {
  onResponse?: (response: Response) => void;
  onFinish?: (message: Message) => void;
  onError?: (error: Error) => void;
  onContentUpdate?: (content: string) => void;
}

/**
 * Make API request to chat endpoint
 */
export async function makeApiRequest(options: ApiRequestOptions): Promise<Response> {
  const { messages, attachments, api, stream } = options;
  const apiUrl = stream ? `${api}/stream` : api;
  
  return fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      attachments,
    }),
  });
}

/**
 * Process streaming response
 */
export async function processStreamResponse(
  response: Response,
  assistantMessage: Message,
  callbacks: StreamProcessorCallbacks
): Promise<void> {
  const { onResponse, onFinish, onContentUpdate } = callbacks;
  
  onResponse?.(response);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error('Failed to get response reader');
  }

  let accumulatedContent = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const dataStr = line.slice(6).trim();
            
            if (!dataStr) continue;
            
            const data = JSON.parse(dataStr);
            
            if (data.error) {
              const errorStr = typeof data.error === 'string' ? data.error : String(data.error);
              throw new Error(errorStr);
            }
            
            if (data.content) {
              const contentStr = typeof data.content === 'string' ? data.content : String(data.content);
              accumulatedContent += contentStr;
              onContentUpdate?.(accumulatedContent);
            }
            
            if (data.done) {
              onFinish?.(assistantMessage);
              return;
            }
          } catch (parseError) {
            console.error('Error parsing SSE data:', parseError, 'Line:', line);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Process regular (non-streaming) response
 */
export async function processRegularResponse(
  response: Response,
  callbacks: StreamProcessorCallbacks
): Promise<Message> {
  const { onResponse } = callbacks;
  
  onResponse?.(response);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  
  return {
    id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
    role: 'assistant',
    content: data.content || '',
    createdAt: new Date(),
    ...(data.toolInvocations && { toolInvocations: data.toolInvocations }),
    ...(data.parts && { parts: data.parts }),
  };
}