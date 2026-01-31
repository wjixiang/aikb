import { ToolComponent } from './toolComponent';
import { ComponentRegistration, VirtualWorkspaceConfig } from './types';
import { tdiv, TUIElement } from './ui';

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
}
export type { ComponentRegistration };

