import type { Skill } from '../../skills/types.js';

/**
 * Tool state strategy interface
 * 
 * Strategies determine which component tools should be enabled/disabled
 * based on the current skill state.
 */
export interface IToolStateStrategy {
    /**
     * Get the list of tool names that should be enabled
     * @returns Array of tool names to enable (empty means all)
     */
    getEnabledTools(): string[];

    /**
     * Check if a specific tool should be enabled
     * @param toolName - The tool name to check
     * @returns true if the tool should be enabled
     */
    shouldEnableTool(toolName: string): boolean;

    /**
     * Get the current strategy name (for debugging)
     */
    readonly strategyName: string;
}

/**
 * No-skill strategy - all component tools are enabled
 * 
 * This is the default strategy when no skill is active.
 */
export class NoSkillStrategy implements IToolStateStrategy {
    readonly strategyName = 'no-skill';

    /**
     * Get the list of tool names that should be enabled
     * Empty array means "all tools"
     */
    getEnabledTools(): string[] {
        return [];
    }

    /**
     * All tools should be enabled when no skill is active
     */
    shouldEnableTool(_toolName: string): boolean {
        return true;
    }
}

/**
 * Skill-based strategy - only tools defined in the skill are enabled
 */
export class SkillBasedStrategy implements IToolStateStrategy {
    readonly strategyName: string;

    constructor(private skill: Skill) {
        this.strategyName = skill.name;
    }

    /**
     * Get the list of tool names from the skill
     */
    getEnabledTools(): string[] {
        return this.skill.tools?.map(t => t.toolName) ?? [];
    }

    /**
     * Check if a tool is in the skill's tool list
     */
    shouldEnableTool(toolName: string): boolean {
        return this.skill.tools?.some(t => t.toolName === toolName) ?? false;
    }
}

/**
 * Factory interface for creating strategies
 */
export interface IToolStateStrategyFactory {
    /**
     * Create a strategy based on the active skill
     * @param skill - The active skill (null for no skill)
     * @returns The appropriate strategy
     */
    createStrategy(skill: Skill | null): IToolStateStrategy;
}

/**
 * Default strategy factory implementation
 */
export class ToolStateStrategyFactory implements IToolStateStrategyFactory {
    createStrategy(skill: Skill | null): IToolStateStrategy {
        if (skill === null) {
            return new NoSkillStrategy();
        }
        return new SkillBasedStrategy(skill);
    }
}
