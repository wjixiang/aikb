import { injectable } from 'inversify';
import Anthropic from '@anthropic-ai/sdk';
import { BaseApiClient, BaseClientConfig } from './base.js';
import {
  ApiResponse,
  ChatCompletionTool,
  MemoryContextItem,
  ToolCall,
  TokenUsage,
} from '../types/api-client.js';
import {
  ApiClientError,
  AuthenticationError,
  RateLimitError,
  NetworkError,
  ServiceUnavailableError,
  ContentPolicyError,
  QuotaExceededError,
  ResponseParsingError,
  ValidationError,
  UnknownApiError,
  parseError,
} from '../errors/errors.js';

export interface AnthropicCompatibleConfig extends BaseClientConfig {}

/**
 * Anthropic-compatible API client implementation
 *
 * Supports Anthropic API and compatible endpoints (e.g., Bedrock, Vertex AI)
 * Converts responses to the unified ToolCall[] format
 */
@injectable()
export class AnthropicCompatibleApiClient extends BaseApiClient {
  private client: Anthropic;

  constructor(config: AnthropicCompatibleConfig) {
    super(config, 'AnthropicCompatibleApiClient');
    this.client = new Anthropic({
      apiKey: this.config.apiKey as string,
      baseURL: this.config.baseURL as string | undefined,
    });
  }

  protected get maxTemperature(): number {
    return 1;
  }

  protected parseProviderError(
    error: unknown,
    context?: { timeout?: number },
  ) {
    return this.parseAnthropicError(error, context);
  }

  protected async executeApiRequest(
    requestId: string,
    systemPrompt: string,
    workspaceContext: string,
    memoryContext: MemoryContextItem[],
    tools: ChatCompletionTool[] | undefined,
  ): Promise<ApiResponse> {
    const { systemContext, messages } = this.buildMessages(systemPrompt, workspaceContext, memoryContext);
    const anthropicTools = this.convertToolsToAnthropicFormat(tools);

    const startTime = Date.now();

    const requestParams: Anthropic.MessageCreateParams = {
      model: this.config.model as string,
      max_tokens: (this.config.maxTokens as number) ?? 4096,
      messages,
      system: systemContext,
      temperature: this.config.temperature as number | undefined,
    };

    if (anthropicTools) {
      requestParams.tools = anthropicTools;
    }

    const message = await this.withTimeout(
      this.client.messages.create(requestParams) as Promise<Anthropic.Message>,
      40000,
    );

    const requestTime = Date.now() - startTime;

    if (!message) {
      throw new ResponseParsingError('Received empty response from API');
    }

    const response = this.convertAnthropicResponse(message, requestTime);

    this.logger.debug(
      {
        requestId,
        systemPrompt:
          systemPrompt.substring(0, 200) +
          (systemPrompt.length > 200 ? '...' : ''),
        memoryContextCount: memoryContext.length,
        workspaceContextLength: workspaceContext.length,
        response,
      },
      'Request details',
    );

    return response;
  }

  // --- Anthropic-specific methods ---

