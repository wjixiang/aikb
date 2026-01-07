import { Tool } from "../tools/types";
import {
    EditableProps,
    EditablePropsUpdateResult,
    EditablePropsSchema
} from "./workspaceTypes";

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

    constructor(info: WorkSpaceInfo) {
        this.info = info;
    }

    /**
     * Render the workspace context for LLM
     */
    abstract renderContext(): Promise<string>;

    /**
     * Get the workspace prompt/description
     */
    abstract getWorkspacePrompt(): Promise<string>;

    /**
     * Core method for LLM to directly update editable props fields
     * This is the primary entry point for LLM-Workspace interaction
     *
     * @param fieldName - The name of editable field to update
     * @param value - The new value (null to clear)
     * @returns Result indicating success or failure with error details
     */
    abstract updateEditableProps(
        fieldName: string,
        value: any
    ): Promise<EditablePropsUpdateResult>;

    /**
     * Get the schema definition for editable props fields
     * Used to inform LLM about available fields and their constraints
     *
     * @returns Schema containing all editable field definitions
     */
    abstract getEditablePropsSchema(): EditablePropsSchema;

    /**
     * Handle multiple state update tool calls from LLM
     * This method processes an array of tool call parameters and converts them to actual state changes
     * This is a reusable implementation that iterates over updates and calls updateEditableProps
     *
     * @param updates - Array of { field_name: string, value: any } objects representing field updates
     * @returns Array of update results for each field update
     */
    async handleStateUpdateToolCall(updates: Array<{ field_name: string; value: any }>): Promise<EditablePropsUpdateResult[]> {
        const results: EditablePropsUpdateResult[] = [];

        for (const update of updates) {
            const result = await this.updateEditableProps(update.field_name, update.value);
            results.push(result);
        }

        return results;
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

/**
 * @deprecated Use WorkspaceBase abstract class instead
 * Kept for backward compatibility
 */
export type IWorkspace = WorkspaceBase;
