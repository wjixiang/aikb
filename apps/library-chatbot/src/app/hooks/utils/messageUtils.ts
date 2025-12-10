import { type Message } from 'ui/components/chat-message';

/**
 * Generate a unique ID for messages
 */
export function generateId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

/**
 * Create a new user message
 */
export function createUserMessage(
  content: string,
  attachments?: FileList,
): Message {
  const userMessage: Message = {
    id: generateId(),
    role: 'user',
    content,
    createdAt: new Date(),
  };

  // Add attachments if provided
  if (attachments?.length) {
    const attachmentData = Array.from(attachments).map((file) => ({
      name: file.name,
      contentType: file.type,
      url: URL.createObjectURL(file),
    }));
    userMessage.experimental_attachments = attachmentData;
  }

  return userMessage;
}

/**
 * Create a new assistant message
 */
export function createAssistantMessage(content = ''): Message {
  return {
    id: generateId(),
    role: 'assistant',
    content,
    createdAt: new Date(),
  };
}

/**
 * Create an error message
 */
export function createErrorMessage(error: Error | string): Message {
  const errorMessage = typeof error === 'string' ? error : error.message;
  return {
    id: generateId(),
    role: 'assistant',
    content: `Error: ${errorMessage}`,
    createdAt: new Date(),
  };
}

/**
 * Find the last user message in an array of messages
 */
export function findLastUserMessage(messages: Message[]): Message | undefined {
  return messages.findLast((m) => m.role === 'user');
}

/**
 * Check if a message has valid content
 */
export function hasValidContent(message: Message): boolean {
  return Boolean(message.content?.trim());
}

/**
 * Process API response data into a message
 */
export function processApiResponse(data: unknown): Message {
  const responseData = data as {
    content?: string;
    toolInvocations?: Message['toolInvocations'];
    parts?: Message['parts'];
  };

  return {
    id: generateId(),
    role: 'assistant',
    content: responseData.content || '',
    createdAt: new Date(),
    ...(responseData.toolInvocations && {
      toolInvocations: responseData.toolInvocations,
    }),
    ...(responseData.parts && { parts: responseData.parts }),
  };
}
