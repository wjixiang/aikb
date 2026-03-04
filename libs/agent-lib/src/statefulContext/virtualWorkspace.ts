import { injectable, inject, optional } from 'inversify';
import { ToolComponent } from './toolComponent.js';
import type { ComponentRegistration, VirtualWorkspaceConfig, Tool, IVirtualWorkspace } from './types.js';
import { tdiv } from './ui/index.js';
import type { TUIElement } from './ui/TUIElement.js';
import { SkillManager, Skill, SkillSummary, SkillActivationResult, ToolSource } from '../skills/index.js';
import { renderToolSection } from '../utils/toolRendering.js';
import { getBuiltinSkills } from '../skills/builtin/index.js';
import { TYPES } from '../di/types.js';
import type { IToolManager } from '../tools/index.js';
import { GlobalToolProvider, ComponentToolProvider, SkillToolProvider } from '../tools/index.js';
import { ToolManager } from '../tools/ToolManager.js';


/**
 * Virtual Workspace - manages multiple ToolComponents for fine-grained LLM context
 * Uses tool calls for interaction instead of script execution
 *
 * This class delegates all tool management to IToolManager.
 * All tools are managed by the singleton ToolManager instance.
 * Tool state strategy management (skill-based tool control) is now integrated into ToolManager.
 */
@injectable()
export class VirtualWorkspace implements IVirtualWorkspace {
    private config: VirtualWorkspaceConfig;
    private components: Map<string, ComponentRegistration>;
    private skillManager: SkillManager;

    // Tool management system (injected)
    private toolManager: IToolManager;
    private globalToolProvider: GlobalToolProvider;

