import { deepSeekModels, deepSeekDefaultModelId } from '../../types';

import type { ApiHandlerOptions } from '../../shared/api';

import type { ApiStreamUsageChunk } from '../transform/stream';
import { getModelParams } from '../transform/model-params';

// Import OpenAiHandler directly from openai.ts to avoid circular dependency
import { OpenAiHandler } from './openai';

export class DeepSeekHandler extends OpenAiHandler {
  constructor(options: ApiHandlerOptions) {
    super({
      ...options,
      openAiApiKey: options.deepSeekApiKey ?? 'not-provided',
      openAiModelId: options.apiModelId ?? deepSeekDefaultModelId,
      openAiBaseUrl: options.deepSeekBaseUrl ?? 'https://api.deepseek.com',
      openAiStreamingEnabled: true,
      includeMaxTokens: true,
    });
  }

  override getModel() {
    const modelId = this.options.openAiModelId ?? deepSeekDefaultModelId;
    const modelInfo =
      this.options.openAiCustomModelInfo ??
      (deepSeekModels as any)[modelId] ??
      (deepSeekModels as any)[deepSeekDefaultModelId];

    const params = getModelParams({
      format: 'openai',
      modelId,
      model: modelInfo,
      settings: this.options,
    });

    return { id: modelId, info: modelInfo, ...params };
  }

  protected override processUsageMetrics(
    usage: any,
    _modelInfo?: any,
  ): ApiStreamUsageChunk {
    return {
      type: 'usage',
      inputTokens: usage?.prompt_tokens || 0,
      outputTokens: usage?.completion_tokens || 0,
      cacheWriteTokens:
        usage?.prompt_tokens_details?.cache_miss_tokens || undefined,
      cacheReadTokens: usage?.prompt_tokens_details?.cached_tokens || undefined,
    };
  }
}
