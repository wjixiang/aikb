import {
  type ModelInfo,
  type ProviderSettings,
  type DynamicProvider,
  type LocalProvider,
  isDynamicProvider,
  isLocalProvider,
} from '../types';

// ApiHandlerOptions
// Extend ProviderSettings (minus apiProvider) with handler-specific toggles.
export type ApiHandlerOptions = Omit<ProviderSettings, 'apiProvider'> & {
  /**
   * When true and using OpenAI Responses API models that support reasoning summaries,
   * include reasoning.summary: "auto" so that API returns summaries (we already parse
   * and surface them). Defaults to true; set to false to disable summaries.
   */
  enableResponsesReasoningSummary?: boolean;
  /**
   * Optional override for Ollama's num_ctx parameter.
   * When set, this value will be used in Ollama chat requests.
   * When undefined, Ollama will use the model's default num_ctx from Modelfile.
   */
  ollamaNumCtx?: number;
};

// RouterName

export type RouterName = DynamicProvider | LocalProvider;

export const isRouterName = (value: string): value is RouterName =>
  isDynamicProvider(value) || isLocalProvider(value);

export function toRouterName(value?: string): RouterName {
  if (value && isRouterName(value)) {
    return value;
  }

  throw new Error(`Invalid router name: ${value}`);
}

// RouterModels

export type ModelRecord = Record<string, ModelInfo>;

export type RouterModels = Record<RouterName, ModelRecord>;

// GetModelsOptions

// Allow callers to always pass apiKey/baseUrl without excess property errors,
// while still enforcing required fields per provider where applicable.
type CommonFetchParams = {
  apiKey?: string;
  baseUrl?: string;
};

// Exhaustive, value-level map for all dynamic providers.
// If a new dynamic provider is added in packages/types, this will fail to compile
// until a corresponding entry is added here.
const dynamicProviderExtras = {
  openrouter: {} as {}, // eslint-disable-line @typescript-eslint/no-empty-object-type
  'vercel-ai-gateway': {} as {}, // eslint-disable-line @typescript-eslint/no-empty-object-type
  huggingface: {} as {}, // eslint-disable-line @typescript-eslint/no-empty-object-type
  litellm: {} as { apiKey: string; baseUrl: string },
  deepinfra: {} as { apiKey?: string; baseUrl?: string },
  'io-intelligence': {} as { apiKey: string },
  requesty: {} as { apiKey?: string; baseUrl?: string },
  unbound: {} as { apiKey?: string },
  glama: {} as {}, // eslint-disable-line @typescript-eslint/no-empty-object-type
  ollama: {} as {}, // eslint-disable-line @typescript-eslint/no-empty-object-type
  lmstudio: {} as {}, // eslint-disable-line @typescript-eslint/no-empty-object-type
  roo: {} as { apiKey?: string; baseUrl?: string },
  chutes: {} as { apiKey?: string },
} as const satisfies Record<RouterName, object>;

// Build the dynamic options union from the map, intersected with CommonFetchParams
// so extra fields are always allowed while required ones are enforced.
export type GetModelsOptions = {
  [P in keyof typeof dynamicProviderExtras]: ({
    provider: P;
  } & (typeof dynamicProviderExtras)[P]) &
    CommonFetchParams;
}[RouterName];