  private buildMessages(
    systemPrompt: string,
    workspaceContext: string,
    memoryContext: MemoryContextItem[],
  ): { systemContext: string; messages: Anthropic.MessageParam[] } {
    const systemParts: string[] = [systemPrompt];
    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: `--- WORKSPACE CONTEXT ---\n${workspaceContext}\n--- END WORKSPACE CONTEXT ---`,
      },
    ];

    for (const item of memoryContext) {
      if (typeof item === 'string') {
        messages.push({ role: 'user', content: item });
      } else if ('tool_calls' in item && item.tool_calls) {
        // Assistant message with tool_calls (OpenAI format) → convert to Anthropic tool_use blocks
        const content: Anthropic.ContentBlockParam[] = [];
        if (item.content) {
          content.push({ type: 'text', text: item.content });
        }
        for (const tc of item.tool_calls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          });
        }
        messages.push({ role: 'assistant', content });
      } else if ('tool_call_id' in item && item.role === 'tool') {
        // Tool result → Anthropic requires role:user with tool_result content block
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: item.tool_call_id,
              content: item.content,
            },
          ],
        });
      } else if ('contentBlocks' in item && item.contentBlocks) {
        // Structured content blocks — pass through directly
        messages.push({ role: item.role, content: item.contentBlocks as unknown as Anthropic.ContentBlockParam[] });
      } else if (item.role === 'system') {
        systemParts.push(item.content!);
      } else {
        messages.push({ role: item.role, content: item.content! });
      }
    }

    return { systemContext: systemParts.join('\n\n'), messages };
  }

  private convertToolsToAnthropicFormat(
    tools?: ChatCompletionTool[],
  ): Anthropic.Tool[] | undefined {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    return tools
      .filter(
        (tool): tool is ChatCompletionTool & { type: 'function' } =>
          tool.type === 'function',
      )
      .map((tool) => ({
        name: tool.function.name,
        description: tool.function.description ?? '',
        input_schema: tool.function
          .parameters as Anthropic.Tool.InputSchema,
      }));
  }

  private convertAnthropicResponse(
    message: Anthropic.Message,
    requestTime: number,
  ): ApiResponse {
    try {
      if (!message.content || message.content.length === 0) {
        throw new ResponseParsingError(
          'No content returned from API',
          message,
        );
      }

      const toolCalls: ToolCall[] = [];
      let textResponse = '';

      for (const block of message.content) {
        if (block.type === 'text') {
          textResponse += block.text;
        } else if (block.type === 'tool_use') {
          const toolUseBlock = block as Anthropic.ToolUseBlock;

          if (!toolUseBlock.id) {
            this.logger.warn(
              { toolUseBlock },
              'Tool call missing ID, skipping',
            );
            continue;
          }

          if (!toolUseBlock.name) {
            this.logger.warn(
              { toolUseBlock },
              'Function call missing name, skipping',
            );
            continue;
          }

          let args: string;
          try {
            args = JSON.stringify(toolUseBlock.input);
          } catch (e) {
            throw new ResponseParsingError(
              `Failed to serialize function arguments for ${toolUseBlock.name}`,
              { toolUseBlock, serializeError: e },
            );
          }

          toolCalls.push({
            id: toolUseBlock.id,
            call_id: toolUseBlock.id,
            type: 'function_call',
            name: toolUseBlock.name,
            arguments: args,
          });
        }
      }

      const tokenUsage: TokenUsage = {
        promptTokens: message.usage?.input_tokens ?? 0,
        completionTokens: message.usage?.output_tokens ?? 0,
        totalTokens:
          (message.usage?.input_tokens ?? 0) +
          (message.usage?.output_tokens ?? 0),
      };

      if (
        tokenUsage.promptTokens < 0 ||
        tokenUsage.completionTokens < 0 ||
        tokenUsage.totalTokens < 0
      ) {
        throw new ResponseParsingError(
          'Token counts cannot be negative',
          tokenUsage,
        );
      }

      return {
        toolCalls,
        textResponse,
        requestTime,
        tokenUsage,
      };
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }

      throw new ResponseParsingError(
        `Failed to parse API response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error
          ? { originalError: error.message, message }
          : message,
      );
    }
  }

  /**
   * Parse Anthropic-specific errors
   */
  private parseAnthropicError(
    error: unknown,
    context?: { timeout?: number },
  ) {
    if (error instanceof ApiClientError) {
      return error;
    }

    if (error instanceof Anthropic.APIError) {
      const statusCode = error.status ?? undefined;
      const errorCode = error.error?.type ?? 'unknown_error';

      if (statusCode === 401 || errorCode === 'authentication_error') {
        return new AuthenticationError(
          error.message || 'Authentication failed',
          statusCode,
        );
      }

      if (statusCode === 429 || errorCode === 'rate_limit_error') {
        const retryAfter = this.extractRetryAfter(error.headers);
        return new RateLimitError(
          error.message || 'Rate limit exceeded',
          retryAfter,
          statusCode,
        );
      }

      if (
        statusCode === 503 ||
        statusCode === 502 ||
        errorCode === 'service_unavailable'
      ) {
        return new ServiceUnavailableError(
          error.message || 'Service unavailable',
          statusCode,
        );
      }

      if (
        errorCode === 'content_policy_violation' ||
        errorCode === 'safety_error'
      ) {
        return new ContentPolicyError(
          error.message || 'Content policy violation',
          statusCode,
        );
      }

      if (statusCode === 400 || errorCode === 'invalid_request_error') {
        return new ValidationError(error.message || 'Invalid request');
      }

      if (errorCode === 'quota_exceeded') {
        return new QuotaExceededError(
          error.message || 'Quota exceeded',
        );
      }

      return new UnknownApiError(
        error.message || `API error: ${errorCode}`,
        { statusCode, errorCode, originalError: error } as Record<
          string,
          unknown
        >,
      );
    }

    if (error instanceof Error) {
      const message = error.message;

      if (message.includes('timed out') || message.includes('timeout')) {
        return parseError(error, context);
      }

      if (
        message.includes('ECONNREFUSED') ||
        message.includes('ENOTFOUND') ||
        message.includes('ECONNRESET') ||
        message.includes('ETIMEDOUT') ||
        message.includes('fetch failed') ||
        message.includes('network')
      ) {
        return new NetworkError(message, error);
      }
    }

    return parseError(error, context);
  }

  private extractRetryAfter(
    headers: Headers | undefined,
  ): number | undefined {
    if (!headers) return undefined;

    const retryAfter = headers.get('retry-after');
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return seconds;
      }
    }

    return undefined;
  }
}
