/**
 * Expert Builtin - Built-in Expert Definitions
 *
 * Pre-configured experts that can be used in the multi-agent architecture.
 * Each expert represents a specialized capability that can be orchestrated
 * by the Controller Agent.
 */

// Expert definitions
export { default as metaAnalysisArticleRetrievalExpert } from './meta-analysis-article-retrieval.expert.js';

// Re-export for convenience
export { defineExpert, createExpertComponentDefinition, ExpertDefinition } from './ExpertDefinition.js';
export type { ExpertDefinitionConfig } from './ExpertDefinition.js';

/**
 * Get all builtin experts
 */
export function getBuiltinExperts() {
    return [
        // Add all builtin experts here
    ];
}
