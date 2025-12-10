import { useState, useCallback } from 'react';
import { type Message } from 'ui/components/chat-message';
import {
  createUserMessage,
  createAssistantMessage,
  createErrorMessage,
  findLastUserMessage,
} from './utils/messageUtils';

export interface UseMessagesOptions {
  initialMessages?: Message[];
}

export interface UseMessagesReturn {
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  addUserMessage: (content: string, attachments?: FileList) => Message;
  addAssistantMessage: (content?: string) => Message;
  addErrorMessage: (error: Error | string) => Message;
  updateLastMessage: (content: string) => void;
  removeLastMessage: () => void;
  reloadLastMessage: () => Message | null;
}

export function useMessages({
  initialMessages = [],
}: UseMessagesOptions = {}): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>(initialMessages);

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const addUserMessage = useCallback(
    (content: string, attachments?: FileList) => {
      const message = createUserMessage(content, attachments);
      addMessage(message);
      return message;
    },
    [addMessage],
  );

  const addAssistantMessage = useCallback(
    (content?: string) => {
      const message = createAssistantMessage(content);
      addMessage(message);
      return message;
    },
    [addMessage],
  );

  const addErrorMessage = useCallback(
    (error: Error | string) => {
      const message = createErrorMessage(error);
      addMessage(message);
      return message;
    },
    [addMessage],
  );

  const updateLastMessage = useCallback((content: string) => {
    setMessages((prev) => {
      const newMessages = [...prev];
      const lastMessage = newMessages[newMessages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        lastMessage.content = content;
      }
      return newMessages;
    });
  }, []);

  const removeLastMessage = useCallback(() => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const lastMessage = prev[prev.length - 1];
      if (lastMessage.role === 'assistant') {
        return prev.slice(0, -1);
      }
      return prev;
    });
  }, []);

  const reloadLastMessage = useCallback((): Message | null => {
    const lastUserMessage = findLastUserMessage(messages);
    if (!lastUserMessage) return null;

    // Remove the last assistant message if it exists
    removeLastMessage();

    return lastUserMessage;
  }, [messages, removeLastMessage]);

  return {
    messages,
    setMessages,
    addMessage,
    addUserMessage,
    addAssistantMessage,
    addErrorMessage,
    updateLastMessage,
    removeLastMessage,
    reloadLastMessage,
  };
}
