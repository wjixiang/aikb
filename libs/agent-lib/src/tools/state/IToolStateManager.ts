import type { Skill } from '../../skills/types.js';
import type { IToolStateStrategy } from './IToolStateStrategy.js';
import type { IToolManager } from '../IToolManager.js';

/**
 * Tool state manager interface
 * 
 * The state manager is responsible for:
 * - Maintaining the current tool state strategy
 * - Applying the strategy to enable/disable tools
 */
export interface IToolStateManager {
    /**
     * Get the current state strategy
     */
    getCurrentStrategy(): IToolStateStrategy;

    /**
     * Set strategy based on active skill
     * @param skill - The active skill (null for no skill)
     */
    setStrategy(skill: Skill | null): void;

    /**
     * Apply current strategy to tool manager
     * This enables/disables tools based on the strategy
     * @param toolManager - The tool manager to apply the strategy to
     */
    applyStrategy(toolManager: IToolManager): void;

    /**
     * Get the current strategy name (for debugging)
     */
    getStrategyName(): string;
}
