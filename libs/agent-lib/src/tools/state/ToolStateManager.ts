import { injectable } from 'inversify';
import type { Skill } from '../../skills/types.js';
import type { IToolStateStrategy, IToolStateStrategyFactory } from './IToolStateStrategy.js';
import type { IToolStateManager } from './IToolStateManager.js';
import type { IToolManager } from '../IToolManager.js';
import { ToolSource } from '../IToolProvider.js';
import { NoSkillStrategy, ToolStateStrategyFactory } from './IToolStateStrategy.js';

/**
 * Tool state manager implementation
 * 
 * This class manages the tool state strategy and applies it to enable/disable
 * component tools based on the active skill.
 */
@injectable()
export class ToolStateManager implements IToolStateManager {
    private currentStrategy: IToolStateStrategy;
    private strategyFactory: IToolStateStrategyFactory;

    constructor() {
        // Default to no-skill strategy (all tools enabled)
        this.currentStrategy = new NoSkillStrategy();
        this.strategyFactory = new ToolStateStrategyFactory();
    }

    /**
     * Get the current state strategy
     */
    getCurrentStrategy(): IToolStateStrategy {
        return this.currentStrategy;
    }

    /**
     * Set strategy based on active skill
     * @param skill - The active skill (null for no skill)
     */
    setStrategy(skill: Skill | null): void {
        this.currentStrategy = this.strategyFactory.createStrategy(skill);
        console.log(`[ToolStateManager] Strategy changed to: ${this.currentStrategy.strategyName}`);
    }

    /**
     * Apply current strategy to tool manager
     * 
     * This enables/disables component tools based on the strategy.
     * Global tools are always left enabled.
     * 
     * @param toolManager - The tool manager to apply the strategy to
     */
    applyStrategy(toolManager: IToolManager): void {
        const allTools = toolManager.getAllTools();

        for (const registration of allTools) {
            // Only apply strategy to component tools, not global tools
            if (registration.source === ToolSource.COMPONENT) {
                const toolName = registration.tool.toolName;
                const shouldBeEnabled = this.currentStrategy.shouldEnableTool(toolName);

                if (shouldBeEnabled && !registration.enabled) {
                    toolManager.enableTool(toolName);
                    console.log(`[ToolStateManager] Enabled component tool: ${toolName}`);
                } else if (!shouldBeEnabled && registration.enabled) {
                    toolManager.disableTool(toolName);
                    console.log(`[ToolStateManager] Disabled component tool: ${toolName}`);
                }
            }
        }

        console.log(`[ToolStateManager] Strategy "${this.currentStrategy.strategyName}" applied`);
    }

    /**
     * Get the current strategy name (for debugging)
     */
    getStrategyName(): string {
        return this.currentStrategy.strategyName;
    }

    /**
     * Set a custom strategy factory (for testing or advanced use cases)
     */
    setStrategyFactory(factory: IToolStateStrategyFactory): void {
        this.strategyFactory = factory;
    }
}
