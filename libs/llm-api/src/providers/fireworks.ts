import {
  type FireworksModelId,
  fireworksDefaultModelId,
  fireworksModels,
} from 'llm-types';

import type { ApiHandlerOptions } from 'llm-shared/api';

import { BaseOpenAiCompatibleProvider } from './base-openai-compatible-provider';

export class FireworksHandler extends BaseOpenAiCompatibleProvider<FireworksModelId> {
  constructor(options: ApiHandlerOptions) {
    super({
      ...options,
      providerName: 'Fireworks',
      baseURL: 'https://api.fireworks.ai/inference/v1',
      apiKey: options.fireworksApiKey,
      defaultProviderModelId: fireworksDefaultModelId,
      providerModels: fireworksModels,
      defaultTemperature: 0.5,
    });
  }
}
