import { injectable } from 'inversify';
import type { Tool, ToolComponent } from '../../../components/index.js';
import type { IToolProvider } from '../IToolProvider.js';
import { BaseToolProvider } from '../IToolProvider.js';

/**
 * Callback type for tool execution notifications
 * @param toolName - The name of the tool
 * @param params - The parameters passed to the tool
 * @param result - The result data from tool execution
 * @param success - Whether the tool execution was successful
 * @param componentKey - The component key that provided this tool
 * @param customSummary - Optional custom summary from the component
 */
export type ToolExecutedCallback = (
    toolName: string,
    params: any,
    result: any,
    success: boolean,
    componentKey: string,
    customSummary?: string
) => void;

/**
 * Component tool provider
 *
 * Provides tools from a ToolComponent instance.
 * The provider ID is derived from the component key.
 */
@injectable()
export class ComponentToolProvider extends BaseToolProvider implements IToolProvider {
    readonly id: string;
    readonly priority = 50; // Lower priority than global tools

    /**
     * Optional callback for tool execution notifications
     * Used to notify VirtualWorkspace of tool results in real-time
     */
    private onToolExecuted?: ToolExecutedCallback;

    constructor(
        private componentKey: string,
        private component: ToolComponent,
        onToolExecuted?: ToolExecutedCallback
    ) {
        super();
        this.id = `component:${componentKey}`;
        this.onToolExecuted = onToolExecuted;
    }

    /**
     * Set the tool executed callback
     */
    setOnToolExecuted(callback: ToolExecutedCallback): void {
        this.onToolExecuted = callback;
    }

    /**
     * Get all tools from the component
     */
    getTools(): Tool[] {
        return Array.from(this.component.toolSet.values());
    }

    /**
     * Get a specific tool from the component by name
     */
    getTool(name: string): Tool | undefined {
        return this.component.toolSet.get(name);
    }

    /**
     * Execute a tool on the component
     */
    async executeTool(name: string, params: any): Promise<any> {
        const tool = this.component.toolSet.get(name);
        if (!tool) {
            throw new Error(`Tool "${name}" not found in component "${this.componentKey}"`);
        }

        try {
            // Delegate to the component's handleToolCall method
            const toolCallResult = await this.component.handleToolCall(name, params);

            // Extract data and summary from ToolCallResult
            const resultData = toolCallResult?.data ?? toolCallResult;
            const customSummary = toolCallResult?.summary;

            // Use success from ToolCallResult (now required)
            const isSuccess = toolCallResult?.success !== false;

            // Notify callback if registered (for real-time tool result updates)
            if (this.onToolExecuted) {
                this.onToolExecuted(name, params, resultData, isSuccess, this.componentKey, customSummary);
            }

            return resultData;
        } catch (error) {
            // Notify callback of failure
            if (this.onToolExecuted) {
                this.onToolExecuted(
                    name,
                    params,
                    error instanceof Error ? error.message : String(error),
                    false,
                    this.componentKey
                );
            }

            throw error;
        }
    }

    /**
     * Get the component key
     */
    getComponentKey(): string {
        return this.componentKey;
    }

    /**
     * Get the component instance
     */
    getComponent(): ToolComponent {
        return this.component;
    }

    /**
     * Check if the component has a specific tool
     */
    hasTool(name: string): boolean {
        return this.component.toolSet.has(name);
    }

    /**
     * Get all tool names from this component
     */
    getToolNames(): string[] {
        return Array.from(this.component.toolSet.keys());
    }
}
