import {
  internationalZAiModels,
  mainlandZAiModels,
  internationalZAiDefaultModelId,
  mainlandZAiDefaultModelId,
  type ModelInfo,
  ZAI_DEFAULT_TEMPERATURE,
  zaiApiLineConfigs,
} from '../../types';

import type { ApiHandlerOptions } from '../index';

import { BaseOpenAiCompatibleProvider } from './base-openai-compatible-provider';

export class ZAiHandler extends BaseOpenAiCompatibleProvider<string> {
  constructor(options: ApiHandlerOptions) {
    const isChina =
      zaiApiLineConfigs[options.zaiApiLine ?? 'international_coding'].isChina;
    const models = (isChina
      ? mainlandZAiModels
      : internationalZAiModels) as unknown as Record<string, ModelInfo>;
    const defaultModelId = (
      isChina ? mainlandZAiDefaultModelId : internationalZAiDefaultModelId
    ) as string;

    const apiLine = options.zaiApiLine ?? 'international_coding';
    const config = zaiApiLineConfigs[apiLine];
    const finalApiKey = options.zaiApiKey ?? options.apiKey ?? 'not-provided';

    super({
      ...options,
      providerName: 'Z.ai',
      baseURL: config.baseUrl,
      apiKey: finalApiKey,
      defaultProviderModelId: defaultModelId,
      providerModels: models,
      defaultTemperature: ZAI_DEFAULT_TEMPERATURE,
    });
  }
}
