import { injectable, inject, optional } from 'inversify';
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
} from './tool.errors.js';
import type { SkillManager } from '../skills/SkillManager.js';
import { TYPES } from '../di/types.js';

/**
 * Central tool manager implementation
 *
 * Tool availability is determined dynamically by checking SkillManager:
 * - Global tools: always available
 * - Component tools: available only when their skill is active
 * 
 * Note: Skills can only define tools through their components, not directly.
 */
@injectable()
export class ToolManager implements IToolManager {
    private providers: Map<string, IToolProvider>;
    private toolRegistry: Map<string, ToolRegistration>;
    private availabilityCallbacks: Set<ToolAvailabilityCallback>;
    private skillManager: SkillManager | null = null;

    constructor(
        @inject(TYPES.SkillManager) @optional() skillManager?: SkillManager
    ) {
        this.providers = new Map();
        this.toolRegistry = new Map();
        this.availabilityCallbacks = new Set();
        this.skillManager = skillManager ?? null;
    }

    /**
     * Set the SkillManager reference after construction
     * This is called by VirtualWorkspace to provide the SkillManager instance
     */
    setSkillManager(skillManager: SkillManager): void {
        this.skillManager = skillManager;
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

        // Handle both sync and async getTools() properly
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
    private _registerToolsFromProvider(provider: IToolProvider, tools: Tool[]): void {
        const source = this.inferSourceFromProvider(provider);

        for (const tool of tools) {
            this.toolRegistry.set(tool.toolName, {
                tool,
                source,
                providerId: provider.id,
                componentKey: this.extractComponentKey(provider.id),
                // Note: enabled state is now determined dynamically in isToolEnabled/getAvailableTools
                // We store a default but it's not used for skill-based tools
                enabled: source === ToolSource.GLOBAL,
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
     * Get available (enabled) tools based on current skill state
     * - Global tools: always available
     * - Component/Skill tools: available only when their skill is active
     * @returns Array of enabled tool definitions
     */
    getAvailableTools(): Tool[] {
        const activeSkill = this.skillManager?.getActiveSkill() ?? null;

        return Array.from(this.toolRegistry.values())
            .filter(reg => this.isToolEnabled(reg.tool.toolName))
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

        if (!this.isToolEnabled(name)) {
            throw new ToolDisabledError(name);
        }

        const provider = this.providers.get(registration.providerId);
        if (!provider) {
            throw new ProviderNotFoundError(registration.providerId);
        }

        return await provider.executeTool(name, params);
    }

    /**
     * Enable a tool (for backward compatibility)
     * Note: For skill-based tools, this doesn't persist - availability is checked dynamically
     * @param name - The tool name to enable
     * @returns true if tool was found
     */
    enableTool(name: string): boolean {
        const registration = this.toolRegistry.get(name);
        if (!registration) {
            return false;
        }
        // For backward compatibility, but skill-based tools will still be dynamically controlled
        registration.enabled = true;
        this.notifyAvailabilityChange();
        return true;
    }

    /**
     * Disable a tool (for backward compatibility)
     * Note: For skill-based tools, this doesn't persist - availability is checked dynamically
     * @param name - The tool name to disable
     * @returns true if tool was found
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
     * Check if a tool is enabled based on current skill state
     * - Global tools: always enabled
     * - Component tools: enabled only when their skill is active
     * @param name - The tool name to check
     * @returns true if tool exists and is enabled
     */
    isToolEnabled(name: string): boolean {
        const registration = this.toolRegistry.get(name);
        if (!registration) {
            return false;
        }

        // Global tools are always enabled
        if (registration.source === ToolSource.GLOBAL) {
            return true;
        }

        // Component tools are only enabled when their skill is active
        // Use skillManager's getActiveComponentsWithIds() to get resolved components
        const activeComponents = this.skillManager?.getActiveComponentsWithIds() ?? [];

        // Check if this tool belongs to any of the active components
        for (const { component } of activeComponents) {
            if (component.toolSet.has(name)) {
                return true;
            }
        }

        return false;
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
        const availableTools = this.getAvailableTools();
        const enabledSet = new Set(availableTools.map(t => t.toolName));

        return {
            total: allTools.length,
            enabled: enabledSet.size,
            disabled: allTools.length - enabledSet.size,
        };
    }
}
