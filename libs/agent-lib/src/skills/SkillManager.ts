import { injectable, inject, Container } from 'inversify';
import { TYPES } from '../di/types.js';
import type { Skill, SkillSummary, SkillActivationResult, SkillManagerOptions, Tool, SkillToolState, ToolComponent } from './types.js';

/**
 * SkillManager - manages skill registration, activation, and lifecycle
 *
 * Allows LLM to dynamically select skills to optimize prompts and tools
 * for specific tasks.
 */
@injectable()
export class SkillManager {
    private registry = new Map<string, Skill>();
    private activeSkill: Skill | null = null;
    private onSkillChange?: ((skill: Skill | null) => void) | undefined;

    /** NEW: Track active components from active skill */
    private activeComponents: Map<string, ToolComponent> = new Map();

    /** NEW: Track added component IDs for activation result */
    private addedComponents: string[] = [];

    /** Container for resolving DI tokens */
    private container?: Container;

    /** Expert mode - disables skill switching */
    private expertMode: boolean = false;

    constructor(options?: SkillManagerOptions) {
        this.onSkillChange = options?.onSkillChange ?? undefined;
    }

    /**
     * Set expert mode - disables skill switching
     */
    setExpertMode(enabled: boolean): void {
        this.expertMode = enabled;
    }

    /**
     * Check if expert mode is enabled
     */
    isExpertMode(): boolean {
        return this.expertMode;
    }

    /**
     * Register a skill
     */
    register(skill: Skill): void {
        if (this.registry.has(skill.name)) {
            console.warn(`[SkillManager] Skill "${skill.name}" already registered, overwriting`);
        }
        this.registry.set(skill.name, skill);
    }

    /**
     * Register multiple skills
     */
    registerAll(skills: Skill[]): void {
        skills.forEach(s => this.register(s));
    }

    /**
     * Unregister a skill
     */
    unregister(skillName: string): boolean {
        // Cannot unregister active skill
        if (this.activeSkill?.name === skillName) {
            console.warn(`[SkillManager] Cannot unregister active skill "${skillName}"`);
            return false;
        }
        return this.registry.delete(skillName);
    }

    /**
     * Get a skill by name
     */
    get(skillName: string): Skill | undefined {
        return this.registry.get(skillName);
    }

    /**
     * Set the DI container for resolving DI tokens
     * This is called when the container is available after construction
     */
    setContainer(container: Container): void {
        this.container = container;
    }

    /**
     * Check if a skill exists
     */
    has(skillName: string): boolean {
        return this.registry.has(skillName);
    }

    /**
     * Get all registered skill names
     */
    getSkillNames(): string[] {
        return Array.from(this.registry.keys());
    }

    /**
     * Get all skill summaries (for LLM selection)
     */
    getAvailableSkills(): SkillSummary[] {
        return Array.from(this.registry.values()).map(s => ({
            name: s.name,
            displayName: s.displayName,
            description: s.description,
            whenToUse: s.whenToUse,
            triggers: s.triggers ?? undefined
        }));
    }

    /**
     * Get all registered skills (full Skill objects with components)
     */
    getAllSkills(): Skill[] {
        return Array.from(this.registry.values());
    }

