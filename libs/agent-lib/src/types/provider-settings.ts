import { z } from 'zod';

/**
 * constants
 */

export const DEFAULT_CONSECUTIVE_MISTAKE_LIMIT = 3;

/**
 * ProviderName
 */

export const providerNames = [
  'anthropic',
  'openai',
  'openai-native',
  'zai',
  'ollama',
  'lmstudio',
  'vscode-lm',
] as const;

export const providerNamesSchema = z.enum(providerNames);

export type ProviderName = z.infer<typeof providerNamesSchema>;

export const isProviderName = (key: unknown): key is ProviderName =>
  typeof key === 'string' && providerNames.includes(key as ProviderName);

/**
 * ProviderSettings
 */

const baseProviderSettingsSchema = z.object({
  includeMaxTokens: z.boolean().optional(),
  diffEnabled: z.boolean().optional(),
  todoListEnabled: z.boolean().optional(),
  fuzzyMatchThreshold: z.number().optional(),
  modelTemperature: z.number().nullish(),
  rateLimitSeconds: z.number().optional(),
  consecutiveMistakeLimit: z.number().min(0).optional(),
  modelMaxTokens: z.number().optional(),
  toolProtocol: z.enum(['xml', 'native']).optional(),
});

const zaiSchema = baseProviderSettingsSchema.extend({
  apiKey: z.string().optional(),
  apiModelId: z.string().optional(),
  zaiApiLine: z.enum(['international_coding', 'china_coding']).optional(),
});

const anthropicSchema = baseProviderSettingsSchema.extend({
  apiKey: z.string().optional(),
  apiModelId: z.string().optional(),
  anthropicBaseUrl: z.string().optional(),
});

const openAiSchema = baseProviderSettingsSchema.extend({
  apiKey: z.string().optional(),
  apiModelId: z.string().optional(),
  openAiBaseUrl: z.string().optional(),
});

const openAiNativeSchema = baseProviderSettingsSchema.extend({
  apiKey: z.string().optional(),
  apiModelId: z.string().optional(),
  openAiNativeBaseUrl: z.string().optional(),
});

const ollamaSchema = baseProviderSettingsSchema.extend({
  ollamaModelId: z.string().optional(),
  ollamaBaseUrl: z.string().optional(),
});

const lmStudioSchema = baseProviderSettingsSchema.extend({
  lmStudioModelId: z.string().optional(),
  lmStudioBaseUrl: z.string().optional(),
});

const vsCodeLmSchema = baseProviderSettingsSchema.extend({
  vsCodeLmModelSelector: z
    .object({
      vendor: z.string().optional(),
      family: z.string().optional(),
      version: z.string().optional(),
      id: z.string().optional(),
    })
    .optional(),
});

export const providerSettingsSchema = z.object({
  apiProvider: providerNamesSchema.optional(),
  ...zaiSchema.shape,
  ...anthropicSchema.shape,
  ...openAiSchema.shape,
  ...openAiNativeSchema.shape,
  ...ollamaSchema.shape,
  ...lmStudioSchema.shape,
  ...vsCodeLmSchema.shape,
});

export type ProviderSettings = z.infer<typeof providerSettingsSchema>;

export const providerSettingsWithIdSchema = providerSettingsSchema.extend({
  id: z.string().optional(),
});

export type ProviderSettingsWithId = z.infer<
  typeof providerSettingsWithIdSchema
>;

export const PROVIDER_SETTINGS_KEYS = providerSettingsSchema.keyof().options;

/**
 * ModelIdKey
 */

export const modelIdKeys = [
  'apiModelId',
  'ollamaModelId',
  'lmStudioModelId',
] as const satisfies readonly (keyof ProviderSettings)[];

export type ModelIdKey = (typeof modelIdKeys)[number];

export const getModelId = (settings: ProviderSettings): string | undefined => {
  const modelIdKey = modelIdKeys.find((key) => settings[key]);
  return modelIdKey ? settings[modelIdKey] : undefined;
};

/**
 * ANTHROPIC_STYLE_PROVIDERS
 */

export const ANTHROPIC_STYLE_PROVIDERS: ProviderName[] = ['anthropic'];

export const getApiProtocol = (
  provider: ProviderName | undefined,
  modelId?: string,
): 'anthropic' | 'openai' => {
  if (provider && ANTHROPIC_STYLE_PROVIDERS.includes(provider)) {
    return 'anthropic';
  }
  return 'openai';
};
