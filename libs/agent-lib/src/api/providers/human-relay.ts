import { Anthropic } from '@anthropic-ai/sdk';

import type { ModelInfo } from '../../types';
import { ApiStream } from '../transform/stream';

import type {
  ApiHandler,
  SingleCompletionHandler,
  ApiHandlerCreateMessageMetadata,
} from '../index';

/**
 * Human Relay API processor
 * This processor does not directly call the API, but interacts with the model through human operations copy and paste.
 */
export class HumanRelayHandler implements ApiHandler, SingleCompletionHandler {
  countTokens(
    _content: Array<Anthropic.Messages.ContentBlockParam>,
  ): Promise<number> {
    return Promise.resolve(0);
  }

  /**
   * Create a message processing flow, display a dialog box to request human assistance
   * @param systemPrompt System prompt words
   * @param messages Message list
   * @param metadata Optional metadata
   */
  async *createMessage(
    systemPrompt: string,
    messages: Anthropic.Messages.MessageParam[],
    metadata?: ApiHandlerCreateMessageMetadata,
  ): ApiStream {
    // Get the most recent user message
    const latestMessage = messages[messages.length - 1];

    if (!latestMessage) {
      throw new Error('No message to relay');
    }

    // If it is the first message, splice the system prompt word with the user message
    let promptText = '';
    if (messages.length === 1) {
      promptText = `${systemPrompt}\n\n${getMessageContent(latestMessage)}`;
    } else {
      promptText = getMessageContent(latestMessage);
    }

    // Display the prompt text for manual copying
    console.log('=== Human Relay Prompt ===');
    console.log(promptText);
    console.log('========================');

    // Wait for user to manually provide response
    const response = await waitForUserInput();

    if (!response) {
      // The user canceled the operation
      throw new Error('Human relay operation cancelled');
    }

    // Return to the user input reply
    yield { type: 'text', text: response };
  }

  /**
   * Get model information
   */
  getModel(): { id: string; info: ModelInfo } {
    // Human relay does not depend on a specific model, here is a default configuration
    return {
      id: 'human-relay',
      info: {
        maxTokens: 16384,
        contextWindow: 100000,
        supportsImages: true,
        supportsPromptCache: false,
        inputPrice: 0,
        outputPrice: 0,
        description: 'Calling web-side AI model through human relay',
      },
    };
  }

  /**
   * Implementation of a single prompt
   * @param prompt Prompt content
   */
  async completePrompt(prompt: string): Promise<string> {
    // Display the prompt text for manual copying
    console.log('=== Human Relay Prompt ===');
    console.log(prompt);
    console.log('========================');

    // Wait for user to manually provide response
    const response = await waitForUserInput();

    if (!response) {
      throw new Error('Human relay operation cancelled');
    }

    return response;
  }
}

/**
 * Extract text content from message object
 * @param message
 */
function getMessageContent(message: Anthropic.Messages.MessageParam): string {
  if (typeof message.content === 'string') {
    return message.content;
  } else if (Array.isArray(message.content)) {
    return message.content
      .filter((item) => item.type === 'text')
      .map((item) => (item.type === 'text' ? item.text : ''))
      .join('\n');
  }
  return '';
}
/**
 * Waits for user input from stdin.
 * @returns The user's input response or undefined (if canceled).
 */
async function waitForUserInput(): Promise<string | undefined> {
  return new Promise<string | undefined>((resolve) => {
    // In a non-VSCode environment, we'll use stdin for input
    if (typeof process !== 'undefined' && process.stdin) {
      console.log('Please enter your response (or press Enter to cancel):');

      process.stdin.setEncoding('utf8');
      process.stdin.resume();

      let input = '';

      process.stdin.on('data', (data) => {
        input += data;
        if (data.includes('\n')) {
          process.stdin.pause();
          const response = input.trim();
          resolve(response === '' ? undefined : response);
        }
      });

      process.stdin.on('error', () => {
        resolve(undefined);
      });
    } else {
      // Fallback for environments without stdin
      resolve(undefined);
    }
  });
}
