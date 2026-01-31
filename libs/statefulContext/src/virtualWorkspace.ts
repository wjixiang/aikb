import { ToolComponent } from './toolComponent';
import { ComponentRegistration, VirtualWorkspaceConfig } from './types';
import { tdiv, th, TUIElement } from './ui';

/**
 * Virtual Workspace - manages multiple ToolComponents for fine-grained LLM context
 * Uses tool calls for interaction instead of script execution
 */
export class VirtualWorkspace {
    private config: VirtualWorkspaceConfig;
    private components: Map<string, ComponentRegistration>;

    constructor(config: VirtualWorkspaceConfig) {
        this.config = config;
        this.components = new Map();
    }

    /**
     * Register a component with the workspace
     */
    registerComponent(registration: ComponentRegistration): void {
        this.components.set(registration.key, registration);
    }

    /**
     * Unregister a component from the workspace
     */
    unregisterComponent(key: string): boolean {
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
                width: 80,
                showBorder: false
            }
        });

        // Render workspace header using tdiv
        const workspaceHeader = new tdiv({
            content: `VIRTUAL WORKSPACE: ${this.config.name}`,
            styles: {
                width: 80,
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
                styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
            }));
        }

        container.addChild(new tdiv({
            content: `Workspace ID: ${this.config.id}\nComponents: ${this.components.size}`,
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));

        // Sort components by priority
        const sortedComponents = Array.from(this.components.entries())
            .sort(([, a], [, b]) => (a.priority || 0) - (b.priority || 0));

        for (const [key, registration] of sortedComponents) {
            // Render component header using tdiv
            const componentHeader = new tdiv({
                content: `Component: ${key}`,
                styles: {
                    width: 80,
                    height: 0,
                    showBorder: true,
                    border: { line: 'single' },
                    align: 'center'
                }
            });
            container.addChild(componentHeader);

            // ToolComponent.render() returns TUIElement[], so we need to add each element
            const componentRenders = await registration.component.render();
            for (const element of componentRenders) {
                container.addChild(element);
            }
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
    async handleToolCall(componentKey: string, toolName: string, params: any): Promise<any> {
        const component = this.getComponent(componentKey);
        if (!component) {
            return { error: `Component not found: ${componentKey}` };
        }

        // Check if the component has the tool
        if (!component.toolSet.has(toolName)) {
            return { error: `Tool not found: ${toolName} in component: ${componentKey}` };
        }

        try {
            await component.handleToolCall(toolName, params);
            return { success: true };
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
    getAllTools(): Array<{ componentKey: string; toolName: string; tool: any }> {
        const tools: Array<{ componentKey: string; toolName: string; tool: any }> = [];

        for (const [key, registration] of this.components.entries()) {
            for (const [toolName, tool] of registration.component.toolSet.entries()) {
                tools.push({ componentKey: key, toolName, tool });
            }
        }

        return tools;
    }
}
export type { ComponentRegistration };

