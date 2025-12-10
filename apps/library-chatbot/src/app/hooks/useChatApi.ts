import { useState, useCallback } from 'react';
import { type Message } from 'ui/components/chat-message';
import {
  makeApiRequest,
  processRegularResponse,
  type ApiRequestOptions,
} from './utils/apiUtils';

export interface UseChatApiOptions {
  api?: string;
  onResponse?: (response: Response) => void;
  onError?: (error: Error) => void;
}

export interface UseChatApiReturn {
  isLoading: boolean;
  error: Error | null;
  sendMessage: (
    messages: Message[],
    attachments?: Message['experimental_attachments'],
  ) => Promise<Message>;
  stop: () => void;
}

export function useChatApi({
  api = '/api/chat',
  onResponse,
  onError,
}: UseChatApiOptions = {}): UseChatApiReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  const sendMessage = useCallback(
    async (
      messages: Message[],
      attachments?: Message['experimental_attachments'],
    ): Promise<Message> => {
      setIsLoading(true);
      setError(null);

      const controller = new AbortController();
      setAbortController(controller);

      try {
        const requestOptions: ApiRequestOptions = {
          messages,
          attachments,
          api,
          stream: false, // This hook now only handles non-streaming
        };

        const response = await makeApiRequest(requestOptions);
        const assistantMessage = await processRegularResponse(response, {
          onResponse,
          onError: (err) => {
            setError(err);
            onError?.(err);
          },
        });

        return assistantMessage;
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Unknown error occurred');
        setError(error);
        onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
        setAbortController(null);
      }
    },
    [api, onResponse, onError],
  );

  const stop = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setIsLoading(false);
  }, [abortController]);

  return {
    isLoading,
    error,
    sendMessage,
    stop,
  };
}
