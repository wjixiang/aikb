import { injectable } from 'inversify';
import type { Tool } from '../statefulContext/types.js';
import type { IToolProvider } from './IToolProvider.js';
import { ToolSource } from './IToolProvider.js';
import type {
    IToolManager,
    ToolRegistration,
    ToolSourceInfo,
    ToolAvailabilityCallback,
    UnsubscribeFn,
} from './IToolManager.js';
import {
    ToolNotFoundError,
    ToolDisabledError,
    ProviderNotFoundError,
} from './IToolManager.js';
import type { Skill } from '../skills/types.js';
import type { IToolStateStrategy, IToolStateStrategyFactory } from './state/IToolStateStrategy.js';
import { NoSkillStrategy, ToolStateStrategyFactory } from './state/IToolStateStrategy.js';

/**
 * Central tool manager implementation
 *
 * This class is responsible for:
 * - Registering tool providers
 * - Maintaining a registry of all tools
 * - Managing tool enabled/disabled state
 * - Managing tool state strategies (skill-based tool control)
 * - Executing tool calls
 * - Notifying subscribers of tool availability changes
 */
@injectable()
export class ToolManager implements IToolManager {
    private providers: Map<string, IToolProvider>;
    private toolRegistry: Map<string, ToolRegistration>;
    private availabilityCallbacks: Set<ToolAvailabilityCallback>;
    private currentStrategy: IToolStateStrategy;
    private strategyFactory: IToolStateStrategyFactory;

    constructor() {
        this.providers = new Map();
        this.toolRegistry = new Map();
        this.availabilityCallbacks = new Set();
        // Default to no-skill strategy (all tools enabled)
        this.currentStrategy = new NoSkillStrategy();
        this.strategyFactory = new ToolStateStrategyFactory();
    }

    /**
     * Register a tool provider
     * @param provider - The provider to register
     */
    registerProvider(provider: IToolProvider): void {
        if (this.providers.has(provider.id)) {
            console.warn(`[ToolManager] Provider "${provider.id}" is already registered. Overwriting.`);
        }

        this.providers.set(provider.id, provider);

        // IMPORTANT: Handle both sync and async getTools() properly
        // Fire and forget for async, but for sync providers like ComponentToolProvider,
        // we need to ensure tools are registered immediately
        const toolsPromise = provider.getTools();

        if (toolsPromise instanceof Promise) {
            // Async provider - handle in background
            toolsPromise.then(tools => this._registerToolsFromProvider(provider, tools))
                .catch(error => console.error(`[ToolManager] Failed to refresh tools from provider "${provider.id}":`, error));
        } else {
            // Sync provider - register immediately
            this._registerToolsFromProvider(provider, toolsPromise);
        }

        this.notifyAvailabilityChange();
    }

    /**
     * Internal method to register tools from a provider
     * @param provider - The provider
     * @param tools - The tools to register
     */
    private _registerToolsFromProvider(provider: IToolProvider, tools: any[]): void {
        const source = this.inferSourceFromProvider(provider);

        for (const tool of tools) {
            // Component tools are disabled by default and only enabled when their skill is active
            // Global tools are always enabled
            const enabledByDefault = source !== ToolSource.COMPONENT;

            this.toolRegistry.set(tool.toolName, {
                tool,
                source,
                providerId: provider.id,
                componentKey: this.extractComponentKey(provider.id),
                enabled: enabledByDefault,
                handler: async (params: any) => provider.executeTool(tool.toolName, params),
            });
        }
    }

    /**
     * Unregister a tool provider by ID
     * @param providerId - The provider ID to unregister
     * @returns true if provider was found and unregistered
     */
    unregisterProvider(providerId: string): boolean {
        const provider = this.providers.get(providerId);
        if (!provider) {
            return false;
        }

        // Remove all tools from this provider
        for (const [toolName, registration] of this.toolRegistry.entries()) {
            if (registration.providerId === providerId) {
                this.toolRegistry.delete(toolName);
            }
        }

        this.providers.delete(providerId);
        this.notifyAvailabilityChange();
        return true;
    }

    /**
     * Infer tool source from provider ID
     */
    private inferSourceFromProvider(provider: IToolProvider): ToolSource {
        if (provider.id.includes('global')) return ToolSource.GLOBAL;
        if (provider.id.includes('component')) return ToolSource.COMPONENT;
        if (provider.id.includes('skill')) return ToolSource.SKILL;
        return ToolSource.UNKNOWN;
    }

    /**
     * Extract component key from provider ID
     */
    private extractComponentKey(providerId: string): string | undefined {
        const match = providerId.match(/component:(.+)/);
        return match ? match[1] : undefined;
    }

    /**
     * Get all registered tools (including disabled)
     * @returns Array of tool registrations
     */
    getAllTools(): ToolRegistration[] {
        return Array.from(this.toolRegistry.values());
    }

    /**
     * Get available (enabled) tools
     * @returns Array of enabled tool definitions
     */
    getAvailableTools(): Tool[] {
        return Array.from(this.toolRegistry.values())
            .filter(reg => reg.enabled)
            .map(reg => reg.tool);
    }

