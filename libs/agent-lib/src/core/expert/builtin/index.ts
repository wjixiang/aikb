/**
 * Expert Builtin - Built-in Expert Definitions
 *
 * Pre-configured experts that can be used in the multi-agent architecture.
 * Each expert represents a specialized capability that can be orchestrated
 * by the Controller Agent.
 *
 * Structure:
 * - Each expert has its own directory under builtin/
 * - Directory contains:
 *   - config.json: Expert metadata (expertId, displayName, description, etc.)
 *   - capability.md: Expert responsibilities and capabilities
 *   - direction.md: Workflow instructions and guidance
 *   - expert.ts: Factory function that loads from external files at runtime
 *
 * Uses fs.readFile to load configuration and markdown instructions at runtime.
 */

// Re-export ExpertDefinition utilities (for defining new experts)
export { defineExpert, createExpertComponentDefinition, ExpertDefinition } from './ExpertDefinition.js';
export type { ExpertDefinitionConfig } from './ExpertDefinition.js';

// Import expert factory functions
import createMetaAnalysisArticleRetrievalExpert from './meta-analysis-article-retrieval/expert.js';
import type { ExpertConfig } from '../types.js';

/**
 * Registry of all builtin experts
 * Maps expertId to factory function (runtime loading)
 */
export const builtinExperts: Record<string, () => ExpertConfig> = {
    'meta-analysis-article-retrieval': createMetaAnalysisArticleRetrievalExpert
};

/**
 * Get all builtin expert configurations
 * Calls each factory function to load at runtime
 */
export function getBuiltinExperts(): ExpertConfig[] {
    return Object.values(builtinExperts).map(factory => factory());
}

/**
 * Get a specific builtin expert by ID
 * Calls the factory function to load at runtime
 */
export function getBuiltinExpert(expertId: string): ExpertConfig | undefined {
    const factory = builtinExperts[expertId];
    if (factory) {
        return factory();
    }
    return undefined;
}

// Export individual experts for convenience
export { default as metaAnalysisArticleRetrievalExpert } from './meta-analysis-article-retrieval/expert.js';
