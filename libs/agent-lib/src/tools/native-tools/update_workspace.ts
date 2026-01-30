import type OpenAI from 'openai';

const UPDATE_WORKSPACE_DESCRIPTION = `
Update editable status fields in the workspace. This tool allows you to modify fields that are marked as [EDITABLE] in the workspace description.
When you need to modify a field, use this tool to update the editable status field. The field will be validated against its schema.
If the update is successful, the workspace state will change and side effects will be triggered.
If the update fails, you will receive an error message.

IMPORTANT: Only modify fields that are marked as [EDITABLE]. Read-only fields cannot be modified.
`;

const FIELD_NAME_DESCRIPTION = `The name of the editable field to update. Must be a field marked as [EDITABLE] in the workspace.`;

const VALUE_DESCRIPTION = `The new value for the field. Set to null to clear the field. The value must match the field's schema.`;

export default {
    type: 'function',
    function: {
        name: 'update_workspace',
        description: UPDATE_WORKSPACE_DESCRIPTION,
        strict: true,
        parameters: {
            type: 'object',
            properties: {
                field_name: {
                    type: 'string',
                    description: FIELD_NAME_DESCRIPTION,
                },
                value: {
                    description: VALUE_DESCRIPTION,
                },
            },
            required: ['field_name', 'value'],
            additionalProperties: false,
        },
    },
} satisfies OpenAI.Chat.ChatCompletionTool;
