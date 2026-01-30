import { useCallback } from 'react';
import { type Message } from 'ui/components/chat-message';
import { useMessages } from './useMessages';
import { useChatApi } from './useChatApi';
import { useChatInput } from './useChatInput';
import {
  makeApiRequest,
  processStreamResponse,
  type StreamProcessorCallbacks,
} from llm-utils/apiUtils';

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
  // Use modular hooks for different concerns
  const {
    messages,
    setMessages,
    addUserMessage,
    addAssistantMessage,
    addErrorMessage,
    updateLastMessage,
    reloadLastMessage,
  } = useMessages({ initialMessages });

  const { input, setInput, handleInputChange, clearInput, hasValidInput } =
    useChatInput();

  const { isLoading, error, sendMessage, stop } = useChatApi({
    api,
    onResponse,
    onError,
  });

  const handleSubmit = useCallback(
    async (
      e?: { preventDefault?: () => void },
      options?: { experimental_attachments?: FileList },
    ) => {
      e?.preventDefault?.();

      if (!hasValidInput && !options?.experimental_attachments?.length) return;

      // Add user message
      const userMessage = addUserMessage(
        input,
        options?.experimental_attachments,
      );
      clearInput();

      // Add empty assistant message for streaming
      let assistantMessage: Message | null = null;
      if (stream) {
        assistantMessage = addAssistantMessage('');
      }

      try {
        if (stream && assistantMessage) {
          // Handle streaming response
          const response = await makeApiRequest({
            messages: [...messages, userMessage],
            attachments: userMessage.experimental_attachments,
            api,
            stream: true,
          });

          const callbacks: StreamProcessorCallbacks = {
            onResponse,
            onFinish: (message) => {
              onFinish?.(message);
            },
            onError: (err) => {
              addErrorMessage(err);
              onError?.(err);
            },
            onContentUpdate: (content) => {
              updateLastMessage(content);
            },
          };

          await processStreamResponse(response, assistantMessage, callbacks);
        } else {
          // Handle regular response
          const assistantMessage = await sendMessage(
            [...messages, userMessage],
            userMessage.experimental_attachments,
          );
          addAssistantMessage(assistantMessage.content);
          onFinish?.(assistantMessage);
        }
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Unknown error occurred');
        addErrorMessage(error);
        onError?.(error);
      }
    },
    [
      input,
      hasValidInput,
      messages,
      api,
      stream,
      onResponse,
      onFinish,
      onError,
      addUserMessage,
      addAssistantMessage,
      addErrorMessage,
      updateLastMessage,
      clearInput,
      sendMessage,
    ],
  );

  const append = useCallback(
    (message: { role: 'user'; content: string }) => {
      addUserMessage(message.content);
    },
    [addUserMessage],
  );

  const reload = useCallback(async () => {
    const lastUserMessage = reloadLastMessage();
    if (!lastUserMessage) return;

    setInput(lastUserMessage.content);

    // Use setTimeout to ensure input is set before submitting
    setTimeout(() => {
      handleSubmit();
    }, 0);
  }, [reloadLastMessage, setInput, handleSubmit]);

  const setMessagesCallback = useCallback(
    (newMessages: Message[]) => {
      setMessages(newMessages);
    },
    [setMessages],
  );

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
