/**
 * LLM Pool - Backend Client
 *
 * Wraps the API clients from agent-lib for making requests to backends
 */

import pino from 'pino';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { BackendConfig } from './config.js';
import { ChatRequest, ChatResponse } from './types.js';

export interface BackendClient {
  /**
   * Make a chat completion request
   */
  chat(request: ChatRequest): Promise<ChatResponse>;

  /**
   * Make a streaming chat completion request
   */
  streamChat(
    request: ChatRequest,
    onChunk: (chunk: string) => void
  ): Promise<void>;

  /**
   * Close the client and clean up resources
   */
  close(): Promise<void>;
}

export class OpenAIBackendClient implements BackendClient {
  private client: OpenAI;
  private config: BackendConfig;
  private logger: pino.Logger;

  constructor(config: BackendConfig, logger: pino.Logger) {
    this.config = config;
    this.logger = logger.child({ component: 'OpenAIBackendClient', backendId: config.id });

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: request.messages as OpenAI.Chat.ChatCompletionMessageParam[],
        tools: request.tools as OpenAI.ChatCompletionTool[] | undefined,
        temperature: request.temperature ?? this.config.temperature,
        max_tokens: request.max_tokens ?? this.config.maxTokens,
        stream: false,
        stop: request.stop,
      });

      const latency = Date.now() - startTime;

      return this.convertResponse(response, request.model, latency);
    } catch (error) {
      this.logger.error({ error, model: this.config.model }, 'OpenAI request failed');
      throw error;
    }
  }

  async streamChat(
    request: ChatRequest,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const stream = await this.client.chat.completions.create({
      model: this.config.model,
      messages: request.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      tools: request.tools as OpenAI.ChatCompletionTool[] | undefined,
      temperature: request.temperature ?? this.config.temperature,
      max_tokens: request.max_tokens ?? this.config.maxTokens,
      stream: true,
      stop: request.stop,
    });

    let firstChunk = true;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        if (firstChunk) {
          onChunk(`data: ${JSON.stringify({ id: chunk.id, object: 'chat.completion.chunk', created: chunk.created, model: request.model, choices: [{ index: 0, delta: { content: delta }, finish_reason: null }] })}\n\n`);
          firstChunk = false;
        } else {
          onChunk(`data: ${JSON.stringify({ id: chunk.id, object: 'chat.completion.chunk', created: chunk.created, model: request.model, choices: [{ index: 0, delta: { content: delta }, finish_reason: null }] })}\n\n`);
        }
      }
    }

    onChunk('data: [DONE]\n\n');
  }

  private convertResponse(
    response: OpenAI.Chat.ChatCompletion,
    originalModel: string,
    latency: number
  ): ChatResponse {
    const choice = response.choices[0];
    const message = choice?.message;

    return {
      id: response.id,
      model: originalModel,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: message?.content || null,
            tool_calls: message?.tool_calls?.map((tc) => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            })),
          },
          finish_reason: choice?.finish_reason || null,
        },
      ],
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0,
      },
      created: response.created,
    };
  }

  async close(): Promise<void> {
    // OpenAI client doesn't need explicit cleanup
  }
}

export class AnthropicBackendClient implements BackendClient {
  private client: Anthropic;
  private config: BackendConfig;
  private logger: pino.Logger;

  constructor(config: BackendConfig, logger: pino.Logger) {
    this.config = config;
    this.logger = logger.child({ component: 'AnthropicBackendClient', backendId: config.id });

    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    try {
      // Find system message
      let systemMessage = request.system || '';
      const filteredMessages = request.messages.filter((m) => {
        if (m.role === 'system') {
          systemMessage = m.content;
          return false;
        }
        return true;
      });

      // Convert messages to Anthropic format
      const anthropicMessages: Anthropic.MessageParam[] = filteredMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const response = await this.client.messages.create({
        model: this.config.model,
        messages: anthropicMessages,
        system: systemMessage,
        max_tokens: request.max_tokens ?? this.config.maxTokens ?? 4096,
        temperature: request.temperature ?? this.config.temperature,
      });

      const latency = Date.now() - startTime;

      return this.convertResponse(response, request.model, latency);
    } catch (error) {
      this.logger.error({ error, model: this.config.model }, 'Anthropic request failed');
      throw error;
    }
  }

  async streamChat(
    request: ChatRequest,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    // Find system message
    let systemMessage = request.system || '';
    const filteredMessages = request.messages.filter((m) => {
      if (m.role === 'system') {
        systemMessage = m.content;
        return false;
      }
      return true;
    });

    const anthropicMessages: Anthropic.MessageParam[] = filteredMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const stream = await this.client.messages.stream({
      model: this.config.model,
      messages: anthropicMessages,
      system: systemMessage,
      max_tokens: request.max_tokens ?? this.config.maxTokens ?? 4096,
      temperature: request.temperature ?? this.config.temperature,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        onChunk(`data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: chunk.delta.text } })}\n\n`);
      }
    }

    onChunk('data: [DONE]\n\n');
  }

  private convertResponse(
    response: Anthropic.Message,
    originalModel: string,
    latency: number
  ): ChatResponse {
    const contentBlocks = response.content;
    let textContent = '';
    const toolCalls: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }> = [];

    for (const block of contentBlocks) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }

    return {
      id: response.id,
      model: originalModel,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: textContent || null,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          },
          finish_reason: response.stop_reason === 'end_turn' ? 'stop' : response.stop_reason === 'max_tokens' ? 'length' : null,
        },
      ],
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      created: Date.now(),
    };
  }

  async close(): Promise<void> {
    // Anthropic client doesn't need explicit cleanup
  }
}

/**
 * Factory for creating backend clients
 */
export class BackendClientFactory {
  static create(config: BackendConfig, logger: pino.Logger): BackendClient {
    switch (config.provider) {
      case 'anthropic':
        return new AnthropicBackendClient(config, logger);
      case 'openai':
      case 'ollama':
      case 'lmstudio':
      case 'moonshot':
      case 'minimax':
      case 'custom':
      default:
        return new OpenAIBackendClient(config, logger);
    }
  }
}
