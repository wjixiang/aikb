/**
 * Centralized XML tag formatting for agent prompt building.
 * 
 * This class provides static methods to wrap content with XML tags
 * used throughout the agent's prompt building process.
 */
export class PromptTemplates {
    // XML tag name constants
    static readonly WORKSPACE_CONTEXT_TAG = 'workspace_context_update';
    static readonly TOOL_USE_TAG = 'tool_use';
    static readonly TOOL_RESULT_TAG = 'tool_result';

    /**
     * Wraps content with the workspace context update XML tag.
     * Used for system messages containing workspace context.
     * 
     * @param content - The content to wrap
     * @returns The content wrapped in workspace_context_update tags
     * 
     * @example
     * ```ts
     * const content = PromptTemplates.wrapWorkspaceContext('Some context');
     * // Returns: '<workspace_context_update>\nSome context\n</workspace_context_update>'
     * ```
     */
    static wrapWorkspaceContext(content: string): string {
        return `<${this.WORKSPACE_CONTEXT_TAG}>\n${content}\n</${this.WORKSPACE_CONTEXT_TAG}>`;
    }

    /**
     * Wraps tool use information with the tool_use XML tag.
     * Used for representing tool invocation blocks in the conversation.
     * 
     * @param name - The name of the tool being used
     * @param id - The unique identifier for this tool use
     * @param input - The input parameters for the tool (will be JSON stringified)
     * @returns The tool use information wrapped in tool_use tags
     * 
     * @example
     * ```ts
     * const toolUse = PromptTemplates.wrapToolUse('execute_command', 'tool_123', { command: 'ls' });
     * // Returns: '<tool_use name="execute_command" id="tool_123">{"command":"ls"}</tool_use>'
     * ```
     */
    static wrapToolUse(name: string, id: string, input: any): string {
        return `<${this.TOOL_USE_TAG} name="${name}" id="${id}">${JSON.stringify(input)}</${this.TOOL_USE_TAG}>`;
    }

    /**
     * Wraps tool result with the tool_result XML tag.
     * Used for representing the output of tool execution.
     * 
     * @param toolUseId - The ID of the tool use this result corresponds to
     * @param content - The result content from the tool execution
     * @returns The tool result wrapped in tool_result tags
     * 
     * @example
     * ```ts
     * const result = PromptTemplates.wrapToolResult('tool_123', 'Command completed successfully');
     * // Returns: '<tool_result tool_use_id="tool_123">Command completed successfully</tool_result>'
     * ```
     */
    static wrapToolResult(toolUseId: string, content: string): string {
        return `<${this.TOOL_RESULT_TAG} tool_use_id="${toolUseId}">${content}</${this.TOOL_RESULT_TAG}>`;
    }

    /**
     * Wraps a message with role-specific XML tags.
     * Used for wrapping complete messages in the conversation history.
     * 
     * @param role - The role of the message sender (e.g., 'user', 'assistant', 'system')
     * @param content - The message content
     * @returns The message wrapped in role-specific tags
     * 
     * @example
     * ```ts
     * const message = PromptTemplates.wrapMessage('user', 'Hello, how are you?');
     * // Returns: '<user>\nHello, how are you?\n</user>'
     * ```
     */
    static wrapMessage(role: string, content: string): string {
        return `<${role}>\n${content}\n</${role}>`;
    }
}