    /**
     * Activate a skill by name
     */
    async activateSkill(skillName: string): Promise<SkillActivationResult> {
        // In expert mode, skill switching is disabled
        if (this.expertMode) {
            return {
                success: false,
                message: 'Skill switching is disabled in Expert mode'
            };
        }

        const skill = this.registry.get(skillName);

        if (!skill) {
            const available = this.getSkillNames();
            return {
                success: false,
                message: `Skill "${skillName}" not found. Available skills: ${available.length > 0 ? available.join(', ') : 'none'}`
            };
        }

        // If same skill is already active, return success
        if (this.activeSkill?.name === skillName) {
            return {
                success: true,
                message: `Skill "${skill.displayName}" is already active.`,
                skill
            };
        }

        // Deactivate current skill and its components
        if (this.activeSkill) {
            // Deactivate components first
            for (const component of this.activeComponents.values()) {
                try {
                    await this.activeSkill.onComponentDeactivate?.(component);
                } catch (error) {
                    console.error(`[SkillManager] Error deactivating component "${component.componentId}":`, error);
                }
                try {
                    await component.onDeactivate?.();
                } catch (compError) {
                    console.error(`[SkillManager] Component "${component.componentId}" error during deactivation:`, compError);
                }
            }
            this.activeComponents.clear();

            // Deactivate skill
            try {
                await this.activeSkill.onDeactivate?.();
            } catch (error) {
                console.error(`[SkillManager] Error deactivating skill "${this.activeSkill.name}":`, error);
                throw error
            }
        }

        // Activate new skill
        this.activeSkill = skill;

        // Activate skill's components
        const activatedComponentIds: string[] = [];
        if (skill.components) {
            for (const componentDef of skill.components) {
                let componentInstance: ToolComponent;

                // Check if componentDef.instance is a DI token (Symbol)
                if (typeof componentDef.instance === 'symbol') {
                    // Resolve DI token using container
                    if (!this.container) {
                        console.error(`[SkillManager] Container not available for resolving DI token for component "${componentDef.componentId}". Skipping.`);
                        continue;
                    }
                    try {
                        componentInstance = this.container.get<ToolComponent>(componentDef.instance as symbol);
                    } catch (resolveError) {
                        console.error(`[SkillManager] Error resolving DI token for component "${componentDef.componentId}":`, resolveError);
                        continue;
                    }
                }
                // Check if componentDef.instance is a factory function (sync or async)
                else if (typeof componentDef.instance === 'function') {
                    // Call the factory function to get the component instance
                    try {
                        componentInstance = await componentDef.instance();
                    } catch (factoryError) {
                        console.error(`[SkillManager] Error calling factory for component "${componentDef.componentId}":`, factoryError);
                        continue; // Skip this component if factory fails
                    }
                } else {
                    // Already an instance, use it directly
                    componentInstance = componentDef.instance as ToolComponent;
                }

                // Store the actual component instance
                this.activeComponents.set(componentDef.componentId, componentInstance);
                activatedComponentIds.push(componentDef.componentId);

                // Call component's onActivate hook
                try {
                    await componentInstance.onActivate?.();
                } catch (activateError) {
                    console.error(`[SkillManager] Component "${componentDef.componentId}" error during activation:`, activateError);
                }

                // Call skill's onComponentActivate hook
                try {
                    await skill.onComponentActivate?.(componentInstance);
                } catch (hookError) {
                    console.error(`[SkillManager] Skill "${skill.name}" error in onComponentActivate for "${componentDef.componentId}":`, hookError);
                }
            }
        }

        // Call skill's onActivate hook
        try {
            await skill.onActivate?.();
        } catch (error) {
            console.error(`[SkillManager] Error activating skill "${skill.name}":`, error);
            throw error;
        }

        // Notify skill change
        this.onSkillChange?.(skill);

        return {
            success: true,
            message: `Skill "${skill.displayName}" activated successfully.`,
            skill,
            addedComponents: activatedComponentIds
        };
    }

    /**
     * Deactivate the currently active skill
     */
    async deactivateSkill(): Promise<{ success: boolean; message: string }> {
        // In expert mode, skill switching is disabled
        if (this.expertMode) {
            return {
                success: false,
                message: 'Skill switching is disabled in Expert mode'
            };
        }

        if (!this.activeSkill) {
            return {
                success: true,
                message: 'No skill is currently active.'
            };
        }

        const skillName = this.activeSkill.name;

        // Deactivate components first
        for (const component of this.activeComponents.values()) {
            try {
                await this.activeSkill.onComponentDeactivate?.(component);
            } catch (error) {
                console.error(`[SkillManager] Error deactivating component "${component.componentId}":`, error);
            }
            try {
                await component.onDeactivate?.();
            } catch (compError) {
                console.error(`[SkillManager] Component "${component.componentId}" error during deactivation:`, compError);
            }
        }
        this.activeComponents.clear();

        // Deactivate skill
        try {
            await this.activeSkill.onDeactivate?.();
        } catch (error) {
            console.error(`[SkillManager] Error deactivating skill "${skillName}":`, error);
            throw error;
        }

        // Clear active skill
        this.activeSkill = null;

        // Notify skill change
        this.onSkillChange?.(null);

        return {
            success: true,
            message: `Skill "${skillName}" deactivated successfully.`
        };
    }

    /**
     * Get the currently active skill
     */
    getActiveSkill(): Skill | null {
        return this.activeSkill;
    }

    /**
     * Get active components
     */
    getActiveComponents(): ToolComponent[] {
        return Array.from(this.activeComponents.values());
    }

    /**
     * Get active components with their IDs (definition IDs, not instance IDs)
     * Returns entries with the component definition ID and the component instance
     */
    getActiveComponentsWithIds(): Array<{ componentId: string; component: ToolComponent }> {
        return Array.from(this.activeComponents.entries()).map(([componentId, component]) => ({
            componentId,
            component
        }));
    }

