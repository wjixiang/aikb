import type { ExpertConfig, ExpertComponentDefinition } from '../types.js';

/**
 * Expert Definition Config
 *
 * Type-safe TypeScript definition for Expert (replaces Skill)
 */
export interface ExpertDefinitionConfig {
    /** Unique identifier (kebab-case) */
    expertId: string;
    /** Display name for UI */
    displayName: string;
    /** Brief description for LLM to understand when to use this expert */
    description: string;
    /** When to use this expert - guidance for LLM on appropriate contexts */
    whenToUse?: string;
    /** Semantic version */
    version: string;
    /** Expert category */
    category?: string;
    /** Tags for discovery and matching */
    tags?: string[];
    /** Trigger keywords to help LLM match this expert */
    triggers?: string[];

    /** Responsibilities - when Controller should delegate to this Expert */
    responsibilities: string;
    /** Capabilities - what the Expert can do */
    capabilities: string[];

    /** Prompt enhancement */
    prompt: {
        capability: string;
        direction: string;
    };

    /** Optional components managed by this expert */
    components?: ExpertComponentDefinition[];

    /** Extra system prompt for this expert */
    systemPrompt?: string;

    /** Whether to auto-activate when matched */
    autoActivate?: boolean;

    /** Lifecycle hooks */
    onActivate?: () => Promise<void>;
    onDeactivate?: () => Promise<void>;
    onComponentActivate?: (component: any) => Promise<void>;
    onComponentDeactivate?: (component: any) => Promise<void>;

    /** Additional metadata */
    metadata?: Record<string, string>;
}

/**
 * ExpertDefinition builder class
 */
export class ExpertDefinition {
    private config: ExpertDefinitionConfig;

    constructor(config: ExpertDefinitionConfig) {
        this.config = config;
    }

    /**
     * Build the runtime ExpertConfig object
     */
    build(): ExpertConfig {
        return {
            expertId: this.config.expertId,
            displayName: this.config.displayName,
            description: this.config.description,
            whenToUse: this.config.whenToUse,
            triggers: this.config.triggers ?? this.config.tags,
            responsibilities: this.config.responsibilities,
            capabilities: this.config.capabilities,
            prompt: this.config.prompt,
            components: this.config.components ?? [],
            systemPrompt: this.config.systemPrompt,
            autoActivate: this.config.autoActivate,
            onActivate: this.config.onActivate,
            onDeactivate: this.config.onDeactivate,
            onComponentActivate: this.config.onComponentActivate,
            onComponentDeactivate: this.config.onComponentDeactivate
        };
    }

    /**
     * Get expert metadata
     */
    getMetadata(): {
        expertId: string;
        version: string;
        category?: string;
        tags?: string[];
        metadata?: Record<string, string>;
    } {
        return {
            expertId: this.config.expertId,
            version: this.config.version,
            category: this.config.category,
            tags: this.config.tags,
            metadata: this.config.metadata
        };
    }

    /**
     * Static factory method
     */
    static create(config: ExpertDefinitionConfig): ExpertDefinition {
        return new ExpertDefinition(config);
    }
}

/**
 * Helper function to define an expert in a concise way
 */
export function defineExpert(config: ExpertDefinitionConfig): ExpertConfig {
    return new ExpertDefinition(config).build();
}

/**
 * Helper function to create a component definition for Expert
 * Similar to createComponentDefinition in Skill
 */
export function createExpertComponentDefinition(
    componentId: string,
    displayName: string,
    description: string,
    instanceOrFactory: ExpertComponentDefinition['instance']
): ExpertComponentDefinition {
    return {
        componentId,
        displayName,
        description,
        instance: instanceOrFactory
    };
}
