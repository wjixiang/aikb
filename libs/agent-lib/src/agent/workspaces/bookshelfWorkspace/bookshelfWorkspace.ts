/**
 * Bookshelf Workspace - Component-based implementation
 *
 * This workspace demonstrates a pure component-based architecture where:
 * - Workspace is composed of multiple components
 * - Each component has its own state and editable props
 * - Components re-render when their state changes
 * - No central env property - components are self-contained
 * - Similar to React's component model but for LLM interaction
 * - All operations are performed through EditableProps updates
 */

import { z } from 'zod';
import { WorkspaceBase } from "../../agentWorkspace";
import {
    EditableProps,
    EditablePropsUpdateResult,
    EditablePropsSchema,
    renderEditablePropsAsPrompt
} from "../../workspaceTypes";
import { createComponentRegistry } from "../../componentRegistry";
import { BookViewerComponent, WorkspaceInfoComponent } from "./bookshelfComponents";

/**
 * BookshelfWorkspace - Pure component-based implementation
 *
 * In this architecture, workspace doesn't have a central `env` property.
 * Instead, each component manages its own state independently.
 * The workspace simply aggregates component renders for the LLM.
 */
export class BookshelfWorkspace extends WorkspaceBase {
    // Component-based architecture - no central env
    override componentRegistry = createComponentRegistry();

    initialized = false;

    constructor() {
        super({
            name: 'BookshelfWorkspace',
            desc: 'A workspace for managing and searching through a collection of books. Provides semantic search capabilities and book browsing functionality. All operations are performed through EditableProps updates.'
        });
    }

    /**
     * Get editable props for backward compatibility
     * This aggregates editable props from all components and action fields
     */
    get editableProps(): Record<string, EditableProps> {
        const props: Record<string, EditableProps> = {};

        // Add component editable props
        const components = this.componentRegistry.getAll();
        for (const component of components) {
            for (const [key, field] of Object.entries(component.editableProps)) {
                props[key] = field as EditableProps;
            }
        }

        return props;
    }

    async getWorkspacePrompt(): Promise<string> {
        return `=====
Workspace Description

The area below is interactable, content will be refreshed between each conversation depending on your <update_workspace> action.
        `;
    }

    override reset?(): void;

    override async init(): Promise<void> {
        // Register all components
        await Promise.all([
            this.componentRegistry.register(new WorkspaceInfoComponent()),
            this.componentRegistry.register(new BookViewerComponent()),
        ]);

        this.initialized = true;
    }

    /**
     * Render context by aggregating all component renders
     * This is similar to React's render tree
     * Each component renders its own state independently
     */
    protected async renderContextImpl(): Promise<string> {
        if (!this.initialized) await this.init();
        const components = this.componentRegistry.getAll();
        const componentRenders = components
            .map((comp: any) => comp.render())
            .join('\n\n---\n\n');

        return `
################################
------Bookshelf Workspace-------
################################

${componentRenders}
        `;
    }

    /**
     * Get all components (for testing/debugging)
     */
    getComponents(): any[] {
        return this.componentRegistry.getAll();
    }

    /**
     * Get component registry (for testing/debugging)
     */
    getComponentRegistry(): any {
        return this.componentRegistry;
    }

    /**
     * Get component by ID (for testing/debugging)
     */
    getComponent(id: string): any {
        return this.componentRegistry.get(id);
    }
}
