import { z } from 'zod';
import type { Skill, Tool, ComponentDefinition } from './types.js';

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

    /** Optional components managed by this skill */
    /** Tools are automatically extracted from these components */
    components?: ComponentDefinition[];

    /** Optional: initialization logic when skill is activated */
    onActivate?: () => Promise<void>;
    /** Optional: cleanup logic when skill is deactivated */
    onDeactivate?: () => Promise<void>;
    /** Optional hook called when a component is activated */
    onComponentActivate?: (component: any) => Promise<void>;
    /** Optional hook called when a component is deactivated */
    onComponentDeactivate?: (component: any) => Promise<void>;

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

        // Extract tools from components automatically
        const componentTools: Tool[] = [];
        if (this.config.components) {
            for (const component of this.config.components) {
                // Resolve instance based on its type
                const instanceType = typeof component.instance;

                // Skip if it's a factory function (sync or async) - tools extracted at activation
                if (instanceType === 'function') {
                    continue;
                }

                // Skip if it's a DI token (Symbol) - tools extracted at activation via container
                if (instanceType === 'symbol') {
                    continue;
                }

                // For direct instances, extract tools from toolSet
                // Components have a toolSet Map that contains their tools
                if (instanceType === 'object' && component.instance) {
                    const instance = component.instance as any;
                    if ('toolSet' in instance) {
                        const toolSet = instance.toolSet as Map<string, Tool>;
                        toolSet.forEach((tool) => {
                            componentTools.push(tool);
                        });
                    }
                }
            }
        }

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
            tools: componentTools,
            components: this.config.components,
            onActivate: this.config.onActivate,
            onDeactivate: this.config.onDeactivate,
            onComponentActivate: this.config.onComponentActivate,
            onComponentDeactivate: this.config.onComponentDeactivate
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

/**
 * NEW: Helper function to create a component definition
 * Accepts either an instance or a factory function that returns an instance
 * Using a factory function avoids circular dependency issues during SSR
 * The factory function is NOT executed immediately - it's stored and executed later
 */
export function createComponentDefinition(
    componentId: string,
    displayName: string,
    description: string,
    instanceOrFactory: any | (() => any)
): ComponentDefinition {
    return {
        componentId,
        displayName,
        description,
        instance: instanceOrFactory
    };
}
