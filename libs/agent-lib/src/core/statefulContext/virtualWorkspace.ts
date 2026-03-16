import { injectable, inject, optional, Container } from 'inversify';
import { ToolComponent, type VirtualWorkspaceConfig, type Tool, type IVirtualWorkspace, type RenderMode, tdiv, ttext, TUIRenderer, MarkdownRenderer, MdDiv, MdHeading, MdParagraph, MdText, type TUIElement, MdElement, renderToolSection } from '../../components/index.js';
import { ToolSource } from '../tools/IToolProvider.js';
import { TYPES } from '../di/types.js';
import type { IToolManager } from '../tools/index.js';
import { GlobalToolProvider } from '../tools/index.js';
import { ToolManager } from '../tools/ToolManager.js';
import { ComponentRegistry, type ComponentRegistration } from '../../components/index.js';
import { ComponentToolProvider } from '../tools/providers/ComponentToolProvider.js';
import chalk from 'chalk';

/**
 * Tool call summary for the LOG section
 */
export interface ToolCallSummary {
    toolName: string;
    success: boolean;
    summary: string;
    timestamp: number;
    /** Component key that provided this tool */
    componentKey?: string;
}


/**
 * Virtual Workspace - manages multiple ToolComponents for fine-grained LLM context
 * Uses tool calls for interaction instead of script execution
 *
 * This class delegates all tool management to IToolManager.
 * Components are managed directly via ComponentRegistry (no skill system).
 */
@injectable()
export class VirtualWorkspace implements IVirtualWorkspace {
    private config: VirtualWorkspaceConfig;
    private componentRegistry: ComponentRegistry;

    // Tool management system (injected)
    private toolManager: IToolManager;
    private globalToolProvider: GlobalToolProvider;


    // Tool call log for the LOG section
    private toolCallLog: ToolCallSummary[] = [];

    constructor(
        @inject(TYPES.VirtualWorkspaceConfig) @optional() config: Partial<VirtualWorkspaceConfig> = {},
        @inject(TYPES.IToolManager) @optional() toolManager?: IToolManager,
        @inject(TYPES.Container) @optional() container?: Container,
    ) {
        this.config = {
            id: config.id || 'default-workspace',
            name: config.name || 'Default Workspace',
            renderMode: config.renderMode ?? 'tui',
            ...config,
        };

        // Initialize component registry
        this.componentRegistry = new ComponentRegistry();

        // Register components from config if provided
        if (config.components) {
            for (const comp of config.components) {
                this.componentRegistry.register(
                    comp.componentId || comp.constructor.name,
                    comp
                );
            }
        }

        // ToolManager is injected when available, otherwise create a new instance
        // This allows both DI container usage and direct instantiation
        this.toolManager = toolManager ?? new ToolManager();


        // Initialize global tool provider with tool executed callback
        this.globalToolProvider = new GlobalToolProvider(this.notifyToolExecuted.bind(this));
        this.toolManager.registerProvider(this.globalToolProvider);

        // Register all components from registry as tool providers
        this.registerComponentTools();
    }

    /**
     * Register all components from registry as tool providers
     */
    private registerComponentTools(): void {
        const registrations = this.componentRegistry.getAllRegistrations();
        for (const registration of registrations) {
            const provider = new ComponentToolProvider(
                registration.id,
                registration.component,
                this.notifyToolExecuted.bind(this)
            );
            this.toolManager.registerProvider(provider);
        }
    }

    // ==================== Component Management ====================

    /**
     * Register a component with an ID
     */
    registerComponent(id: string, component: ToolComponent, priority?: number): void {
        this.componentRegistry.register(id, component, priority);

        // Also register as a tool provider with tool executed callback
        const provider = new ComponentToolProvider(id, component, this.notifyToolExecuted.bind(this));
        this.toolManager.registerProvider(provider);
    }

