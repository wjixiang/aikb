import { ToolComponent } from './toolComponent.js';
import { ComponentRegistration, VirtualWorkspaceConfig, Tool } from './types.js';
import { tdiv, th, TUIElement } from './ui/index.js';
import { attempt_completion, get_skill, list_skills, deactivate_skill } from './globalTools.js'
import { SkillManager, Skill, SkillSummary, SkillActivationResult, ToolSource, ToolRegistration } from '../skills/index.js';
import { renderToolSection } from '../utils/toolRendering.js';
import { getBuiltinSkills } from '../skills/builtin/index.js';


/**
 * Virtual Workspace - manages multiple ToolComponents for fine-grained LLM context
 * Uses tool calls for interaction instead of script execution
 */
export class VirtualWorkspace {
    private config: VirtualWorkspaceConfig;
    private components: Map<string, ComponentRegistration>;
    private skillManager: SkillManager;

    /**
     * Combine all available tools from each components and global tools.
     * Uses ToolRegistration to track tool source and enabled state.
     */
    private toolSet = new Map<string, ToolRegistration>();

    /** Track skill-added tools for cleanup */
    private skillToolNames: Set<string> = new Set();

    constructor(config: VirtualWorkspaceConfig) {
        this.config = config;
        this.components = new Map();
        this.skillManager = new SkillManager({
            onSkillChange: (skill) => this.handleSkillChange(skill)
        });
        this.initializeGlobalTools();
        this.initializeSkills();
    }

    /**
     * Initialize skills from repository
     */
    private initializeSkills(): void {
        try {
            // Import built-in skills synchronously
            const skills = getBuiltinSkills();

            if (skills.length > 0) {
                this.skillManager.registerAll(skills);
                console.log(`[VirtualWorkspace] Registered ${skills.length} built-in skills`);
            }
        } catch (error) {
            console.warn('[VirtualWorkspace] Failed to load built-in skills:', error);
        }
    }

    /**
     * Initialize global shared tools
     */
    private initializeGlobalTools(): void {
        // Add attempt_completion tool to toolSet with 'global' componentKey
        this.toolSet.set('attempt_completion', {
            tool: attempt_completion,
            source: ToolSource.GLOBAL,
            componentKey: 'global',
            enabled: true
        });

        this.toolSet.set('get_skill', {
            tool: get_skill,
            source: ToolSource.GLOBAL,
            componentKey: 'global',
            enabled: true
        });

        this.toolSet.set('list_skills', {
            tool: list_skills,
            source: ToolSource.GLOBAL,
            componentKey: 'global',
            enabled: true
        });

        this.toolSet.set('deactivate_skill', {
            tool: deactivate_skill,
            source: ToolSource.GLOBAL,
            componentKey: 'global',
            enabled: true
        });
    }

    // ==================== Skill Management ====================

    /**
     * Register skills with the workspace
     */
    registerSkills(skills: Skill[]): void {
        this.skillManager.registerAll(skills);
    }

    /**
     * Register a single skill
     */
    registerSkill(skill: Skill): void {
        this.skillManager.register(skill);
    }

    /**
     * Get the skill manager instance
     */
    getSkillManager(): SkillManager {
        return this.skillManager;
    }

    /**
     * Get active skill's prompt enhancement
     */
    getSkillPrompt(): { capability: string; direction: string } | null {
        return this.skillManager.getActivePrompt();
    }

    /**
     * Get available skills summary
     */
    getAvailableSkills(): SkillSummary[] {
        return this.skillManager.getAvailableSkills();
    }

    /**
     * Handle skill change - enable/disable skill tools
     *
     * All component tools are already in toolSet.
     * Skills only control which tools are enabled (callable) and rendered.
     *
     * When a skill is activated:
     * - All component tools are disabled first
     * - Only tools defined in the skill are enabled
     *
     * When a skill is deactivated:
     * - All component tools are re-enabled
     */
    private handleSkillChange(skill: Skill | null): void {
        // First, disable ALL component tools
        for (const [toolName, registration] of this.toolSet.entries()) {
            if (registration.source === ToolSource.COMPONENT) {
                registration.enabled = false;
            }
        }
        this.skillToolNames.clear();

        // If activating a new skill, enable only its tools
        if (skill?.tools) {
            for (const tool of skill.tools) {
                const registration = this.toolSet.get(tool.toolName);
                if (registration?.source === ToolSource.COMPONENT) {
                    // Enable this tool
                    registration.enabled = true;
                    this.skillToolNames.add(tool.toolName);
                } else {
                    console.warn(`[VirtualWorkspace] Skill tool "${tool.toolName}" not found in component tools`);
                }
            }
        } else {
            // No skill active, enable all component tools
            for (const [toolName, registration] of this.toolSet.entries()) {
                if (registration.source === ToolSource.COMPONENT) {
                    registration.enabled = true;
                }
            }
        }

        // Notify tool availability change
        this.onToolAvailabilityChange?.();
    }

