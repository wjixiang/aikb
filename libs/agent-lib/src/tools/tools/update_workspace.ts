import update_workspace from '../native-tools/update_workspace';
import { getUpdateWorkspaceDescription } from '../update-workspace';
import { Tool, ToolContext, ToolResponse } from '../types';
import { IWorkspace } from '../../agent/agentWorkspace';

/**
 * Update workspace tool - allows LLM to modify editable status fields in the workspace
 */
export const update_workspace_tool: Tool = {
    desc: {
        native: update_workspace,
        xml: getUpdateWorkspaceDescription,
    },
    resolve: async function (args: any, context?: ToolContext): Promise<ToolResponse> {
        const fieldName = args['field_name'] as string;
        const value = args['value'];
        const workspace = context?.workspace as IWorkspace;

        // Check if workspace is available
        if (!workspace) {
            return {
                type: 'text',
                content: 'Error: Workspace is not available. Cannot update workspace fields.',
                isError: true,
            };
        }

        try {
            // Get the editable props schema to validate field existence
            const schema = workspace.getEditablePropsSchema();

            // Check if the field exists and is editable
            const field = schema.fields[fieldName];
            if (!field) {
                return {
                    type: 'text',
                    content: `Error: Field '${fieldName}' does not exist or is not editable. Please check the workspace context for available editable fields.`,
                    isError: true,
                };
            }

            // Check if the field is read-only
            if (field.readonly) {
                return {
                    type: 'text',
                    content: `Error: Field '${fieldName}' is read-only and cannot be modified.`,
                    isError: true,
                };
            }

            // Update the field
            const result = await workspace.updateEditableProps(fieldName, value);

            if (result.success) {
                const previousValue = result.previousValue !== undefined
                    ? JSON.stringify(result.previousValue)
                    : 'not set';
                const newValue = result.newValue !== undefined
                    ? JSON.stringify(result.newValue)
                    : 'cleared';

                return {
                    type: 'text',
                    content: `Successfully updated field '${fieldName}':\n- Previous value: ${previousValue}\n- New value: ${newValue}`,
                };
            } else {
                return {
                    type: 'text',
                    content: `Error updating field '${fieldName}': ${result.error}`,
                    isError: true,
                };
            }
        } catch (error) {
            console.error('Update workspace error:', error);
            return {
                type: 'text',
                content: `Error updating workspace: ${error instanceof Error ? error.message : 'Unknown error'}`,
                isError: true,
            };
        }
    },
};
