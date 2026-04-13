import { injectable } from 'inversify';
import OpenAI from 'openai';
import chalk from 'chalk';
import { BaseApiClient, BaseClientConfig } from './base.js';
import {
  ApiResponse,
  ChatCompletionTool,
  ToolCall,
} from '../types/api-client.js';
import type { TokenUsage } from '../types/message.js';
import type { Message, ContentBlock, ToolUseBlock, ToolResultBlock, TextContentBlock } from '../types/message.js';
import {
  ApiClientError,
  ResponseParsingError,
  parseError,
} from '../errors/errors.js';

export interface OpenAICompatibleConfig extends BaseClientConfig {}

/**
 * OpenAI-compatible API client implementation
 *
 * Supports OpenAI API and compatible endpoints (e.g., Azure OpenAI, local models)
 * Converts responses to the unified ToolCall[] format
 */
@injectable()
export class OpenaiCompatibleApiClient extends BaseApiClient {
  private client: OpenAI;

  constructor(config: OpenAICompatibleConfig) {
    super(config, 'OpenaiCompatibleApiClient');
    this.client = new OpenAI({
      apiKey: this.config.apiKey as string,
      baseURL: this.config.baseURL as string | undefined,
    });
  }

  protected get maxTemperature(): number {
    return 2;
  }

  protected parseProviderError(
    error: unknown,
    context?: { timeout?: number },
  ) {
    return parseError(error, context);
  }

  protected override logDebugInputs(
    systemPrompt: string,
    workspaceContext: string,
    memoryContext: Message[],
  ): void {
    if (!this.config.enableLogging) return;
    console.debug(chalk.bgCyanBright('systemPrompt\n', systemPrompt));
    console.debug(
      chalk.bgBlueBright('workspaceContext\n', workspaceContext),
    );
    console.debug(
      chalk.bgGreen(
        'memoryContext\n',
        memoryContext.map((e) => `[${e.role}] ${JSON.stringify(e.content)}` + '\n'),
      ),
    );
  }

  protected async executeApiRequest(
    requestId: string,
    systemPrompt: string,
    workspaceContext: string,
    memoryContext: Message[],
    tools: ChatCompletionTool[] | undefined,
  ): Promise<ApiResponse> {
    const messages = this.buildMessages(
      systemPrompt,
      workspaceContext,
      memoryContext,
    );

    const startTime = Date.now();

    const completion = await this.withTimeout(
      this.client.chat.completions.create({
        model: this.config.model as string,
        messages,
        tools,
        temperature: this.config.temperature as number | undefined,
        max_tokens: this.config.maxTokens as number | undefined,
      }),
      40000,
    );

    const requestTime = Date.now() - startTime;

    if (!completion) {
      throw new ResponseParsingError('Received empty response from API');
    }

    const response = this.convertOpenAIResponse(completion, requestTime);

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

  private buildMessages(
    systemPrompt: string,
    workspaceContext: string,
    memoryContext: Message[],
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `--- WORKSPACE CONTEXT ---\n${workspaceContext}\n--- END WORKSPACE CONTEXT ---`,
      },
    ];

    // Track tool_use IDs to detect orphaned tool_results
    const seenToolUseIds = new Set<string>();

    for (const msg of memoryContext) {
      // Normalize content: handle legacy string content at runtime
      const blocks: ContentBlock[] = Array.isArray(msg.content)
        ? msg.content
        : [{ type: 'text' as const, text: String(msg.content) }];

      if (msg.role === 'system') {
        const text = blocks
          .filter((b): b is TextContentBlock => b.type === 'text')
          .map(b => b.text)
          .join('\n');
        messages.push({ role: 'user', content: text });
        continue;
      }

      const toolUseBlocks = blocks.filter((b): b is ToolUseBlock => b.type === 'tool_use');
      const toolResultBlocks = blocks.filter((b): b is ToolResultBlock => b.type === 'tool_result')
        .filter((b) => seenToolUseIds.has(b.tool_use_id));
      const textParts = blocks
        .filter((b): b is TextContentBlock => b.type === 'text')
        .map(b => b.text)
        .join('\n');

      // Register tool_use IDs for subsequent tool_result matching
      for (const tu of toolUseBlocks) seenToolUseIds.add(tu.id);

      if (msg.role === 'assistant' && toolUseBlocks.length > 0) {
        messages.push({
          role: 'assistant',
          content: textParts || null,
          tool_calls: toolUseBlocks.map(b => ({
            id: b.id,
            type: 'function' as const,
            function: { name: b.name, arguments: JSON.stringify(b.input) },
          })),
        });
      } else if (toolResultBlocks.length > 0) {
        for (const tr of toolResultBlocks) {
          messages.push({
            role: 'tool',
            tool_call_id: tr.tool_use_id,
            content: tr.content,
          });
        }
      } else if (textParts) {
        messages.push({ role: msg.role, content: textParts });
      }
    }