    /** Callback for when tool availability changes */
    private onToolAvailabilityChange?: (() => void) | undefined;

    /**
     * Set callback for when tool availability changes
     */
    setOnToolAvailabilityChange(callback: () => void): void {
        this.onToolAvailabilityChange = callback;
    }

    /**
     * Render skills section for LLM context
     */
    renderSkillsSection(): TUIElement {
        const skills = this.skillManager.getAvailableSkills();
        const activeSkill = this.skillManager.getActiveSkill();

        const container = new tdiv({
            styles: {
                showBorder: true,
                // align: 'center'
            }
        });

        container.addChild(new tdiv({
            content: 'SKILLS',
            styles: {
                align: 'center'
            }
        }))

        const availableSkillContainer = new tdiv({
            styles: {
                showBorder: true
            }
        })
        const activeSkillContainer = new tdiv({})

        container.addChild(availableSkillContainer)
        container.addChild(activeSkillContainer)

        availableSkillContainer.addChild(new tdiv({
            content: 'AVAILABLE SKILLS',
            styles: {
                align: 'center',
            }
        }))

        if (skills.length === 0) {
            availableSkillContainer.addChild(new tdiv({
                content: 'No skills registered',
                styles: { showBorder: false }
            }));
            return container;
        }

        // Show active skill indicator
        if (activeSkill) {
            activeSkillContainer.addChild(new tdiv({
                content: `Active: ${activeSkill.displayName}`,
                styles: { showBorder: false }
            }));
        }

        // List all skills
        for (const skill of skills) {
            const isActive = skill.name === activeSkill?.name;
            const marker = isActive ? '→ ' : '- ';
            const triggers = skill.triggers?.length ? ` [${skill.triggers.join(', ')}]` : '';
            availableSkillContainer.addChild(new tdiv({
                content: `${marker}${skill.name}: ${skill.description}${triggers}`,
                styles: { showBorder: false }
            }));
        }

        return container;
    }

    /**
     * Render skill-specific tools section
     * Shows only enabled tools from the active skill
     */
    renderSkillToolsSection(): TUIElement | null {
        const activeSkill = this.skillManager.getActiveSkill();
        if (!activeSkill?.tools || activeSkill.tools.length === 0) {
            return null;
        }

        // Filter to only show enabled tools
        const enabledTools = activeSkill.tools.filter(tool => {
            const registration = this.toolSet.get(tool.toolName);
            return registration?.enabled === true;
        });

        if (enabledTools.length === 0) {
            return null;
        }

        const container = new tdiv({
            styles: {
                showBorder: true,
                border: { line: 'double' }
            }
        });

        container.addChild(new tdiv({
            content: `SKILL TOOLS: ${activeSkill.displayName}`,
            styles: { align: 'center' }
        }));

        const toolSection = renderToolSection(enabledTools);
        container.addChild(toolSection);

        return container;
    }

    /**
     * Register a component with the workspace
     */
    registerComponent(registration: ComponentRegistration): void {
        this.components.set(registration.key, registration);
        registration.component.toolSet.forEach((value: Tool, key: string) => {
            this.toolSet.set(value.toolName, {
                tool: value,
                source: ToolSource.COMPONENT,
                componentKey: registration.key,
                enabled: true,
                handler: async (params: any) => {
                    await registration.component.handleToolCall(value.toolName, params);
                }
            });
        })
    }

    /**
     * Unregister a component from the workspace
     */
    unregisterComponent(key: string): boolean {
        const componentToDelete = this.components.get(key);
        componentToDelete?.component.toolSet.forEach((value: Tool, key: string) => {
            this.toolSet.delete(value.toolName);
        })
        return this.components.delete(key);
    }

    /**
     * Get a registered component
     */
    getComponent(key: string): ToolComponent | undefined {
        return this.components.get(key)?.component;
    }