    /**
     * Register multiple components
     */
    registerComponents(components: Array<{ id: string; component: ToolComponent; priority?: number }>): void {
        this.componentRegistry.registerWithPriority(components);

        // Register all as tool providers with tool executed callback
        for (const { id, component } of components) {
            const provider = new ComponentToolProvider(id, component, this.notifyToolExecuted.bind(this));
            this.toolManager.registerProvider(provider);
        }
    }

    /**
     * Get the IToolManager instance (for Agent integration)
     */
    getToolManager(): IToolManager {
        return this.toolManager;
    }

    /**
     * Get the component registry
     */
    getComponentRegistry(): ComponentRegistry {
        return this.componentRegistry;
    }

    /**
     * Get a registered component by ID
     */
    getComponent(id: string): ToolComponent | undefined {
        return this.componentRegistry.get(id);
    }

    /**
     * Get all registered component IDs
     */
    getComponentKeys(): string[] {
        return this.componentRegistry.getIds();
    }

    /**
     * Callback for when tool availability changes
     */
    private onToolAvailabilityChange?: (() => void) | undefined;

    /**
     * Set callback for when tool availability changes
     */
    setOnToolAvailabilityChange(callback: () => void): void {
        this.onToolAvailabilityChange = callback;
    }

    /**
     * Callback for real-time tool execution notifications
     * This is called by ComponentToolProvider immediately after tool execution
     */
    private onToolExecuted?: (toolName: string, params: any, result: any, success: boolean, componentKey: string, customSummary?: string) => void;

    /**
     * Set callback for real-time tool execution notifications
     * This allows VirtualWorkspace to receive tool results immediately after execution
     */
    setOnToolExecuted(callback: (toolName: string, params: any, result: any, success: boolean, componentKey: string, customSummary?: string) => void): void {
        this.onToolExecuted = callback;
    }

    /**
     * Notify workspace of a tool execution result in real-time
     * This updates the tool call log immediately after tool execution
     */
    notifyToolExecuted(toolName: string, params: any, result: any, success: boolean, componentKey: string, customSummary?: string): void {
        // Get current max count
        const maxCount = this.config.toolCallLogCount ?? 3;

        if (maxCount <= 0) {
            return;
        }

        // Use custom summary if provided, otherwise generate default summary
        const summary = customSummary ?? this.summarizeToolResult(toolName, result, componentKey);

        // Add to the log (keep only last maxCount entries)
        this.toolCallLog.push({
            toolName,
            success,
            summary,
            timestamp: Date.now(),
            componentKey
        });

        // Trim to max count
        if (this.toolCallLog.length > maxCount) {
            this.toolCallLog = this.toolCallLog.slice(-maxCount);
        }
    }

    /**
     * Generate a brief summary of tool result for the LOG section
     * @param toolName The name of the tool
     * @param result The result from the tool execution
     * @param componentKey The component key that provided this tool (optional)
     */
    private summarizeToolResult(toolName: string, result: any, componentKey?: string): string {
        if (!result) {
            return componentKey ? `[${componentKey}] (no result)` : '(no result)';
        }

        // Try to extract key information based on tool name
        try {
            let summary: string;

            if (typeof result === 'string') {
                // If result is a string, truncate it
                summary = result.length > 200 ? result.substring(0, 200) + '...' : result;
            } else if (typeof result === 'object') {
                // Common patterns for tool results
                const keys = Object.keys(result);

                // If it has a 'result' or 'data' key, use that
                if ('result' in result && typeof result.result === 'string') {
                    summary = result.result.length > 200 ? result.result.substring(0, 200) + '...' : result.result;
                } else if ('data' in result) {
                    summary = JSON.stringify(result.data).length > 200
                        ? JSON.stringify(result.data).substring(0, 200) + '...'
                        : JSON.stringify(result.data);
                } else if ('message' in result) {
                    summary = result.message.length > 200 ? result.message.substring(0, 200) + '...' : result.message;
                } else {
                    // Otherwise, just list the keys
                    summary = `[${keys.join(', ')}]`;
                }
            } else {
                summary = String(result);
            }

            // Prepend component key if available
            if (componentKey) {
                return `[${componentKey}] ${summary}`;
            }
            return summary;
        } catch {
            return componentKey ? `[${componentKey}] (result processing failed)` : '(result processing failed)';
        }
    }

