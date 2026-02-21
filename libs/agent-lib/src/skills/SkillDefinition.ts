import { z } from 'zod';
import type { Skill, Tool } from './types.js';

/**
 * TypeScript-based skill definition builder
 *
 * Replaces markdown-based skill definitions with type-safe TypeScript definitions
 */
export interface SkillDefinitionConfig {
    /** Unique identifier (kebab-case) */
    name: string;
    /** Display name for UI */
    displayName: string;
    /** Brief description for LLM to understand when to use this skill */
    description: string;
    /** When to use this skill - guidance for LLM on appropriate contexts */
    whenToUse?: string;
    /** Semantic version */
    version: string;
    /** Skill category */
    category?: string;
    /** Tags for discovery and matching */
    tags?: string[];
    /** Trigger keywords to help LLM match this skill */
    triggers?: string[];

    /** Capability description - what the agent can do with this skill */
    capabilities: string[];
    /** Direction - how the agent should approach tasks */
    workDirection: string;

    /** Optional: skill-specific tools */
    tools?: Tool[];

    /** Optional: initialization logic when skill is activated */
    onActivate?: () => Promise<void>;
    /** Optional: cleanup logic when skill is deactivated */
    onDeactivate?: () => Promise<void>;

    /** Additional metadata */
    metadata?: Record<string, string>;
}

/**
 * Builder class for creating TypeScript-based skills
 */
export class SkillDefinition {
    private config: SkillDefinitionConfig;

    constructor(config: SkillDefinitionConfig) {
        this.config = config;
    }

    /**
     * Build the runtime Skill object
     */
    build(): Skill {
        const capabilityText = this.config.capabilities.length > 0
            ? `You have the following capabilities:\n${this.config.capabilities.map(c => `- ${c}`).join('\n')}`
            : '';

        return {
            name: this.config.name,
            displayName: this.config.displayName,
            description: this.config.description,
            whenToUse: this.config.whenToUse,
            triggers: this.config.triggers ?? this.config.tags,
            prompt: {
                capability: capabilityText,
                direction: this.config.workDirection
            },
            tools: this.config.tools,
            onActivate: this.config.onActivate,
            onDeactivate: this.config.onDeactivate
        };
    }

    /**
     * Get skill metadata
     */
    getMetadata(): {
        name: string;
        version: string;
        category?: string;
        tags?: string[];
        metadata?: Record<string, string>;
    } {
        return {
            name: this.config.name,
            version: this.config.version,
            category: this.config.category,
            tags: this.config.tags,
            metadata: this.config.metadata
        };
    }

    /**
     * Static factory method for creating skill definitions
     */
    static create(config: SkillDefinitionConfig): SkillDefinition {
        return new SkillDefinition(config);
    }
}

/**
 * Helper function to create a tool definition
 */
export function createTool<T extends z.ZodType>(
    toolName: string,
    desc: string,
    paramsSchema: T
): Tool {
    return {
        toolName,
        desc,
        paramsSchema
    };
}

/**
 * Helper function to define a skill in a concise way
 */
export function defineSkill(config: SkillDefinitionConfig): Skill {
    return new SkillDefinition(config).build();
}
