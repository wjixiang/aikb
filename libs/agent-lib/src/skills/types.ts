import { z } from 'zod';

// Import Tool and ToolSource from statefulContext for use within this file
import type { Tool } from '../statefulContext/types.js';
import type { ToolComponent } from '../statefulContext/toolComponent.js';
import { ToolSource } from '../tools/IToolProvider.js';

// Re-export Tool and ToolSource for external use (single source of truth)
export type { Tool } from '../statefulContext/types.js';
export { ToolSource } from '../tools/IToolProvider.js';
export type { ToolComponent } from '../statefulContext/toolComponent.js';

/**
 * Extended tool registration with source tracking
 */
export interface ToolRegistration {
    /** The tool definition */
    tool: Tool;
    /** Where this tool comes from */
    source: ToolSource;
    /** Component key (for component tools) */
    componentKey?: string;
    /** Skill name (for skill tools) */
    skillName?: string;
    /** Whether the tool is currently enabled/available */
    enabled: boolean;
    /** Handler function for executing the tool */
    handler?: (params: any) => Promise<any>;
}

/**
 * Skill tool state tracking
 */
export interface SkillToolState {
    /** Name of the skill */
    skillName: string;
    /** Tools provided by this skill */
    tools: Tool[];
    /** Whether this skill is currently active */
    active: boolean;
    /** Tool names added to workspace */
    addedToolNames: string[];
}

/**
 * Component definition for metadata
 */
export interface ComponentDefinition {
    /** Unique identifier for the component */
    componentId: string;
    /** Display name for UI */
    displayName: string;
    /** Description of what this component does */
    description: string;
    /** The component instance or a factory function to create it (sync or async) */
    instance: ToolComponent | (() => ToolComponent) | (() => Promise<ToolComponent>);
}

/**
 * Skill definition - provides specialized prompt, tools, and components for specific tasks
 */
export interface Skill {
    /** Unique identifier */
    name: string;
    /** Display name for UI */
    displayName: string;
    /** Description for LLM to understand when to use this skill */
    description: string;
    /** When to use this skill - guidance for LLM on appropriate contexts */
    whenToUse?: string | undefined;
    /** Trigger keywords to help LLM match this skill */
    triggers?: string[] | undefined;

    /** Prompt enhancement */
    prompt: {
        /** Capability description - what the agent can do with this skill */
        capability: string;
        /** Direction - how the agent should approach tasks */
        direction: string;
    };

    /** Tools automatically extracted from components */
    tools?: Tool[] | undefined;

    /** Components managed by this skill */
    /** Tools from these components are automatically included in the skill */
    components?: ComponentDefinition[] | undefined;

    /** Optional: initialization logic when skill is activated */
    onActivate?: (() => Promise<void>) | undefined;

    /** Optional: cleanup logic when skill is deactivated */
    onDeactivate?: (() => Promise<void>) | undefined;

    /** Hook called when a component is activated */
    onComponentActivate?: (component: ToolComponent) => Promise<void> | undefined;

    /** Hook called when a component is deactivated */
    onComponentDeactivate?: (component: ToolComponent) => Promise<void> | undefined;
}

/**
 * Skill summary for LLM selection
 */
export interface SkillSummary {
    name: string;
    displayName: string;
    description: string;
    whenToUse?: string | undefined;
    triggers?: string[] | undefined;
}

/**
 * Result of skill activation
 */
export interface SkillActivationResult {
    success: boolean;
    message: string;
    skill?: Skill;
    /** NEW: Component IDs that were activated */
    addedComponents?: string[] | undefined;
}

/**
 * Skill manager options
 */
export interface SkillManagerOptions {
    /** Callback when skill changes */
    onSkillChange?: (skill: Skill | null) => void;
}

/**
 * Zod schema for get_skill tool parameters
 */
export const getSkillParamsSchema = z.object({
    skill_name: z.string().describe('The name of the skill to activate')
});

export type GetSkillParams = z.infer<typeof getSkillParamsSchema>;
