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
