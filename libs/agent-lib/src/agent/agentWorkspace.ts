import { Tool } from "../tools/types";
import {
    EditableStatus,
    EditableStatusUpdateResult,
    EditableStatusSchema
} from "./workspaceTypes";

interface WorkSpaceInfo {
    name: string;
    desc: string;
}

interface WorkspaceLlmInterface {
    input: any;
    output: any;
}

/**
 * Core interface for Workspace implementations
 * Provides direct LLM interaction through EditableStatus without toolSet
 * 
 * In component-based architecture, each component manages its own state,
 * so the workspace doesn't need a separate env property.
 */
export interface IWorkspace {
    info: WorkSpaceInfo;
    editableStatus: Record<string, EditableStatus>;
    renderContext: () => string;

    /**
     * Core method for LLM to directly update editable status fields
     * This is the primary entry point for LLM-Workspace interaction
     *
     * @param fieldName - The name of the editable field to update
     * @param value - The new value (null to clear)
     * @returns Result indicating success or failure with error details
     */
    updateEditableStatus: (
        fieldName: string,
        value: any
    ) => Promise<EditableStatusUpdateResult>;

    /**
     * Get the schema definition for editable status fields
     * Used to inform LLM about available fields and their constraints
     *
     * @returns Schema containing all editable field definitions
     */
    getEditableStatusSchema: () => EditableStatusSchema;

    /**
     * Initialize the workspace (load data, set up resources, etc.)
     */
    init?: () => Promise<void>;

    /**
     * Reset the workspace to initial state
     */
    reset?: () => void;
}
