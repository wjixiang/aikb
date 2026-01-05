import { ToolArgs } from './types';

export function getUpdateWorkspaceDescription(args?: ToolArgs): string {
    return `## update_workspace
Description: Update editable status fields in the workspace. This tool allows you to modify fields that are marked as [EDITABLE] in the workspace description. When you need to modify a field, use this tool to update the editable status field. The field will be validated against its schema. If the update is successful, the workspace state will change and side effects will be triggered. If the update fails, you will receive an error message.

IMPORTANT: Only modify fields that are marked as [EDITABLE]. Read-only fields cannot be modified. Some fields may depend on other fields - modifying a field may trigger cascading updates. Always check the current workspace state before making changes.

Parameters:
- field_name: (required) The name of the editable field to update. Must be a field marked as [EDITABLE] in the workspace.
- value: (required) The new value for the field. Set to null to clear the field. The value must match the field's schema.

Usage:
<update_workspace>
<field_name>
name_of_the_field
</field_name>
<value>
new_value_here
</value>
</update_workspace>

Example: Updating a status field
<update_workspace>
<field_name>
current_status
</field_name>
<value>
in_progress
</value>
</update_workspace>

Example: Clearing a field
<update_workspace>
<field_name>
notes
</field_name>
<value>
null
</value>
</update_workspace>`;
}
