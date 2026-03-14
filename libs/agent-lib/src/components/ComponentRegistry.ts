/**
 * ComponentRegistry - Manages ToolComponent registration and lifecycle
 *
 * Simple registry that allows external packages to register components
 * and provides access to component tools.
 */

import { ToolComponent } from './ui/index.js';
import type { Tool } from './ui/index.js';

export interface ComponentRegistration {
    id: string;
    component: ToolComponent;
    priority?: number;
}

export class ComponentRegistry {
    private components: Map<string, ComponentRegistration> = new Map();

    /**
     * Register a component with an ID
     */
    register(id: string, component: ToolComponent, priority?: number): void {
        this.components.set(id, {
            id,
            component,
            priority,
        });
    }

    /**
     * Register multiple components from a record
     */
    registerAll(components: Record<string, ToolComponent>, defaultPriority?: number): void {
        for (const [id, comp] of Object.entries(components)) {
            this.register(id, comp, defaultPriority);
        }
    }

    /**
     * Register a component instance with priority
     */
    registerWithPriority(components: Array<{ id: string; component: ToolComponent; priority?: number }>): void {
        for (const { id, component, priority } of components) {
            this.register(id, component, priority);
        }
    }

    /**
     * Get a component by ID
     */
    get(id: string): ToolComponent | undefined {
        return this.components.get(id)?.component;
    }

    /**
     * Get registration info (including priority)
     */
    getRegistration(id: string): ComponentRegistration | undefined {
        return this.components.get(id);
    }

    /**
     * Check if a component is registered
     */
    has(id: string): boolean {
        return this.components.has(id);
    }

    /**
     * Unregister a component
     */
    unregister(id: string): boolean {
        return this.components.delete(id);
    }

    /**
     * Get all registered component IDs
     */
    getIds(): string[] {
        return Array.from(this.components.keys());
    }

    /**
     * Get all registered components sorted by priority (lower priority first)
     */
    getAll(): ToolComponent[] {
        return Array.from(this.components.values())
            .sort((a, b) => (a.priority || 0) - (b.priority || 0))
            .map(reg => reg.component);
    }

    /**
     * Get all registrations sorted by priority
     */
    getAllRegistrations(): ComponentRegistration[] {
        return Array.from(this.components.values())
            .sort((a, b) => (a.priority || 0) - (b.priority || 0));
    }

    /**
     * Get all tools from all components
     * @returns Array of tool definitions with component ID
     */
    getAllTools(): Array<{ componentId: string; tool: Tool }> {
        const tools: Array<{ componentId: string; tool: Tool }> = [];

        for (const [id, registration] of this.components) {
            for (const tool of registration.component.toolSet.values()) {
                tools.push({
                    componentId: id,
                    tool,
                });
            }
        }

        return tools;
    }

    /**
     * Get total tool count
     */
    getToolCount(): number {
        let count = 0;
        for (const registration of this.components.values()) {
            count += registration.component.toolSet.size;
        }
        return count;
    }

    /**
     * Clear all components
     */
    clear(): void {
        this.components.clear();
    }

    /**
     * Get component count
     */
    get size(): number {
        return this.components.size;
    }
}