    /**
     * Get all registered component keys
     */
    getComponentKeys(): string[] {
        return Array.from(this.components.keys());
    }

    renderToolBox() {
        const container = new tdiv({
            content: "TOOL BOX",
            styles: {
                align: 'center',
                showBorder: true
            }
        })
        // container.addChild(new th({
        //     content: "TOOL BOX",
        //     styles: {
        //         align: 'center'
        //     }
        // }))

        // Add global tools section
        const globalTools = Array.from(this.toolSet.entries())
            .filter(([, value]) => value.source === ToolSource.GLOBAL)
            .map(([, value]) => value.tool);

        if (globalTools.length > 0) {
            const globalToolsSection = renderToolSection(globalTools)
            container.addChild(globalToolsSection);
        }

        // Note: Component tools are no longer rendered in TOOL BOX
        // They are rendered in their respective component sections in _render()

        return container

    }

    /**
     * Render the entire workspace as context for LLM
     * Components are rendered in priority order (lower priority first)
     */
    private async _render(): Promise<TUIElement> {
        // Create container tdiv
        const container = new tdiv({
            content: '',
            styles: {
                showBorder: false
            }
        });

        // Render workspace header using tdiv
        const workspaceHeader = new tdiv({
            content: `VIRTUAL WORKSPACE: ${this.config.name}`,
            styles: {
                height: 0,
                showBorder: true,
                border: { line: 'double' },
                align: 'center'
            }
        });
        container.addChild(workspaceHeader);

        if (this.config.description) {
            container.addChild(new tdiv({
                content: `Description: ${this.config.description}`,
                styles: { showBorder: false, margin: { bottom: 1 } }
            }));
        }

        // Add skills section
        container.addChild(this.renderSkillsSection());

        // Add skill tools section (if active skill has tools)
        const skillToolsSection = this.renderSkillToolsSection();
        if (skillToolsSection) {
            container.addChild(skillToolsSection);
        }

        // container.addChild(new tdiv({
        //     content: `Workspace ID: ${this.config.id}\nComponents: ${this.components.size}`,
        //     styles: { showBorder: false, margin: { bottom: 1 } }
        // }));

        // Sort components by priority
        const sortedComponents = Array.from(this.components.entries())
            .sort(([, a], [, b]) => (a.priority || 0) - (b.priority || 0));

        for (const [key, registration] of sortedComponents) {
            // Render component header using tdiv
            // ToolComponent.render() returns TUIElement (a container), so we add it directly
            const componentContainer = new tdiv({
                content: key,
                styles: { showBorder: true }
            });
            const componentRender = await registration.component.render();
            componentContainer.addChild(componentRender);
            container.addChild(componentContainer);
        }

        return container;
    }

    /**
     * Render the workspace as context for LLM
     * Components are rendered in priority order (lower priority first)
     */
    async render(): Promise<string> {
        const context = await this._render();
        return context.render();
    }

    /**
     * Get workspace configuration
     */
    getConfig(): VirtualWorkspaceConfig {
        return { ...this.config };
    }

    /**
     * Get workspace statistics
     */
    getStats(): {
        componentCount: number;
        componentKeys: string[];
        totalTools: number;
    } {
        let totalTools = 0;
        const componentKeys: string[] = [];

        for (const [key, registration] of this.components.entries()) {
            componentKeys.push(key);
            totalTools += registration.component.toolSet.size;
        }

        return {
            componentCount: this.components.size,
            componentKeys,
            totalTools
        };
    }

    /**
     * Handle tool call on a component
     * @param componentKey - The key of the component to call
     * @param toolName - The name of the tool to call
     * @param params - The parameters to pass to the tool
     * @returns Promise resolving to the tool result
     */
    async handleToolCall(toolName: string, params: any): Promise<any> {
        // const component = this.getComponent(componentKey);
        // if (!component) {
        //     return { error: `Component not found: ${componentKey}` };
        // }

        try {
            const toolRegistration = this.toolSet.get(toolName);
            if (!toolRegistration) throw new Error(`Tool not found: ${toolName}`);

            // Check if tool is enabled
            if (!toolRegistration.enabled) {
                return {
                    error: `Tool "${toolName}" is currently disabled`,
                    success: false
                };
            }

            // Use handler from ToolRegistration for direct execution
            if (toolRegistration.handler) {
                try {
                    const result = await toolRegistration.handler(params);
                    return { success: true, result };
                } catch (error) {
                    return {
                        error: error instanceof Error ? error.message : String(error),
                        success: false
                    };
                }
            }

            // Check if it's a global tool (no handler, use handleGlobalToolCall)
            if (toolRegistration.source === ToolSource.GLOBAL) {
                return await this.handleGlobalToolCall(toolName, params);
            }

            return {
                error: `Unable to execute tool "${toolName}": no handler found`,
                success: false
            };
        } catch (error) {
            return {
                error: error instanceof Error ? error.message : String(error),
                success: false
            };
        }
    }

