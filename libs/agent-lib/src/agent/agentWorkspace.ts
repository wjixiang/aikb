import { Tool } from "../tools/types";
import {
    EditableProps,
    EditablePropsUpdateResult,
    EditablePropsSchema
} from "./workspaceTypes";
import { WorkspaceComponentRegistry, WorkspaceComponent } from "./componentTypes";

interface WorkSpaceInfo {
    name: string;
    desc: string;
}

/**
 * Core abstract class for Workspace implementations
 * Provides direct LLM interaction through EditableProps without toolSet
 *
 * In component-based architecture, each component manages its own state,
 * so that workspace doesn't need a separate env property.
 */
export abstract class WorkspaceBase {
    info: WorkSpaceInfo;

    // Component registry for managing workspace components
    protected componentRegistry?: WorkspaceComponentRegistry;

    // Store errors captured from handleStateUpdateToolCall
    protected capturedErrors: string[] = [];


    constructor(info: WorkSpaceInfo) {
        this.info = info;
    }

    /**
     * Render the workspace context for LLM
     * This method wraps the abstract renderContextImpl and adds captured errors
     */
    async renderContext(): Promise<string> {
        const context = await this.renderContextImpl();

        // Add captured errors as a separate paragraph if any exist
        if (this.capturedErrors.length > 0) {
            const errorsSection = this.capturedErrors.join('\n');
            return `${context}\n\n[Errors from previous operations]\n${errorsSection}`;
        }

        return context;
    }

    /**
     * Implementation method for rendering workspace context
     * Subclasses should override this method instead of renderContext
     */
    protected abstract renderContextImpl(): Promise<string>;

    /**
     * Get the workspace prompt/description
     */
    abstract getWorkspacePrompt(): Promise<string>;

    /**
     * Update editable props fields
     * Uses batch update by default - side effects are triggered only once per component
     *
     * Default implementation routes updates to component registry or action fields.
     * Subclasses can override for custom behavior.
     *
     * @param updates - Array of { field_name: string, value: any } objects
     * @returns Array of update results for each field update
     */
    async updateEditableProps(
        updates: Array<{ field_name: string; value: any }>
    ): Promise<EditablePropsUpdateResult[]> {
        const results: EditablePropsUpdateResult[] = [];

        if (!this.componentRegistry) {
            return updates.map(update => ({
                success: false,
                error: 'Component registry not initialized'
            }));
        }

        // Group updates by component
        const updatesByComponent = new Map<string, Array<{ key: string; value: any }>>();
        const fieldNameToComponentId = new Map<string, string>();

        for (const update of updates) {
            const component = this.componentRegistry.findComponentByField(update.field_name);
            if (!component) {
                results.push({
                    success: false,
                    error: `Unknown editable field: ${update.field_name}`
                });
                continue;
            }

            fieldNameToComponentId.set(update.field_name, component.id);

            if (!updatesByComponent.has(component.id)) {
                updatesByComponent.set(component.id, []);
            }
            updatesByComponent.get(component.id)!.push({
                key: update.field_name,
                value: update.value
            });
        }

        // Process updates per component
        for (const [componentId, componentUpdates] of updatesByComponent.entries()) {
            const result = await this.componentRegistry.updateMultipleComponentState(componentId, componentUpdates);

            if (result.success) {
                // Map the batch result back to individual field results
                const previousValues = result.previousValue as Record<string, any>;
                const newValues = result.newValue as Record<string, any>;

                for (const update of componentUpdates) {
                    results.push({
                        success: true,
                        updatedField: update.key,
                        previousValue: previousValues[update.key],
                        newValue: newValues[update.key]
                    });
                }
            } else {
                // All updates for this component failed
                for (const update of componentUpdates) {
                    results.push({
                        success: false,
                        error: result.error,
                        updatedField: update.key
                    });
                }
            }
        }

        return results;
    }



    /**
     * Get the schema definition for editable props fields
     * Used to inform LLM about available fields and their constraints
     *
     * Default implementation aggregates schemas from component registry and action fields.
     * Subclasses can override for custom behavior.
     *
     * @returns Schema containing all editable field definitions
     */
    getEditablePropsSchema(): EditablePropsSchema {
        const fields: Record<string, any> = {};

        // Add component fields from registry
        if (this.componentRegistry) {
            const components = this.componentRegistry.getAll();
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
        }


        return { fields };
    }

    /**
     * Handle multiple state update tool calls from LLM
     * This method processes an array of tool call parameters and converts them to actual state changes
     * Uses batch updates for efficiency - side effects are triggered only once per component
     *
     * @param updates - Array of { field_name: string, value: any } objects representing field updates
     * @returns Array of update results for each field update
     */
    async handleStateUpdateToolCall(updates: Array<{ field_name: string; value: any }>): Promise<EditablePropsUpdateResult[]> {
        // Use batch update for efficiency
        const results = await this.updateEditableProps(updates);

        // Capture errors for failed updates
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const update = updates[i];
            if (!result.success && result.error) {
                this.capturedErrors.push(`Error updating field '${update.field_name}': ${result.error}`);
            }
        }

        return results;
    }

    /**
     * Clear all captured errors
     * Call this when you want to reset the error state
     */
    clearCapturedErrors(): void {
        this.capturedErrors = [];
    }

    /**
     * Initialize workspace (load data, set up resources, etc.)
     */
    init?(): Promise<void>;

    /**
     * Reset workspace to initial state
     */
    reset?(): void;
}