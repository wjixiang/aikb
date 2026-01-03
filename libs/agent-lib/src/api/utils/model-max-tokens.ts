import {
  type ModelInfo,
  type ProviderSettings,
  ANTHROPIC_DEFAULT_MAX_TOKENS,
  CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS,
} from '../../types';

import {
  shouldUseReasoningBudget,
  DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS,
} from './reasoning-budget';

export const getModelMaxOutputTokens = ({
  modelId,
  model,
  settings,
  format,
}: {
  modelId: string;
  model: ModelInfo;
  settings?: ProviderSettings;
  format?: 'anthropic' | 'openai' | 'gemini' | 'openrouter';
}): number | undefined => {
  // Check for Claude Code specific max output tokens setting
  if (settings?.apiProvider === 'claude-code') {
    return (
      settings.claudeCodeMaxOutputTokens ||
      CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS
    );
  }

  if (shouldUseReasoningBudget({ model, settings })) {
    return (
      settings?.modelMaxTokens || DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS
    );
  }

  const isAnthropicContext =
    modelId.includes('claude') ||
    format === 'anthropic' ||
    (format === 'openrouter' && modelId.startsWith('anthropic/'));

  // For "Hybrid" reasoning models, discard the model's actual maxTokens for Anthropic contexts
  if (model.supportsReasoningBudget && isAnthropicContext) {
    return ANTHROPIC_DEFAULT_MAX_TOKENS;
  }

  // For Anthropic contexts, always ensure a maxTokens value is set
  if (isAnthropicContext && (!model.maxTokens || model.maxTokens === 0)) {
    return ANTHROPIC_DEFAULT_MAX_TOKENS;
  }

  // If model has explicit maxTokens, clamp it to 20% of context window
  // Exception: GPT-5 models should use their exact configured max output tokens
  if (model.maxTokens) {
    // Check if this is a GPT-5 model (case-insensitive)
    const isGpt5Model = modelId.toLowerCase().includes('gpt-5');

    // GPT-5 models bypass the 20% cap and use their full configured max tokens
    if (isGpt5Model) {
      return model.maxTokens;
    }

    // All other models are clamped to 20% of context window
    return Math.min(model.maxTokens, Math.ceil(model.contextWindow * 0.2));
  }

  // For non-Anthropic formats without explicit maxTokens, return undefined
  if (format) {
    return undefined;
  }

  // Default fallback
  return ANTHROPIC_DEFAULT_MAX_TOKENS;
};
