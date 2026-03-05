import { injectable, inject, optional } from 'inversify';
import { ToolComponent } from './toolComponent.js';
import type { ComponentRegistration, VirtualWorkspaceConfig, Tool, IVirtualWorkspace } from './types.js';
import { tdiv } from './ui/index.js';
import type { TUIElement } from './ui/TUIElement.js';
import { SkillManager, Skill, SkillSummary, SkillActivationResult, ToolSource } from '../skills/index.js';
import { renderToolSection } from '../utils/toolRendering.js';
import { TYPES } from '../di/types.js';
import type { IToolManager } from '../tools/index.js';
import { GlobalToolProvider, SkillToolProvider } from '../tools/index.js';
import { ToolManager } from '../tools/ToolManager.js';
import { getBuiltinSkills } from '../skills/builtin/index.js';


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
    private activeSkill: Skill | null = null;
    private componentInstanceCache: Map<string, ToolComponent> = new Map();

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

        // Initialize skills synchronously
        this.initializeSkills();

        // All tools are now managed by ToolManager
    }

    /**
     * Initialize skills from repository
     */
    private initializeSkills(): void {
        try {
            // Use static import to load built-in skills synchronously
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
        const activeSkill = this.skillManager.getActiveSkill();
        if (!activeSkill) {
            return null;
        }
        return activeSkill.prompt;
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
     * Uses SkillToolProvider to manage skill tools and components.
     *
     * When a skill is activated:
     * - Unregister previous skill's components
     * - Register new skill's components using skill name as prefix
     * - Update activeSkill reference
     * - Register SkillToolProvider with ToolManager
     *
     * When a skill is deactivated:
     * - Unregister skill's components
     * - Clear activeSkill reference
     * - Unregister SkillToolProvider from ToolManager
     */
    private handleSkillChange(skill: Skill | null): void {
        // Unregister previous skill's components if any
        if (this.activeSkill && this.activeSkill !== skill) {
            this.toolManager.unregisterProvider(`skill:${this.activeSkill.name}`);
        }

        // Register new skill's components if skill is provided
        if (skill) {
            // Register SkillToolProvider which manages skill tools and components
            const skillProvider = new SkillToolProvider(skill);
            this.toolManager.registerProvider(skillProvider);
            this.activeSkill = skill;
        } else {
            this.activeSkill = null;
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

        // Add important instruction for LLM
        availableSkillContainer.addChild(new tdiv({
            content: '**IMPORTANT:** When referencing or activating a skill, ALWAYS use the **Skill ID** (in backticks), NOT the display name.',
            styles: {
                showBorder: false,
                margin: { bottom: 1 }
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

            // Make the skill ID more prominent by placing it first and making it stand out
            availableSkillContainer.addChild(new tdiv({
                content: `**Skill ID:** \`${skill.name}\`${statusBadge}\n**Display Name:** ${skill.displayName}\n**Description:** ${skill.description}${whenToUse}${triggers}\n\n`,
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
     * Get a registered component
     * Note: Components are now managed by skills through SkillToolProvider
     */
    getComponent(key: string): ToolComponent | undefined {
        // First check if it's a skill component
        if (this.activeSkill && this.activeSkill.components) {
            for (const componentDef of this.activeSkill.components) {
                const componentKey = `${this.activeSkill.name}:${componentDef.componentId}`;
                if (componentKey === key) {
                    // Check cache first
                    if (this.componentInstanceCache.has(componentKey)) {
                        return this.componentInstanceCache.get(componentKey);
                    }

                    // Resolve instance based on its type
                    const instanceType = typeof componentDef.instance;

                    // Skip if it's a DI token (Symbol) - requires container resolution
                    if (instanceType === 'symbol') {
                        console.warn(`[VirtualWorkspace] DI token for component "${componentDef.componentId}" requires container resolution. Using factory fallback.`);
                        return undefined;
                    }

                    // Resolve instance if it's a factory function
                    if (instanceType === 'function') {
                        // For async factory functions, we need to handle this differently
                        // Since getComponent must be synchronous, we'll return undefined for async factories
                        // and let the caller handle the async resolution
                        const factory = componentDef.instance as () => ToolComponent | Promise<ToolComponent>;
                        const result = factory();

                        if (result instanceof Promise) {
                            // Async factory - trigger resolution in background and return undefined for now
                            result.then(instance => {
                                this.componentInstanceCache.set(componentKey, instance);
                            });
                            return undefined;
                        } else {
                            // Sync factory - cache and return
                            this.componentInstanceCache.set(componentKey, result);
                            return result;
                        }
                    } else {
                        // Direct instance - cache and return
                        this.componentInstanceCache.set(componentKey, componentDef.instance as ToolComponent);
                        return componentDef.instance as ToolComponent;
                    }
                }
            }
        }
        // Fall back to legacy component map
        return this.components.get(key)?.component;
    }

    /**
     * Get all registered component keys
     * Note: Components are now managed by skills through SkillToolProvider
     */
    getComponentKeys(): string[] {
        const keys: string[] = [];

        // Get keys from active skill's components
        if (this.activeSkill && this.activeSkill.components) {
            for (const componentDef of this.activeSkill.components) {
                keys.push(`${this.activeSkill.name}:${componentDef.componentId}`);
            }
        }

        // Fall back to legacy component map
        keys.push(...Array.from(this.components.keys()));

        return keys;
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

        // Note: Tool sections are NOT rendered in workspace.render()
        // - Global tools are rendered via renderToolBox() in System Context (agent.ts)
        // - Skill tools are rendered via renderSkillToolsSection() in System Context (agent.ts)
        // - Component tools are rendered within their respective component sections below

        // container.addChild(new tdiv({
        //     content: `Workspace ID: ${this.config.id}\nComponents: ${this.components.size}`,
        //     styles: { showBorder: false, margin: { bottom: 1 } }
        // }));

        // Render skill components first (if active skill has components)
        if (this.activeSkill && this.activeSkill.components) {
            for (const componentDef of this.activeSkill.components) {
                const componentKey = `${this.activeSkill.name}:${componentDef.componentId}`;
                const componentContainer = new tdiv({
                    content: componentKey,
                    styles: { showBorder: true }
                });

                // Get or resolve instance
                let instance: ToolComponent;
                if (this.componentInstanceCache.has(componentKey)) {
                    instance = this.componentInstanceCache.get(componentKey)!;
                } else if (typeof componentDef.instance === 'function') {
                    const factory = componentDef.instance as () => ToolComponent | Promise<ToolComponent>;
                    const result = factory();
                    if (result instanceof Promise) {
                        instance = await result;
                        this.componentInstanceCache.set(componentKey, instance);
                    } else {
                        instance = result;
                        this.componentInstanceCache.set(componentKey, instance);
                    }
                } else if (typeof componentDef.instance === 'symbol') {
                    // DI token - skip rendering for now
                    console.warn(`[VirtualWorkspace] DI token for component "${componentDef.componentId}" requires container resolution. Skipping render.`);
                    continue;
                } else {
                    instance = componentDef.instance as ToolComponent;
                    this.componentInstanceCache.set(componentKey, instance);
                }

                const componentRender = await instance.renderImply();
                // renderImply returns an array, so add each element
                componentRender.forEach(element => componentContainer.addChild(element));
                container.addChild(componentContainer);
            }
        }

        // Render legacy components (for backward compatibility)
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

        // Get keys and tools from active skill's components
        if (this.activeSkill && this.activeSkill.components) {
            for (const componentDef of this.activeSkill.components) {
                const componentKey = `${this.activeSkill.name}:${componentDef.componentId}`;
                componentKeys.push(componentKey);
                // Count tools from component's toolSet
                // Skip factory functions and DI tokens - tools extracted at activation
                const instanceType = typeof componentDef.instance;
                if (instanceType === 'object' && componentDef.instance) {
                    const instance = componentDef.instance as any;
                    if ('toolSet' in instance) {
                        const toolSet = instance.toolSet as Map<string, any>;
                        totalTools += toolSet.size;
                    }
                }
            }
        }

        // Fall back to legacy component map
        for (const [key, registration] of this.components.entries()) {
            componentKeys.push(key);
            totalTools += registration.component.toolSet.size;
        }

        return {
            componentCount: componentKeys.length,
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

