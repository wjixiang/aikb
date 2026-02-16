import { ToolComponent } from './toolComponent';
import { ComponentRegistration, VirtualWorkspaceConfig, Tool } from './types';
import { tdiv, th, TUIElement } from './ui';
import { z } from 'zod';

/**
 * Virtual Workspace - manages multiple ToolComponents for fine-grained LLM context
 * Uses tool calls for interaction instead of script execution
 */
export class VirtualWorkspace {
    private config: VirtualWorkspaceConfig;
    private components: Map<string, ComponentRegistration>;

    /**
     * Combine all avaliable tools from each components.
     */
    private toolSet = new Map<string, {
        tool: Tool;
        componentKey: string;
    }>();

    /**
     * Global shared tools available to all components
     */
    private globalTools = new Map<string, Tool>();

    constructor(config: VirtualWorkspaceConfig) {
        this.config = config;
        this.components = new Map();
        this.initializeGlobalTools();
    }

    /**
     * Initialize global shared tools
     */
    private initializeGlobalTools(): void {
        // Add attempt_completion tool
        this.globalTools.set('attempt_completion', {
            toolName: 'attempt_completion',
            paramsSchema: z.object({
                result: z.string().describe('The final result message to present to the user')
            }),
            desc: 'Complete the task and return final result to the user. This should be called when the task is fully accomplished.'
        });
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
        if (this.globalTools.size > 0) {
            const globalToolsArray: Tool[] = [];
            this.globalTools.forEach((tool) => globalToolsArray.push(tool));
            const globalToolsSection = new tdiv({
                content: 'GLOBAL TOOLS',
                styles: {
                    showBorder: true,
                    align: 'center'
                }
            });
            globalToolsArray.forEach(tool => {
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
            // const componentHeader = new tdiv({
            //     content: `Component: ${key}`,
            //     styles: {

            //         showBorder: true,
            //         border: { line: 'single' },
            //         align: 'center'
            //     }
            // });
            // container.addChild(componentHeader);

            // ToolComponent.render() returns TUIElement (a container), so we add it directly
            const componentRender = await registration.component.render();
            container.addChild(componentRender);
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
            // Check if it's a global tool
            if (this.globalTools.has(toolName)) {
                return await this.handleGlobalToolCall(toolName, params);
            }

            const toolToExecute = this.toolSet.get(toolName)
            if (!toolToExecute) throw new Error(`Tool not found: ${toolName}`)

            const component = this.components.get(toolToExecute?.componentKey)
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
            default:
                throw new Error(`Unknown global tool: ${toolName}`);
        }
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

        // Add global tools first
        for (const [toolName, tool] of this.globalTools.entries()) {
            tools.push({ componentKey: 'global', toolName, tool });
        }

        // Add component tools
        for (const [key, registration] of this.components.entries()) {
            for (const [toolName, tool] of registration.component.toolSet.entries()) {
                tools.push({ componentKey: key, toolName, tool });
            }
        }

        return tools;
    }

    /**
     * Get all global tools
     */
    getGlobalTools(): Map<string, Tool> {
        return new Map(this.globalTools);
    }

    /**
     * Add a global tool
     */
    addGlobalTool(tool: Tool): void {
        this.globalTools.set(tool.toolName, tool);
    }

    /**
     * Remove a global tool
     */
    removeGlobalTool(toolName: string): boolean {
        return this.globalTools.delete(toolName);
    }
}
export type { ComponentRegistration };