    constructor(
        @inject(TYPES.VirtualWorkspaceConfig) @optional() config: Partial<VirtualWorkspaceConfig> = {},
        @inject(TYPES.IToolManager) @optional() toolManager?: IToolManager,
    ) {
        this.config = {
            id: config.id || 'default-workspace',
            name: config.name || 'Default Workspace',
            ...config,
        };
        this.components = new Map();

        // ToolManager is injected when available, otherwise create a new instance
        // This allows both DI container usage and direct instantiation
        this.toolManager = toolManager ?? new ToolManager();

        this.skillManager = new SkillManager({
            onSkillChange: (skill) => this.handleSkillChange(skill)
        });

        // Initialize global tool provider with skillManager
        this.globalToolProvider = new GlobalToolProvider(this.skillManager);
        this.toolManager.registerProvider(this.globalToolProvider);

        this.initializeSkills();

        // All tools are now managed by ToolManager
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
     * Get the IToolManager instance (for Agent integration)
     */
    getToolManager(): IToolManager {
        return this.toolManager;
    }

    /**
     * Handle skill change - enable/disable skill tools
     *
     * Uses ToolManager's integrated strategy management to apply skill-based tool state strategy.
     *
     * When a skill is activated:
     * - ToolManager applies the skill's tool enable/disable strategy
     *
     * When a skill is deactivated:
     * - ToolManager reverts to default strategy
     */
    private handleSkillChange(skill: Skill | null): void {
        // NEW: Use SkillToolProvider to manage skill tools and components
        // Remove previous skill provider if exists
        if (skill) {
            // Unregister any existing skill provider
            this.toolManager.unregisterProvider(`skill:${skill.name}`);

            // Register new skill provider
            const skillProvider = new SkillToolProvider(skill);
            this.toolManager.registerProvider(skillProvider);
        }

        // Also use tool manager's strategy for backward compatibility
        this.toolManager.setStrategy(skill);
        this.toolManager.applyStrategy();

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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return container;
        }

        // List all skills
        for (const skill of skills) {
            const isActive = skill.name === activeSkill?.name;
            const statusBadge = isActive ? ' **[ACTIVE]**' : '';
            const triggers = skill.triggers?.length ? `\n**Triggers:** ${skill.triggers.join(', ')}` : '';
            const whenToUse = skill.whenToUse ? `\n**When to use:** ${skill.whenToUse}` : '';

            availableSkillContainer.addChild(new tdiv({
                content: `### ${skill.displayName}${statusBadge}\n**ID:** \`${skill.name}\`\n**Description:** ${skill.description}${whenToUse}${triggers}\n\n`,
                styles: { showBorder: false }
            }));
            availableSkillContainer.addChild(new tdiv({
                content: `\n\n---\n\n`,
                styles: { showBorder: false }
            }));
        }

        // Show active skill indicator at the bottom
        if (activeSkill) {
            activeSkillContainer.addChild(new tdiv({
                content: `**Currently Active:** \`${activeSkill.name}\` (${activeSkill.displayName})`,
                styles: { showBorder: false }
            }));
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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

        // Filter to only show enabled tools using toolManager
        const enabledTools = activeSkill.tools.filter(tool => {
            return this.toolManager.isToolEnabled(tool.toolName);
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

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return container;
    }

    /**
     * Register a component with the workspace
     */
    registerComponent(registration: ComponentRegistration): void {
        this.components.set(registration.key, registration);

        // Create and register ComponentToolProvider with the tool management system
        const componentToolProvider = new ComponentToolProvider(registration.key, registration.component);
        this.toolManager.registerProvider(componentToolProvider);
    }

    /**
     * Unregister a component from the workspace
     */
    unregisterComponent(key: string): boolean {
        const componentToDelete = this.components.get(key);

        // Unregister ComponentToolProvider from the tool management system
        this.toolManager.unregisterProvider(`component:${key}`);

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

        // Add global tools section using toolManager instead of deprecated toolSet
        const allTools = this.toolManager.getAllTools();
        const globalTools = allTools
            .filter(reg => reg.source === ToolSource.GLOBAL)
            .map(reg => reg.tool);

        if (globalTools.length > 0) {
            const globalToolsSection = renderToolSection(globalTools)
            container.addChild(globalToolsSection);
        }

        // Note: Component tools are no longer rendered in TOOL BOX
        // They are rendered in their respective component sections in _render()

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
     * Handle tool call
     * @param toolName - The name of the tool to call
     * @param params - The parameters to pass to the tool
     * @returns Promise resolving to the tool result
     */
    async handleToolCall(toolName: string, params: Record<string, unknown>): Promise<unknown> {
        // Execute through the tool management system
        try {
            const result = await this.toolManager.executeTool(toolName, params);
            return { success: true, result };
        } catch (error) {
            return {
                error: error instanceof Error ? error.message : String(error),
                success: false
            };
        }
    }

    /**
     * Get all available tools from all components
     * @returns Array of tool definitions with component information
     */
    getAllTools(): Array<{ componentKey: string | undefined; toolName: string; tool: Tool; source: ToolSource; enabled: boolean }> {
        const registrations = this.toolManager.getAllTools();
        return registrations.map(reg => ({
            componentKey: reg.source === ToolSource.COMPONENT ? reg.providerId.replace('component:', '') : undefined,
            toolName: reg.tool.toolName,
            tool: reg.tool,
            source: reg.source,
            enabled: reg.enabled
        }));
    }

    /**
     * Get all global tools
     */
    getGlobalTools(): Map<string, Tool> {
        const globalToolsMap = new Map<string, Tool>();
        const allTools = this.toolManager.getAllTools();
        for (const registration of allTools) {
            if (registration.source === ToolSource.GLOBAL) {
                globalToolsMap.set(registration.tool.toolName, registration.tool);
            }
        }
        return globalToolsMap;
    }

    /**
     * Check if a tool is currently available
     */
    isToolAvailable(toolName: string): boolean {
        return this.toolManager.isToolEnabled(toolName);
    }

    /**
     * Get all currently available tools
     */
    getAvailableTools(): Tool[] {
        return this.toolManager.getAvailableTools();
    }

    /**
     * Get tool source information
     */
    getToolSource(toolName: string): { source: ToolSource; owner: string } | null {
        const source = this.toolManager.getToolSource(toolName);
        if (source) {
            return {
                source: source.source,
                owner: source.providerId
            };
        }
        return null;
    }
}
export type { ComponentRegistration, Skill, SkillSummary };

