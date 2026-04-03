// Re-export from llm-api-client (moved to independent package)
export {
  providerNames,
  providerNamesSchema,
  isProviderName,
  providerSettingsSchema,
  providerSettingsWithIdSchema,
  PROVIDER_SETTINGS_KEYS,
  modelIdKeys,
  getModelId,
  ANTHROPIC_STYLE_PROVIDERS,
  getApiProtocol,
} from 'llm-api-client';

export type {
  ProviderName,
  ProviderSettings,
  ProviderSettingsWithId,
  ModelIdKey,
} from 'llm-api-client';
