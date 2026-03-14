import { injectable } from 'inversify';
import type { Tool, ToolComponent } from '../../components/index.js';
import type { IToolProvider } from '../IToolProvider.js';
import { BaseToolProvider } from '../IToolProvider.js';

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

    constructor(
        private componentKey: string,
        private component: ToolComponent
    ) {
        super();
        this.id = `component:${componentKey}`;
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

        // Delegate to the component's handleToolCall method
        return await this.component.handleToolCall(name, params);
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
