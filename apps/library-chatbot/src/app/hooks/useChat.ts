import { useState, useCallback } from 'react';
import { type Message } from 'ui/components/chat-message';

interface UseChatOptions {
  initialMessages?: Message[];
  api?: string;
  onResponse?: (response: Response) => void;
  onFinish?: (message: Message) => void;
  onError?: (error: Error) => void;
  stream?: boolean;
}

export function useChat({
  initialMessages = [],
  api = '/api/chat',
  onResponse,
  onFinish,
  onError,
  stream = true,
}: UseChatOptions = {}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
  );

  const handleSubmit = useCallback(
    async (e?: { preventDefault?: () => void }, options?: { experimental_attachments?: FileList }) => {
      e?.preventDefault?.();
      
      if (!input.trim() && !options?.experimental_attachments?.length) return;
      
      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: input,
        createdAt: new Date(),
      };

      // Add attachments if provided
      if (options?.experimental_attachments?.length) {
        const attachments = Array.from(options.experimental_attachments).map(file => ({
          name: file.name,
          contentType: file.type,
          url: URL.createObjectURL(file),
        }));
        userMessage.experimental_attachments = attachments;
      }

      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);
      setError(null);

      try {
        // Determine if we should use streaming or regular API
        const apiUrl = stream ? `${api}/stream` : api;
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            attachments: userMessage.experimental_attachments,
          }),
        });

        onResponse?.(response);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (stream) {
          // Handle streaming response
          const assistantMessage: Message = {
            id: generateId(),
            role: 'assistant',
            content: '',
            createdAt: new Date(),
          };

          // Add empty assistant message immediately
          setMessages(prev => [...prev, assistantMessage]);

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error('Failed to get response reader');
          }

          let accumulatedContent = '';
          
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
                    // Ensure error is a string
                    const errorStr = typeof data.error === 'string' ? data.error : String(data.error);
                    throw new Error(errorStr);
                  }
                  
                  if (data.content) {
                    // Ensure content is a string
                    const contentStr = typeof data.content === 'string' ? data.content : String(data.content);
                    
                    accumulatedContent += contentStr;
                    
                    setMessages(prev => {
                      const newMessages = [...prev];
                      const lastMessage = newMessages[newMessages.length - 1];
                      if (lastMessage && lastMessage.role === 'assistant') {
                        // Replace the entire content instead of appending to avoid duplicates
                        lastMessage.content = accumulatedContent;
                      }
                      return newMessages;
                    });
                  }
                  
                  if (data.done) {
                    onFinish?.(assistantMessage);
                    setIsLoading(false);
                    return;
                  }
                } catch (parseError) {
                  console.error('Error parsing SSE data:', parseError, 'Line:', line);
                }
              }
            }
          }
        } else {
          // Handle regular response
          const data = await response.json();
          
          const assistantMessage: Message = {
            id: generateId(),
            role: 'assistant',
            content: data.content || '',
            createdAt: new Date(),
            ...(data.toolInvocations && { toolInvocations: data.toolInvocations }),
            ...(data.parts && { parts: data.parts }),
          };

          setMessages(prev => [...prev, assistantMessage]);
          onFinish?.(assistantMessage);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error occurred');
        setError(error);
        onError?.(error);
        
        // Add error message to chat
        const errorMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: `Error: ${String(error.message)}`,
          createdAt: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, messages, api, onResponse, onFinish, onError, stream]
  );

  const stop = useCallback(() => {
    setIsLoading(false);
  }, []);

  const append = useCallback(
    (message: { role: 'user'; content: string }) => {
      const newMessage: Message = {
        id: generateId(),
        role: message.role,
        content: message.content,
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, newMessage]);
    },
    []
  );

  const reload = useCallback(async () => {
    if (messages.length === 0) return;
    
    // Remove the last assistant message if it exists
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'assistant') {
      setMessages(prev => prev.slice(0, -1));
    }
    
    // Resubmit the last user message
    const lastUserMessage = messages.findLast(m => m.role === 'user');
    if (lastUserMessage) {
      setInput(lastUserMessage.content);
      setTimeout(() => {
        handleSubmit();
      }, 0);
    }
  }, [messages, handleSubmit]);

  const setMessagesCallback = useCallback((newMessages: Message[]) => {
    setMessages(newMessages);
  }, []);

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
    append,
    reload,
    setMessages: setMessagesCallback,
  };
}

// Simple ID generator for messages
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}