    /**
     * Get all registered components from ALL skills (regardless of activation status)
     * This is used when we want all components to be always rendered
     *
     * Note: This method resolves components that may not be currently active.
     * It iterates through all registered skills and returns their components.
     */
    async getAllComponentsWithIds(): Promise<Array<{ componentId: string; component: ToolComponent }>> {
        const allComponents: Array<{ componentId: string; component: ToolComponent }> = [];
        const componentIds = new Set<string>(); // Avoid duplicates

        for (const skill of this.registry.values()) {
            if (!skill.components) continue;

            for (const componentDef of skill.components) {
                if (componentIds.has(componentDef.componentId)) continue;
                componentIds.add(componentDef.componentId);

                // Check if component is already active (re-use instance)
                const existingComponent = this.activeComponents.get(componentDef.componentId);
                if (existingComponent) {
                    allComponents.push({
                        componentId: componentDef.componentId,
                        component: existingComponent
                    });
                    continue;
                }

                // Resolve component from DI or factory
                let componentInstance: ToolComponent | undefined;

                if (typeof componentDef.instance === 'symbol') {
                    // Resolve from DI container
                    if (this.container) {
                        try {
                            componentInstance = this.container.get<ToolComponent>(componentDef.instance as symbol);
                        } catch (e) {
                            console.warn(`[SkillManager] Could not resolve component "${componentDef.componentId}" from DI`);
                        }
                    }
                } else if (typeof componentDef.instance === 'function') {
                    // Call factory function
                    try {
                        componentInstance = await componentDef.instance();
                    } catch (e) {
                        console.warn(`[SkillManager] Could not create component "${componentDef.componentId}" from factory`);
                    }
                } else if (componentDef.instance) {
                    // Already an instance
                    componentInstance = componentDef.instance as ToolComponent;
                }

                if (componentInstance) {
                    allComponents.push({
                        componentId: componentDef.componentId,
                        component: componentInstance
                    });
                }
            }
        }

        return allComponents;
    }

    /**
     * Get active component count
     */
    getActiveComponentCount(): number {
        return this.activeComponents.size;
    }

    /**
     * Get an active component by its component ID
     */
    getComponent(componentId: string): ToolComponent | undefined {
        return this.activeComponents.get(componentId);
    }

    /**
     * Get active skill's prompt enhancement
     * @deprecated Use getActiveSkill() and access skill.prompt directly
     */
    getActivePrompt(): { capability: string; direction: string } | null {
        const activeSkill = this.getActiveSkill();
        if (!activeSkill) {
            return null;
        }
        return activeSkill.prompt;
    }

    /**
     * Get tools from the active skill's components
     */
    getActiveTools(): Tool[] {
        const tools: Tool[] = [];
        for (const component of this.activeComponents.values()) {
            for (const tool of component.toolSet.values()) {
                tools.push(tool);
            }
        }
        return tools;
    }

    /**
     * Clear all skills
     */
    async clear(): Promise<void> {
        // Deactivate active skill if any
        if (this.activeSkill) {
            await this.deactivateSkill();
        }
        this.registry.clear();
    }

    /**
     * Find skills matching a query string
     * Matches against skill name, display name, description, triggers, and tags
     */
    findMatchingSkills(query: string): SkillSummary[] {
        const lowerQuery = query.toLowerCase();
        return this.getAvailableSkills().filter(skill => {
            const nameMatch = skill.name.toLowerCase().includes(lowerQuery);
            const displayNameMatch = skill.displayName.toLowerCase().includes(lowerQuery);
            const descriptionMatch = skill.description.toLowerCase().includes(lowerQuery);
            const triggerMatch = skill.triggers?.some(t => t.toLowerCase().includes(lowerQuery)) ?? false;
            return nameMatch || displayNameMatch || descriptionMatch || triggerMatch;
        });
    }

    /**
     * Get all skill tool states
     * Note: Tools are now derived from components, not from skill.tools
     */
    getAllSkillToolStates(): SkillToolState[] {
        return Array.from(this.registry.values()).map(skill => {
            // Get tools from skill's components
            const tools: Tool[] = [];
            for (const comp of skill.components || []) {
                // We need to get the resolved component to access toolSet
                // This is a simplified version - actual tool resolution happens on activation
                if (typeof comp.instance !== 'symbol' && 'toolSet' in comp.instance) {
                    const toolSet = comp.instance.toolSet as Map<string, Tool>;
                    tools.push(...toolSet.values());
                }
            }
            return {
                skillName: skill.name,
                tools,
                active: this.activeSkill?.name === skill.name,
                addedToolNames: tools.map(t => t.toolName)
            };
        });
    }

    /**
     * Get the number of registered skills
     */
    get size(): number {
        return this.registry.size;
    }
}
