import { z } from 'zod';

/**
 * Tool definition interface
 * Re-exported from agent-lib (formerly stateful-context) for convenience
 */
export interface Tool {
    toolName: string;
    paramsSchema: z.ZodType<any>;
    desc: string;
}

/**
 * Tool source - where a tool originates from
 */
export enum ToolSource {
    /** Always-available component tool */
    COMPONENT = 'component',
    /** Skill-scoped tool (only available when skill is active) */
    SKILL = 'skill',
    /** Global tool (always available) */
    GLOBAL = 'global'
}

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
 * Skill definition - provides specialized prompt and tools for specific tasks
 */
export interface Skill {
    /** Unique identifier */
    name: string;
    /** Display name for UI */
    displayName: string;
    /** Description for LLM to understand when to use this skill */
    description: string;
    /** Trigger keywords to help LLM match this skill */
    triggers?: string[] | undefined;

    /** Prompt enhancement */
    prompt: {
        /** Capability description - what the agent can do with this skill */
        capability: string;
        /** Direction - how the agent should approach tasks */
        direction: string;
    };

    /** Optional: skill-specific tools */
    tools?: Tool[] | undefined;

    /** Optional: initialization logic when skill is activated */
    onActivate?: (() => Promise<void>) | undefined;

    /** Optional: cleanup logic when skill is deactivated */
    onDeactivate?: (() => Promise<void>) | undefined;
}

/**
 * Skill summary for LLM selection
 */
export interface SkillSummary {
    name: string;
    displayName: string;
    description: string;
    triggers?: string[] | undefined;
}

/**
 * Result of skill activation
 */
export interface SkillActivationResult {
    success: boolean;
    message: string;
    skill?: Skill;
    addedTools?: string[] | undefined;
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