    /**
     * Handle global tool calls
     */
    private async handleGlobalToolCall(toolName: string, params: any): Promise<any> {
        switch (toolName) {
            case 'attempt_completion':
                return await this.attemptCompletion(params.result);
            case 'get_skill':
                return await this.handleGetSkill(params.skill_name);
            case 'list_skills':
                return await this.handleListSkills();
            case 'deactivate_skill':
                return await this.handleDeactivateSkill();
            default:
                throw new Error(`Unknown global tool: ${toolName}`);
        }
    }

    /**
     * Handle get_skill tool call
     */
    private async handleGetSkill(skillName: string): Promise<SkillActivationResult> {
        return await this.skillManager.activateSkill(skillName);
    }

    /**
     * Handle list_skills tool call
     */
    private async handleListSkills(): Promise<{ skills: SkillSummary[]; activeSkill: string | null }> {
        const skills = this.skillManager.getAvailableSkills();
        const activeSkill = this.skillManager.getActiveSkill();
        return {
            skills,
            activeSkill: activeSkill?.name ?? null
        };
    }

    /**
     * Handle deactivate_skill tool call
     */
    private async handleDeactivateSkill(): Promise<{ success: boolean; message: string }> {
        return await this.skillManager.deactivateSkill();
    }

    /**
     * Complete the task and return final result
     */
    private async attemptCompletion(result: string): Promise<any> {
        // This method can be overridden or extended to handle completion
        // For now, it returns the result
        return {
            success: true,
            completed: true,
            result
        };
    }

    /**
     * Get all available tools from all components
     * @returns Array of tool definitions with component information
     */
    getAllTools(): Array<{ componentKey: string | undefined; toolName: string; tool: any; source: ToolSource; enabled: boolean }> {
        const tools: Array<{ componentKey: string | undefined; toolName: string; tool: any; source: ToolSource; enabled: boolean }> = [];

        // Add all tools from toolSet (includes both global and component tools)
        for (const [toolName, value] of this.toolSet.entries()) {
            tools.push({ componentKey: value.componentKey, toolName, tool: value.tool, source: value.source, enabled: value.enabled });
        }

        return tools;
    }

    /**
     * Get all global tools
     */
    getGlobalTools(): Map<string, Tool> {
        const globalToolsMap = new Map<string, Tool>();
        for (const [toolName, value] of this.toolSet.entries()) {
            if (value.source === ToolSource.GLOBAL) {
                globalToolsMap.set(toolName, value.tool);
            }
        }
        return globalToolsMap;
    }

    /**
     * Add a global tool
     */
    addGlobalTool(tool: Tool): void {
        this.toolSet.set(tool.toolName, {
            tool,
            source: ToolSource.GLOBAL,
            componentKey: 'global',
            enabled: true
        });
    }

    /**
     * Remove a global tool
     */
    removeGlobalTool(toolName: string): boolean {
        const toolEntry = this.toolSet.get(toolName);
        if (toolEntry && toolEntry.source === ToolSource.GLOBAL) {
            return this.toolSet.delete(toolName);
        }
        return false;
    }

    /**
     * Check if a tool is currently available
     */
    isToolAvailable(toolName: string): boolean {
        const registration = this.toolSet.get(toolName);
        return registration?.enabled ?? false;
    }

    /**
     * Get all currently available tools
     */
    getAvailableTools(): Tool[] {
        return Array.from(this.toolSet.values())
            .filter(reg => reg.enabled)
            .map(reg => reg.tool);
    }

    /**
     * Get tool source information
     */
    getToolSource(toolName: string): { source: ToolSource; owner: string } | null {
        const registration = this.toolSet.get(toolName);
        if (!registration) return null;

        return {
            source: registration.source,
            owner: registration.componentKey ?? registration.skillName ?? 'global'
        };
    }
}
export type { ComponentRegistration, Skill, SkillSummary };