    /**
     * Get current tool call log
     */
    getToolCallLog(): ToolCallSummary[] {
        return [...this.toolCallLog];
    }

    /**
     * Render component section for LLM context (TUI mode)
     * Renders all registered components
     */
    renderComponentsSection(): TUIElement {
        const container = new tdiv({
            styles: {
                showBorder: true,
            }
        });

        container.addChild(new tdiv({
            content: 'COMPONENTS',
            styles: {
                align: 'center'
            }
        }));

        const componentIds = this.componentRegistry.getIds();

        if (componentIds.length === 0) {
            container.addChild(new tdiv({
                content: 'No components registered',
                styles: { showBorder: false }
            }));
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return container;
        }

        // List all components
        for (const id of componentIds) {
            const component = this.componentRegistry.get(id);
            if (component) {
                const displayName = component.displayName || id;
                const description = component.description || '';

                container.addChild(new tdiv({
                    content: `**Component ID:** \`${id}\`\n**Display Name:** ${displayName}\n**Description:** ${description}\n`,
                    styles: { showBorder: false }
                }));
                container.addChild(new tdiv({
                    content: `\n\n---\n\n`,
                    styles: { showBorder: false }
                }));
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return container;
    }

    /**
     * Render component section for LLM context (Markdown mode)
     */
    renderComponentsSectionMarkdown(): MdElement {
        const container = new MdDiv({
            styles: { showBorder: true }
        }, [], 0);

        container.addChild(new MdHeading({
            content: 'COMPONENTS'
        }, [], 0));

        const componentIds = this.componentRegistry.getIds();

        if (componentIds.length === 0) {
            container.addChild(new MdParagraph({
                content: 'No components registered'
            }, [], 1));
            return container;
        }

        // List all components
        for (const id of componentIds) {
            const component = this.componentRegistry.get(id);
            if (component) {
                const displayName = component.displayName || id;
                const description = component.description || '';

                container.addChild(new MdParagraph({
                    content: `**Component ID:** \`${id}\`\n**Display Name:** ${displayName}\n**Description:** ${description}`
                }, [], 1));
            }
        }

        return container;
    }

    /**
     * Render the tool call log section (Markdown style)
     */
    renderToolCallLogSectionMarkdown(): MdElement {
        const maxCount = this.config.toolCallLogCount ?? 3;
        const container = new MdDiv({
            styles: { showBorder: false }
        }, [], 0);

        // Header
        const sliderIndicator = this.toolCallLog.length > maxCount
            ? ` (showing last ${maxCount} of ${this.toolCallLog.length})`
            : '';
        container.addChild(new MdHeading({
            content: `### Recent Tool Calls${sliderIndicator}`
        }, [], 1));

        // Render each tool call as markdown list items
        const logEntries = this.toolCallLog.slice(-maxCount);
        logEntries.forEach((entry, index) => {
            const isLatest = index === logEntries.length - 1;
            const prefix = isLatest ? '**>**' : '-';
            const status = entry.success ? '`OK`' : '`FAIL`';
            // console.debug(chalk.yellow(JSON.stringify(entry)))

            container.addChild(new MdParagraph({
                content: `${prefix} ${status} \`${entry.toolName}\`: ${entry.summary}`
            }, [], 2));
        });

        return container;
    }

    /**
     * Render component-specific tools section
     * Shows all tools from registered components
     */
    async renderComponentToolsSection(): Promise<TUIElement | null> {
        const componentIds = this.componentRegistry.getIds();
        const tools: Tool[] = [];

        for (const id of componentIds) {
            const component = this.componentRegistry.get(id);
            if (component) {
                for (const tool of component.toolSet.values()) {
                    if (this.toolManager.isToolEnabled(tool.toolName)) {
                        tools.push(tool);
                    }
                }
            }
        }

        if (tools.length === 0) {
            return null;
        }

        const container = new tdiv({
            styles: {
                showBorder: true,
                border: { line: 'double' }
            }
        });

        container.addChild(new tdiv({
            content: `COMPONENT TOOLS`,
            styles: { align: 'center' }
        }));

        const toolSection = renderToolSection(tools);
        container.addChild(toolSection);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return container;
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

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return container

    }

    /**
     * Render the tool call log section (TUI mode)
     * Render the tool call log section (Markdown style for both TUI and Markdown modes)
     */
    renderToolCallLogSection(): TUIElement {
        const maxCount = this.config.toolCallLogCount ?? 3;

        // Use simple markdown-style container without borders
        const container = new tdiv({
            styles: { showBorder: false }
        });

        // Header
        const sliderIndicator = this.toolCallLog.length > maxCount
            ? ` (showing last ${maxCount} of ${this.toolCallLog.length})`
            : '';
        container.addChild(new tdiv({
            content: `**Recent Tool Calls**${sliderIndicator}`,
            styles: { showBorder: false }
        }));

        // Render each tool call as markdown list items
        const logEntries = this.toolCallLog.slice(-maxCount);
        logEntries.forEach((entry, index) => {
            const isLatest = index === logEntries.length - 1;
            const prefix = isLatest ? '**>**' : '-';
            const status = entry.success ? '`OK`' : '`FAIL`';

            container.addChild(new tdiv({
                content: `${prefix} ${status} \`${entry.toolName}\`: ${entry.summary}`,
                styles: { showBorder: false }
            }));
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return container;
    }

    /**
     * Render the entire workspace as context for LLM
     * Dispatches to the appropriate renderer based on render mode
     */
    private async _render(): Promise<TUIElement | MdElement> {
        if (this.config.renderMode === 'markdown') {
            return this._renderMarkdown();
        }
        return this._renderTUI();
    }

    /**
     * Render in Markdown mode
     */
    private async _renderMarkdown(): Promise<MdElement> {
        const container = new MdDiv({
            content: `# VIRTUAL WORKSPACE: ${this.config.name}`,
        }, [], 0);

        // Add description if present
        if (this.config.description) {
            container.addChild(new MdParagraph({
                content: `**Description:** ${this.config.description}`,
            }, undefined, 1));
        }

        // Add components section
        container.addChild(this.renderComponentsSectionMarkdown());

        // Render all registered components
        const sortedRegistrations = this.componentRegistry.getAllRegistrations();

        for (const registration of sortedRegistrations) {
            const componentContainer = new MdDiv({
                content: `## ${registration.id}`,
                styles: { showBorder: true }
            }, [], 1);

            const componentRender = await registration.component.renderImply();
            // renderImply returns TUIElement[], wrap them appropriately for markdown
            for (const element of componentRender) {
                // Convert TUIElement to markdown representation
                const rendered = element.render();
                componentContainer.addChild(new MdParagraph({
                    content: rendered,
                }, undefined, 2));
            }
            container.addChild(componentContainer);
        }

        // Add LOG section for recent tool calls
        if (this.toolCallLog.length > 0) {
            container.addChild(this.renderToolCallLogSectionMarkdown());
        }

        return container;
    }

    /**
     * Render in TUI mode
     */
    private async _renderTUI(): Promise<TUIElement> {
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

        // Add components section
        container.addChild(this.renderComponentsSection());

        // Render all registered components
        const sortedRegistrations = this.componentRegistry.getAllRegistrations();

        for (const registration of sortedRegistrations) {
            const componentContainer = new tdiv({
                content: registration.id,
                styles: { showBorder: true }
            });

            const componentRender = await registration.component.renderImply();
            // renderImply returns an array, so add each element
            componentRender.forEach(element => componentContainer.addChild(element));
            container.addChild(componentContainer);
        }

        // Add LOG section for recent tool calls
        if (this.toolCallLog.length > 0) {
            container.addChild(this.renderToolCallLogSection());
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
        const componentKeys = this.componentRegistry.getIds();
        const totalTools = this.componentRegistry.getToolCount();

        return {
            componentCount: this.componentRegistry.size,
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
export type { ComponentRegistration };
