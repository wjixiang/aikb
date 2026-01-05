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
 * Core interface for Workspace implementations
 * Provides direct LLM interaction through EditableProps without toolSet
 * 
 * In component-based architecture, each component manages its own state,
 * so that workspace doesn't need a separate env property.
 */
export interface IWorkspace {
    info: WorkSpaceInfo;
    editableProps: Record<string, EditableProps>;
    renderContext: () => Promise<string>;

    /**
     * Core method for LLM to directly update editable props fields
     * This is the primary entry point for LLM-Workspace interaction
     *
     * @param fieldName - The name of editable field to update
     * @param value - The new value (null to clear)
     * @returns Result indicating success or failure with error details
     */
    updateEditableProps: (
        fieldName: string,
        value: any
    ) => Promise<EditablePropsUpdateResult>;

    /**
     * Get the schema definition for editable props fields
     * Used to inform LLM about available fields and their constraints
     *
     * @returns Schema containing all editable field definitions
     */
    getEditablePropsSchema: () => EditablePropsSchema;

    /**
     * Handle multiple state update tool calls from LLM
     * This method processes an array of tool call parameters and converts them to actual state changes
     *
     * @param updates - Array of { field_name: string, value: any } objects representing field updates
     * @returns Array of update results for each field update
     */
    handleStateUpdateToolCall: (updates: Array<{ field_name: string; value: any }>) => Promise<EditablePropsUpdateResult[]>;

    /**
     * Initialize workspace (load data, set up resources, etc.)
     */
    init?: () => Promise<void>;

    /**
     * Reset workspace to initial state
     */
    reset?: () => void;
}