    // OpenAI requires alternating user/assistant messages.
    // Merge consecutive same-role messages into one.
    return this.mergeConsecutiveMessages(messages);
  }

  /**
   * Merge consecutive messages with the same role to satisfy OpenAI's alternating constraint.
   */
  private mergeConsecutiveMessages(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    if (messages.length === 0) return messages;

    const merged: OpenAI.Chat.ChatCompletionMessageParam[] = [messages[0]];
    for (let i = 1; i < messages.length; i++) {
      const prev = merged[merged.length - 1];
      const curr = messages[i];
      if (prev.role === curr.role && typeof prev.content === 'string' && typeof curr.content === 'string') {
        (prev as any).content = (prev.content as string) + '\n\n' + (curr.content as string);
      } else {
        merged.push(curr);
      }
    }
    return merged;
  }

  private convertOpenAIResponse(
    completion: OpenAI.Chat.ChatCompletion,
    requestTime: number,
  ): ApiResponse {
    try {
      if (!completion.choices || completion.choices.length === 0) {
        throw new ResponseParsingError(
          'No completion choices returned from API',
          completion,
        );
      }

      const choice = completion.choices[0];
      if (!choice) {
        throw new ResponseParsingError(
          'First completion choice is undefined',
          completion,
        );
      }

      const message = choice.message;
      if (!message) {
        throw new ResponseParsingError(
          'Completion message is undefined',
          choice,
        );
      }

      const toolCalls: ToolCall[] = [];
      let textResponse = '';

      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const toolCall of message.tool_calls) {
          if (!toolCall.id) {
            this.logger.warn({ toolCall }, 'Tool call missing ID, skipping');
            continue;
          }

          if (toolCall.type === 'function') {
            if (!toolCall.function?.name) {
              this.logger.warn(
                { toolCall },
                'Function call missing name, skipping',
              );
              continue;
            }

            let args = toolCall.function.arguments;
            if (args) {
              let trimmedArgs = args.trim();
              if (trimmedArgs) {
                try {
                  JSON.parse(trimmedArgs);
                  args = trimmedArgs;
                } catch (e) {
                  const repaired = this.repairJSON(trimmedArgs);
                  if (repaired !== null) {
                    this.logger.warn(
                      {
                        functionName: toolCall.function.name,
                        original: trimmedArgs,
                        repaired,
                      },
                      'Repaired incomplete JSON in function arguments',
                    );
                    args = repaired;
                  } else {
                    this.logger.error(
                      {
                        functionName: toolCall.function.name,
                        args: trimmedArgs,
                      },
                      'Invalid JSON in function arguments',
                    );
                    throw new ResponseParsingError(
                      `Invalid JSON in function arguments for ${toolCall.function.name}: ${trimmedArgs.substring(0, 100)}`,
                      { toolCall, parseError: e },
                    );
                  }
                }
              } else {
                args = '{}';
              }
            }

            toolCalls.push({
              id: toolCall.id,
              call_id: toolCall.id,
              type: 'function_call',
              name: toolCall.function.name,
              arguments: args ?? '{}',
            });
          }
        }
      }

      if (message.content) {
        textResponse = message.content;
      }

      const usage = completion.usage;
      if (!usage) {
        this.logger.warn('Token usage not provided in response');
      }

      const tokenUsage: TokenUsage = {
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
      };

      if (
        tokenUsage.promptTokens < 0 ||
        tokenUsage.completionTokens < 0
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
          ? { originalError: error.message, completion }
          : completion,
      );
    }
  }

  /**
   * Attempt to repair incomplete JSON strings.
   * Handles cases where model returns truncated JSON like "{" or "{foo"
   */
  private repairJSON(str: string): string | null {
    if (str.startsWith('{')) {
      let depth = 0;
      let lastValidPos = 0;

      for (let i = 0; i < str.length; i++) {
        if (str[i] === '{') {
          depth++;
        } else if (str[i] === '}') {
          depth--;
          if (depth === 0) {
            const candidate = str.substring(0, i + 1);
            try {
              JSON.parse(candidate);
              return candidate;
            } catch {
              // Continue searching
            }
          }
        }
      }

      const incomplete = str.trim();
      if (incomplete === '{') {
        return '{}';
      }

      const needed = depth > 0 ? '}'.repeat(depth) : '';
      const candidate = incomplete + needed;

      try {
        JSON.parse(candidate);
        this.logger.debug(
          { original: str, repaired: candidate },
          'Repaired JSON by adding closing braces',
        );
        return candidate;
      } catch {
        return null;
      }
    }

    if (str.startsWith('[')) {
      let depth = 0;
      for (let i = 0; i < str.length; i++) {
        if (str[i] === '[') {
          depth++;
        } else if (str[i] === ']') {
          depth--;
          if (depth === 0) {
            const candidate = str.substring(0, i + 1);
            try {
              JSON.parse(candidate);
              return candidate;
            } catch {
              // Continue
            }
          }
        }
      }
    }

    return null;
  }
}
