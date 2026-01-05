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
import { IWorkspace } from "./agentWorkspace";
import {
    EditableProps,
    EditablePropsUpdateResult,
    EditablePropsSchema,
    renderEditablePropsAsPrompt
} from "./workspaceTypes";
import { createComponentRegistry } from "./componentRegistry";
import { BookSelectorComponent, BookViewerComponent, SearchComponent, WorkspaceInfoComponent } from "./bookshelfComponents";

/**
 * BookshelfWorkspace - Pure component-based implementation
 * 
 * In this architecture, the workspace doesn't have a central `env` property.
 * Instead, each component manages its own state independently.
 * The workspace simply aggregates component renders for the LLM.
 */
export class BookshelfWorkspace implements IWorkspace {
    info = {
        name: 'BookshelfWorkspace',
        desc: 'A workspace for managing and searching through a collection of books. Provides semantic search capabilities and book browsing functionality. All operations are performed through EditableProps updates.'
    };

    // Component-based architecture - no central env
    private componentRegistry = createComponentRegistry();

    // Expose editable props from all components (for LLM interaction)
    editableProps: Record<string, EditableProps>;

    // Special action fields (triggered by setting these to true)
    private actionFields: Record<string, EditableProps>;

    initialized = false;

    constructor() {
        this.editableProps = {};
        this.actionFields = {};
    }

    async init() {
        // Register all components
        await Promise.all([
            this.componentRegistry.register(new WorkspaceInfoComponent()),
            this.componentRegistry.register(new BookSelectorComponent()),
            this.componentRegistry.register(new BookViewerComponent({ currentBook: null })),
            this.componentRegistry.register(new SearchComponent()),
        ])


        this.initialized = true;
    }


    /**
     * Render context by aggregating all component renders
     * This is similar to React's render tree
     * Each component renders its own state independently
     */
    renderContext: () => string = () => {
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
     * Get the schema definition for editable props fields
     * Aggregates schemas from all components
     */
    getEditablePropsSchema(): EditablePropsSchema {
        const components = this.componentRegistry.getAll();
        const fields: Record<string, any> = {};

        // Add component fields
        for (const component of components) {
            for (const [key, field] of Object.entries(component.editableProps)) {
                const statusField = field as EditableProps;
                fields[key] = {
                    description: statusField.description,
                    dependsOn: statusField.dependsOn,
                    componentId: component.id,
                    schema: statusField.schema
                };
            }
        }

        // Add action fields
        for (const [key, field] of Object.entries(this.actionFields)) {
            fields[key] = {
                description: field.description,
                componentId: 'workspace_actions',
                schema: field.schema
            };
        }

        return { fields };
    }

    /**
     * Core method for LLM to directly update editable props fields
     * Routes updates to the appropriate component
     * 
     * Workflow:
     * 1. LLM calls updateEditableProps(fieldName, value)
     * 2. Workspace routes to the component that owns this field
     * 3. Component validates and updates its state
     * 4. Component's side effects are triggered
     * 5. Component re-renders
     * 6. Workspace aggregates all component renders
     * 7. Context is refreshed for LLM
     */
    async updateEditableProps(fieldName: string, value: any): Promise<EditablePropsUpdateResult> {
        // Check if this is an action field
        if (this.actionFields[fieldName]) {
            return await this.handleActionField(fieldName, value);
        }

        // Find component that owns this field
        const component = this.componentRegistry.findComponentByField(fieldName);
        if (!component) {
            return {
                success: false,
                error: `Unknown editable field: ${fieldName}`
            };
        }

        // Update component state
        const result = await this.componentRegistry.updateComponentState(component.id, fieldName, value);

        // Sync workspace editableProps with component's editableProps
        if (result.success) {
            const updatedComponent = this.componentRegistry.get(component.id);
            if (updatedComponent && updatedComponent.editableProps[fieldName]) {
                // Don't overwrite readonly fields - preserve their readonly flag
                if (!this.editableProps[fieldName]?.readonly) {
                    this.editableProps[fieldName] = { ...updatedComponent.editableProps[fieldName] };
                } else if ((updatedComponent.editableProps[fieldName] as EditableProps).readonly) {
                    // If the component's field is readonly, mark workspace field as readonly too
                    this.editableProps[fieldName] = { ...updatedComponent.editableProps[fieldName], readonly: true };
                }
            }
        }

        return {
            success: result.success,
            error: result.error,
            updatedField: fieldName,
            previousValue: result.previousValue,
            newValue: result.newValue
        };
    }

    /**
     * Handle action field updates (special fields that trigger operations)
     */
    private async handleActionField(fieldName: string, value: any): Promise<EditablePropsUpdateResult> {
        const previousValue = this.editableProps[fieldName]?.value;

        switch (fieldName) {
            case 'semantic_search':
                if (value && value !== null) {
                    // Update search component state
                    const searchComponent = this.componentRegistry.get('search');
                    if (searchComponent) {
                        await this.componentRegistry.updateComponentState('search', 'search_query', value);
                    }

                    this.editableProps[fieldName].value = value;
                    return {
                        success: true,
                        updatedField: fieldName,
                        previousValue,
                        newValue: value,
                        data: { query: value, results: searchComponent?.state['results'] || [] }
                    };
                }
                return {
                    success: true,
                    updatedField: fieldName,
                    previousValue,
                    newValue: null
                };

            default:
                return {
                    success: false,
                    error: `Unknown action field: ${fieldName}`
                };
        }
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