    /**
     * Execute a tool call
     * @param name - The tool name to execute
     * @param params - The parameters to pass to the tool
     * @returns Promise resolving to the tool result
     */
    async executeTool(name: string, params: any): Promise<any> {
        const registration = this.toolRegistry.get(name);
        if (!registration) {
            throw new ToolNotFoundError(name);
        }

        if (!registration.enabled) {
            throw new ToolDisabledError(name);
        }

        const provider = this.providers.get(registration.providerId);
        if (!provider) {
            throw new ProviderNotFoundError(registration.providerId);
        }

        return await provider.executeTool(name, params);
    }

    /**
     * Enable a tool
     * @param name - The tool name to enable
     * @returns true if tool was found and enabled
     */
    enableTool(name: string): boolean {
        const registration = this.toolRegistry.get(name);
        if (!registration) {
            return false;
        }
        registration.enabled = true;
        this.notifyAvailabilityChange();
        return true;
    }

    /**
     * Disable a tool
     * @param name - The tool name to disable
     * @returns true if tool was found and disabled
     */
    disableTool(name: string): boolean {
        const registration = this.toolRegistry.get(name);
        if (!registration) {
            return false;
        }
        registration.enabled = false;
        this.notifyAvailabilityChange();
        return true;
    }

    /**
     * Check if a tool is enabled
     * @param name - The tool name to check
     * @returns true if tool exists and is enabled
     */
    isToolEnabled(name: string): boolean {
        const registration = this.toolRegistry.get(name);
        return registration?.enabled ?? false;
    }

    /**
     * Get tool source information
     * @param name - The tool name to look up
     * @returns Tool source info or null if not found
     */
    getToolSource(name: string): ToolSourceInfo | null {
        const registration = this.toolRegistry.get(name);
        if (!registration) {
            return null;
        }
        return {
            source: registration.source,
            providerId: registration.providerId,
            componentKey: registration.componentKey,
        };
    }

    /**
     * Subscribe to tool availability changes
     * @param callback - Function to call when tools change
     * @returns Unsubscribe function
     */
    onAvailabilityChange(callback: ToolAvailabilityCallback): UnsubscribeFn {
        this.availabilityCallbacks.add(callback);
        return () => {
            this.availabilityCallbacks.delete(callback);
        };
    }

    /**
     * Notify all subscribers of tool availability change
     * Called internally when tools are added/removed/enabled/disabled
     */
    notifyAvailabilityChange(): void {
        const availableTools = this.getAvailableTools();
        for (const callback of this.availabilityCallbacks) {
            try {
                callback(availableTools);
            } catch (error) {
                console.error('[ToolManager] Error in availability callback:', error);
            }
        }
    }

    /**
     * Get a provider by ID (for testing/debugging)
     */
    getProvider(providerId: string): IToolProvider | undefined {
        return this.providers.get(providerId);
    }

    /**
     * Get all provider IDs (for testing/debugging)
     */
    getProviderIds(): string[] {
        return Array.from(this.providers.keys());
    }

    /**
     * Get tool count (for testing/debugging)
     */
    getToolCount(): { total: number; enabled: number; disabled: number } {
        const allTools = this.getAllTools();
        return {
            total: allTools.length,
            enabled: allTools.filter(t => t.enabled).length,
            disabled: allTools.filter(t => !t.enabled).length,
        };
    }

    // ==================== Strategy Management (merged from ToolStateManager) ====================

    /**
     * Get the current state strategy
     * @returns The current tool state strategy
     */
    getCurrentStrategy(): IToolStateStrategy {
        return this.currentStrategy;
    }

    /**
     * Set strategy based on active skill
     * This method replaces the separate ToolStateManager.setStrategy()
     * @param skill - The active skill (null for no skill)
     */
    setStrategy(skill: Skill | null): void {
        this.currentStrategy = this.strategyFactory.createStrategy(skill);
        console.log(`[ToolManager] Strategy changed to: ${this.currentStrategy.strategyName}`);
    }

    /**
     * Apply current strategy to enable/disable tools
     * This method replaces the separate ToolStateManager.applyStrategy()
     *
     * This enables/disables component tools based on the strategy.
     * Global tools are always left enabled.
     */
    applyStrategy(): void {
        const allTools = this.getAllTools();

        for (const registration of allTools) {
            // Only apply strategy to component tools, not global tools
            if (registration.source === ToolSource.COMPONENT) {
                const toolName = registration.tool.toolName;
                const shouldBeEnabled = this.currentStrategy.shouldEnableTool(toolName);

                if (shouldBeEnabled && !registration.enabled) {
                    registration.enabled = true;
                    console.log(`[ToolManager] Enabled component tool: ${toolName}`);
                } else if (!shouldBeEnabled && registration.enabled) {
                    registration.enabled = false;
                    console.log(`[ToolManager] Disabled component tool: ${toolName}`);
                }
            }
        }

        console.log(`[ToolManager] Strategy "${this.currentStrategy.strategyName}" applied`);
        this.notifyAvailabilityChange();
    }

    /**
     * Get the current strategy name (for debugging)
     * @returns The name of the current strategy
     */
    getStrategyName(): string {
        return this.currentStrategy.strategyName;
    }

    /**
     * Set a custom strategy factory (for testing or advanced use cases)
     * @param factory - The custom strategy factory to use
     */
    setStrategyFactory(factory: IToolStateStrategyFactory): void {
        this.strategyFactory = factory;
    }
}
