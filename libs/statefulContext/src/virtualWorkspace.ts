import { ToolComponent } from './toolComponent';
import { ComponentRegistration, VirtualWorkspaceConfig, Tool } from './types';
import { tdiv, th, TUIElement } from './ui';
import { attempt_completion, get_skill, list_skills, deactivate_skill } from './globalTools'
import { SkillManager, Skill, SkillSummary, SkillActivationResult } from 'skills';


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
     */
    private toolSet = new Map<string, {
        tool: Tool;
        componentKey: string;
    }>();

    /** Track skill-added tools for cleanup */
    private skillToolNames: Set<string> = new Set();

    constructor(config: VirtualWorkspaceConfig) {
        this.config = config;
        this.components = new Map();
        this.skillManager = new SkillManager({
            onSkillChange: (skill) => this.handleSkillChange(skill)
        });
        this.initializeGlobalTools();
    }

    /**
     * Initialize global shared tools
     */
    private initializeGlobalTools(): void {
        // Add attempt_completion tool to toolSet with 'global' componentKey
        this.toolSet.set('attempt_completion', {
            tool: attempt_completion,
            componentKey: 'global'
        });

        this.toolSet.set('get_skill', {
            tool: get_skill,
            componentKey: 'global'
        });

        this.toolSet.set('list_skills', {
            tool: list_skills,
            componentKey: 'global'
        });

        this.toolSet.set('deactivate_skill', {
            tool: deactivate_skill,
            componentKey: 'global'
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
     * Handle skill change - add/remove skill tools
     */
    private handleSkillChange(skill: Skill | null): void {
        // Remove previous skill tools
        for (const toolName of this.skillToolNames) {
            this.toolSet.delete(toolName);
        }
        this.skillToolNames.clear();

        // Add new skill tools
        if (skill?.tools) {
            for (const tool of skill.tools) {
                this.toolSet.set(tool.toolName, {
                    tool,
                    componentKey: 'skill'
                });
                this.skillToolNames.add(tool.toolName);
            }
        }
    }

    /**
     * Render skills section for LLM context
     */
    renderSkillsSection(): TUIElement {
        const skills = this.skillManager.getAvailableSkills();
        const activeSkill = this.skillManager.getActiveSkill();

        const container = new tdiv({
            content: 'AVAILABLE SKILLS',
            styles: {
                showBorder: true,
                align: 'center'
            }
        });

        if (skills.length === 0) {
            container.addChild(new tdiv({
                content: 'No skills registered',
                styles: { showBorder: false }
            }));
            return container;
        }

        // Show active skill indicator
        if (activeSkill) {
            container.addChild(new tdiv({
                content: `Active: ${activeSkill.displayName}`,
                styles: { showBorder: false }
            }));
        }

        // List all skills
        for (const skill of skills) {
            const isActive = skill.name === activeSkill?.name;
            const marker = isActive ? '→ ' : '  ';
            const triggers = skill.triggers?.length ? ` [${skill.triggers.join(', ')}]` : '';
            container.addChild(new tdiv({
                content: `${marker}${skill.name}: ${skill.description}${triggers}`,
                styles: { showBorder: false }
            }));
        }

        return container;
    }

    /**
     * Register a component with the workspace
     */
    registerComponent(registration: ComponentRegistration): void {
        this.components.set(registration.key, registration);
        registration.component.toolSet.forEach((value, key) => {
            this.toolSet.set(value.toolName, {
                tool: value,
                componentKey: registration.key
            })
        })
    }

    /**
     * Unregister a component from the workspace
     */
    unregisterComponent(key: string): boolean {
        const componentToDelete = this.components.get(key);
        componentToDelete?.component.toolSet.forEach((value, key) => {
            this.toolSet.delete(value.toolName)
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
            .filter(([, value]) => value.componentKey === 'global')
            .map(([, value]) => value.tool);

        if (globalTools.length > 0) {
            const globalToolsSection = new tdiv({
                content: 'GLOBAL TOOLS',
                styles: {
                    showBorder: true,
                    align: 'center'
                }
            });
            globalTools.forEach(tool => {
                globalToolsSection.addChild(new tdiv({
                    content: `- ${tool.toolName}: ${tool.desc}`,
                    styles: { showBorder: false }
                }));
            });
            container.addChild(globalToolsSection);
        }

        this.components.forEach(e => {
            container.addChild(e.component.renderToolSection())
        })
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
            const toolToExecute = this.toolSet.get(toolName);
            if (!toolToExecute) throw new Error(`Tool not found: ${toolName}`);

            // Check if it's a global tool
            if (toolToExecute.componentKey === 'global') {
                return await this.handleGlobalToolCall(toolName, params);
            }

            const component = this.components.get(toolToExecute.componentKey);
            await component?.component.handleToolCall(toolName, params);
            return { success: true };
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
    getAllTools(): Array<{ componentKey: string; toolName: string; tool: any }> {
        const tools: Array<{ componentKey: string; toolName: string; tool: any }> = [];

        // Add all tools from toolSet (includes both global and component tools)
        for (const [toolName, value] of this.toolSet.entries()) {
            tools.push({ componentKey: value.componentKey, toolName, tool: value.tool });
        }

        return tools;
    }

    /**
     * Get all global tools
     */
    getGlobalTools(): Map<string, Tool> {
        const globalToolsMap = new Map<string, Tool>();
        for (const [toolName, value] of this.toolSet.entries()) {
            if (value.componentKey === 'global') {
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
            componentKey: 'global'
        });
    }

    /**
     * Remove a global tool
     */
    removeGlobalTool(toolName: string): boolean {
        const toolEntry = this.toolSet.get(toolName);
        if (toolEntry && toolEntry.componentKey === 'global') {
            return this.toolSet.delete(toolName);
        }
        return false;
    }
}
export type { ComponentRegistration, Skill, SkillSummary };

