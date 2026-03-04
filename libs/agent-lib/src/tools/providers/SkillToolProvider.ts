import { injectable } from 'inversify';
import type { Tool } from '../../statefulContext/types.js';
import type { ToolComponent } from '../../statefulContext/toolComponent.js';
import type { Skill } from '../../skills/types.js';
import type { IToolProvider } from '../IToolProvider.js';
import { BaseToolProvider } from '../IToolProvider.js';
import { ComponentToolProvider } from './ComponentToolProvider.js';

/**
 * Skill Tool Provider
 *
 * Provides tools from a Skill, including both skill-defined tools
 * and tools from components managed by the skill.
 *
 * This provider enables skills to control multiple components directly,
 * making components part of the skill's lifecycle.
 */
@injectable()
export class SkillToolProvider extends BaseToolProvider implements IToolProvider {
    readonly id: string;
    readonly priority = 60; // Between global (100) and component (50)

    private skill: Skill;
    private componentProviders: Map<string, ComponentToolProvider>;

    constructor(skill: Skill) {
        super();
        this.id = `skill:${skill.name}`;
        this.skill = skill;
        this.componentProviders = new Map();
        this.initializeComponentProviders();
    }

    /**
     * Initialize component providers for all components in the skill
     */
    private initializeComponentProviders(): void {
        if (!this.skill.components) {
            return;
        }

        for (const componentDef of this.skill.components) {
            const provider = new ComponentToolProvider(
                `${this.skill.name}:${componentDef.componentId}`,
                componentDef.instance
            );
            this.componentProviders.set(componentDef.componentId, provider);
        }
    }

    /**
     * Get all tools from skill and its components
     * @returns Array of all available tools
     */
    getTools(): Tool[] {
        // Get skill-defined tools
        const skillTools = this.skill.tools ?? [];

        // Get tools from all components
        const componentTools = Array.from(this.componentProviders.values())
            .flatMap(provider => provider.getTools());

        // Combine both sources
        return [...skillTools, ...componentTools];
    }

    /**
     * Get a specific tool by name
     * @param name - The tool name to look up
     * @returns Tool definition or undefined
     */
    getTool(name: string): Tool | undefined {
        // Try component tools first
        for (const provider of this.componentProviders.values()) {
            const tool = provider.getTool(name);
            if (tool) {
                return tool;
            }
        }

        // Fall back to skill-defined tools
        return this.skill.tools?.find(t => t.toolName === name);
    }

    /**
     * Execute a tool call
     * Routes to appropriate component's handleToolCall method
     * @param name - The tool name to execute
     * @param params - The parameters to pass to the tool
     * @returns Promise resolving to tool result
     */
    async executeTool(name: string, params: any): Promise<any> {
        // Find the component that provides this tool
        for (const provider of this.componentProviders.values()) {
            if (provider.hasTool(name)) {
                return await provider.executeTool(name, params);
            }
        }

        // If tool not found in any component, it doesn't exist
        throw new Error(`Tool "${name}" not found in any skill component`);
    }

    /**
     * Check if a tool exists in this provider
     * @param name - The tool name to check
     * @returns true if tool exists
     */
    hasTool(name: string): boolean {
        // Check component tools
        for (const provider of this.componentProviders.values()) {
            if (provider.hasTool(name)) {
                return true;
            }
        }

        // Check skill-defined tools
        return this.skill.tools?.some(t => t.toolName === name) ?? false;
    }

    /**
     * Get all tool names from this provider
     * @returns Array of tool names
     */
    getToolNames(): string[] {
        const skillToolNames = this.skill.tools?.map(t => t.toolName) ?? [];
        const componentToolNames = Array.from(this.componentProviders.values())
            .flatMap(provider => provider.getToolNames());
        return [...skillToolNames, ...componentToolNames];
    }

    /**
     * Get the skill associated with this provider
     * @returns The skill instance
     */
    getSkill(): Skill {
        return this.skill;
    }

    /**
     * Get a component provider by component ID
     * @param componentId - The component ID to look up
     * @returns ComponentToolProvider or undefined
     */
    getComponentProvider(componentId: string): ComponentToolProvider | undefined {
        return this.componentProviders.get(componentId);
    }

    /**
     * Get all component providers
     * @returns Map of component ID to provider
     */
    getComponentProviders(): Map<string, ComponentToolProvider> {
        return new Map(this.componentProviders);
    }
}
