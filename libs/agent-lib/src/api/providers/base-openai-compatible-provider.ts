import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from 'openai';

import type { ModelInfo } from '../../types';

import { type ApiHandlerOptions } from '../../shared/api';
import { XmlMatcher } from '../../utils/xml-matcher';
import { ApiStream, ApiStreamUsageChunk } from '../transform/stream';
import { convertToOpenAiMessages } from '../transform/openai-format';

import type {
  SingleCompletionHandler,
  ApiHandlerCreateMessageMetadata,
} from '../types';
import { getModelMaxOutputTokens } from '../utils/model-max-tokens';
import { DEFAULT_HEADERS } from './constants';
import { BaseProvider } from './base-provider';
import { handleOpenAIError } from './utils/openai-error-handler';
import { calculateApiCostOpenAI } from '../../shared/cost';
import { getApiRequestTimeout } from './utils/timeout-config';

type BaseOpenAiCompatibleProviderOptions<ModelName extends string> =
  ApiHandlerOptions & {
    providerName: string;
    baseURL: string;
    defaultProviderModelId: ModelName;
    providerModels: Record<ModelName, ModelInfo>;
    defaultTemperature?: number;
  };

export abstract class BaseOpenAiCompatibleProvider<ModelName extends string>
  extends BaseProvider
  implements SingleCompletionHandler {
  protected readonly providerName: string;
  protected readonly baseURL: string;
  protected readonly defaultTemperature: number;
  protected readonly defaultProviderModelId: ModelName;
  protected readonly providerModels: Record<ModelName, ModelInfo>;

  protected readonly options: ApiHandlerOptions;

  protected client: OpenAI;

  constructor({
    providerName,
    baseURL,
    defaultProviderModelId,
    providerModels,
    defaultTemperature,
    ...options
  }: BaseOpenAiCompatibleProviderOptions<ModelName>) {
    super();

    this.providerName = providerName;
    this.baseURL = baseURL;
    this.defaultProviderModelId = defaultProviderModelId;
    this.providerModels = providerModels;
    this.defaultTemperature = defaultTemperature ?? 0;

    this.options = options;

    if (!this.options['apiKey']) {
      throw new Error('API key is required');
    }

    this.client = new OpenAI({
      baseURL,
      apiKey: this.options['apiKey'],
      defaultHeaders: DEFAULT_HEADERS,
      timeout: getApiRequestTimeout(),
    });
  }

  protected createStream(
    systemPrompt: string,
    messages: Anthropic.Messages.MessageParam[],
    metadata?: ApiHandlerCreateMessageMetadata,
    requestOptions?: OpenAI.RequestOptions,
  ) {
    console.log('[DEBUG] createStream - START');
    const { id: model, info } = this.getModel();
    console.log('[DEBUG] Model:', model, 'Info:', JSON.stringify(info).substring(0, 200));

    // Centralized cap: clamp to 20% of the context window (unless provider-specific exceptions apply)
    const max_tokens =
      getModelMaxOutputTokens({
        modelId: model,
        model: info,
        settings: this.options,
        format: 'openai',
      }) ?? undefined;
    console.log('[DEBUG] max_tokens:', max_tokens);

    const temperature =
      this.options['modelTemperature'] ?? this.defaultTemperature;
    console.log('[DEBUG] temperature:', temperature);

    const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming =
    {
      model,
      max_tokens,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        ...convertToOpenAiMessages(messages),
      ],
      stream: true,
      stream_options: { include_usage: true },
      ...(metadata?.tools && {
        tools: this.convertToolsForOpenAI(metadata.tools),
      }),
      ...(metadata?.tool_choice && { tool_choice: metadata.tool_choice }),
      ...(metadata?.toolProtocol === 'native' && {
        parallel_tool_calls: metadata.parallelToolCalls ?? false,
      }),
    };
    console.log('[DEBUG] Params constructed, messages count:', params.messages.length);

    // Add thinking parameter if reasoning is enabled and model supports it
    if (this.options['enableReasoningEffort'] && info.supportsReasoningBinary) {
      (params as any).thinking = { type: 'enabled' };
    }

    try {
      console.log('[DEBUG] Calling this.client.chat.completions.create...');
      console.log('[DEBUG] Params:', JSON.stringify(params).substring(0, 500));

      // Add timeout to stream creation to prevent hanging
      const timeoutMs = 120000; // 2 minutes
      const startTime = Date.now();

      const streamPromise = this.client.chat.completions.create(params, requestOptions);

      // Race the stream creation with a timeout
      const stream = await Promise.race([
        streamPromise,
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Stream creation timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);

      const elapsed = Date.now() - startTime;
      console.log(`[DEBUG] Stream created successfully from OpenAI client after ${elapsed}ms`);
      console.log('[DEBUG] Stream type:', typeof stream);
      console.log('[DEBUG] Stream constructor:', stream?.constructor?.name);
      console.log('[DEBUG] Stream is Promise:', stream instanceof Promise);
      console.log('[DEBUG] Stream then:', typeof stream.then);
      return stream;
    } catch (error) {
      console.error('[DEBUG] Error creating stream from OpenAI client:', error);
      throw handleOpenAIError(error, this.providerName);
    }
  }

  override async *createMessage(
    systemPrompt: string,
    messages: Anthropic.Messages.MessageParam[],
    metadata?: ApiHandlerCreateMessageMetadata,
  ): ApiStream {
    console.log('[DEBUG] BaseOpenAiCompatibleProvider.createMessage - START');
    console.log('[DEBUG] System prompt length:', systemPrompt.length);
    console.log('[DEBUG] Messages count:', messages.length);

    console.log('[DEBUG] About to call createStream...');
    const startTime = Date.now();
    const stream = await this.createStream(systemPrompt, messages, metadata);
    const elapsed = Date.now() - startTime;
    console.log(`[DEBUG] Stream created successfully after ${elapsed}ms`);
    console.log('[DEBUG] Stream value:', stream);

    const matcher = new XmlMatcher(
      'think',
      (chunk) =>
        ({
          type: chunk.matched ? 'reasoning' : 'text',
          text: chunk.data,
        }) as const,
    );

    let lastUsage: OpenAI.CompletionUsage | undefined;
    let chunkCount = 0;

    console.log('[DEBUG] Starting to iterate stream...');
    console.log('[DEBUG] Stream object:', typeof stream, stream);

    try {
      for await (const chunk of stream) {
        chunkCount++;
        console.log(`[DEBUG] Received chunk #${chunkCount}:`, JSON.stringify(chunk).substring(0, 300));
        // Check for provider-specific error responses (e.g., MiniMax base_resp)
        const chunkAny = chunk as any;
        if (
          chunkAny.base_resp?.status_code &&
          chunkAny.base_resp.status_code !== 0
        ) {
          throw new Error(
            `${this.providerName} API Error (${chunkAny.base_resp.status_code}): ${chunkAny.base_resp.status_msg || 'Unknown error'}`,
          );
        }

        const delta = chunk.choices?.[0]?.delta;

        if (delta?.content) {
          for (const processedChunk of matcher.update(delta.content)) {
            yield processedChunk;
          }
        }

        if (delta) {
          for (const key of ['reasoning_content', 'reasoning'] as const) {
            if (key in delta) {
              const reasoning_content =
                ((delta as any)[key] as string | undefined) || '';
              if (reasoning_content?.trim()) {
                yield { type: 'reasoning', text: reasoning_content };
              }
              break;
            }
          }
        }

        // Emit raw tool call chunks - NativeToolCallParser handles state management
        if (delta?.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            yield {
              type: 'tool_call_partial',
              index: toolCall.index,
              id: toolCall.id,
              name: toolCall.function?.name,
              arguments: toolCall.function?.arguments,
            };
          }
        }

        if (chunk.usage) {
          lastUsage = chunk.usage;
        }
      }

      if (lastUsage) {
        console.log('[DEBUG] Yielding usage chunk');
        yield this.processUsageMetrics(lastUsage, this.getModel().info);
      }

      // Process any remaining content
      console.log('[DEBUG] Processing remaining content with matcher.final()');
      const finalChunks = matcher.final();
      console.log('[DEBUG] Final chunks count:', finalChunks.length);
      for (const processedChunk of finalChunks) {
        yield processedChunk;
      }

      console.log(`[DEBUG] createMessage completed, total chunks yielded: ${chunkCount}`);
    } catch (error) {
      console.error('[DEBUG] Error during stream iteration:', error);
      throw error;
    }
  }

  protected processUsageMetrics(
    usage: any,
    modelInfo?: any,
  ): ApiStreamUsageChunk {
    const inputTokens = usage?.prompt_tokens || 0;
    const outputTokens = usage?.completion_tokens || 0;
    const cacheWriteTokens =
      usage?.prompt_tokens_details?.cache_write_tokens || 0;
    const cacheReadTokens = usage?.prompt_tokens_details?.cached_tokens || 0;

    const { totalCost } = modelInfo
      ? calculateApiCostOpenAI(
        modelInfo,
        inputTokens,
        outputTokens,
        cacheWriteTokens,
        cacheReadTokens,
      )
      : { totalCost: 0 };

    return {
      type: 'usage',
      inputTokens,
      outputTokens,
      cacheWriteTokens: cacheWriteTokens || undefined,
      cacheReadTokens: cacheReadTokens || undefined,
      totalCost,
    };
  }

  async completePrompt(prompt: string): Promise<string> {
    const { id: modelId, info: modelInfo } = this.getModel();

    const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
    };

    // Add thinking parameter if reasoning is enabled and model supports it
    if (
      this.options['enableReasoningEffort'] &&
      modelInfo.supportsReasoningBinary
    ) {
      (params as any).thinking = { type: 'enabled' };
    }

    try {
      const response = await this.client.chat.completions.create(params);

      // Check for provider-specific error responses (e.g., MiniMax base_resp)
      const responseAny = response as any;
      if (
        responseAny.base_resp?.status_code &&
        responseAny.base_resp.status_code !== 0
      ) {
        throw new Error(
          `${this.providerName} API Error (${responseAny.base_resp.status_code}): ${responseAny.base_resp.status_msg || 'Unknown error'}`,
        );
      }

      return response.choices?.[0]?.message.content || '';
    } catch (error) {
      throw handleOpenAIError(error, this.providerName);
    }
  }

  override getModel() {
    const id =
      this.options['apiModelId'] &&
        this.options['apiModelId'] in this.providerModels
        ? (this.options['apiModelId'] as ModelName)
        : this.defaultProviderModelId;

    return { id, info: this.providerModels[id] };
  }
}
