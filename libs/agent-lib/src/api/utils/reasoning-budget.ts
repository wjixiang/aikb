import {
    type ModelInfo,
    type ProviderSettings,
    type ReasoningEffortExtended,
} from '../../types';

export const DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS = 16_384;
export const DEFAULT_HYBRID_REASONING_MODEL_THINKING_TOKENS = 8_192;
export const GEMINI_25_PRO_MIN_THINKING_TOKENS = 128;

export const shouldUseReasoningBudget = ({
    model,
    settings,
}: {
    model: ModelInfo;
    settings?: ProviderSettings;
}): boolean =>
    !!model.requiredReasoningBudget ||
    (!!model.supportsReasoningBudget && !!settings?.enableReasoningEffort);

export const shouldUseReasoningEffort = ({
    model,
    settings,
}: {
    model: ModelInfo;
    settings?: ProviderSettings;
}): boolean => {
    // Explicit off switch
    if (settings?.enableReasoningEffort === false) return false;

    // Selected effort from settings or model default
    const selectedEffort = (settings?.reasoningEffort ??
        (model as any).reasoningEffort) as
        | 'disable'
        | 'none'
        | 'minimal'
        | 'low'
        | 'medium'
        | 'high'
        | undefined;

    // "disable" explicitly omits reasoning
    if (selectedEffort === 'disable') return false;

    const cap = model.supportsReasoningEffort as unknown;

    // Capability array: use only if selected is included (treat "none"/"minimal" as valid)
    if (Array.isArray(cap)) {
        return (
            !!selectedEffort &&
            (cap as ReadonlyArray<string>).includes(selectedEffort as string)
        );
    }

    // Boolean capability: true → require a selected effort
    if (model.supportsReasoningEffort === true) {
        return !!selectedEffort;
    }

    // Not explicitly supported: only allow when the model itself defines a default effort
    // Ignore settings-only selections when capability is absent/false
    const modelDefaultEffort = (model as any).reasoningEffort as
        | 'none'
        | 'minimal'
        | 'low'
        | 'medium'
        | 'high'
        | undefined;
    return !!modelDefaultEffort;
};