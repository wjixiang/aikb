import Anthropic from '@anthropic-ai/sdk';
import { ApiMessage } from '../task/task.type';
import { PromptTemplates } from './PromptTemplates';

/**
 * Formats conversation history messages into XML strings for prompt building.
 * 
 * This class extracts the complex conversation history formatting logic from agent.ts,
 * providing a clean, reusable interface for converting ApiMessage objects to XML format.
 * 
 * The formatting follows these rules:
 * - System messages with string content: wrapped with `<workspace_context_update>` tags
 * - Messages with string content: used as-is
 * - Messages with content blocks:
 *   - Text blocks: return block.text
 *   - Tool use blocks: formatted as `<tool_use name="${name}" id="${id}">${input}</tool_use>`
 *   - Tool result blocks: formatted as `<tool_result tool_use_id="${id}">${content}</tool_result>`
 * - Final result wrapped with `<role>...</role>` tags
 */
export class MessageFormatter {
    /**
     * Formats a single ApiMessage to an XML string.
     *
     * This method handles different message content types and formats them appropriately:
     * - System messages are wrapped in workspace context tags
     * - Messages with content blocks are processed block by block
     *
     * @param msg - The ApiMessage to format
     * @returns The formatted message as an XML string
     *
     * @example
     * ```ts
     * const msg: ApiMessage = {
     *   role: 'system',
     *   content: [{ type: 'text', text: 'Some context' }]
     * };
     * const formatted = MessageFormatter.formatToXml(msg);
     * // Returns: '<system>\n<workspace_context_update>\nSome context\n</workspace_context_update>\n</system>'
     * ```
     */
    static formatToXml(msg: ApiMessage): string {
        const role = msg.role;

        // Handle content blocks
        const content = msg.content
            .map((block) => {
                if (block.type === 'text') {
                    return block.text;
                } else if (block.type === 'tool_use') {
                    return PromptTemplates.wrapToolUse(
                        block.name,
                        block.id,
                        block.input,
                    );
                } else if (block.type === 'tool_result') {
                    const content = typeof block.content === 'string'
                        ? block.content
                        : JSON.stringify(block.content);
                    return PromptTemplates.wrapToolResult(
                        block.tool_use_id,
                        content,
                    );
                } else if (block.type === 'thinking') {
                    // Skip thinking blocks in XML output
                    return '';
                }
                return '';
            })
            .join('\n');

        // Special handling for system messages containing workspace context
        const wrappedContent = msg.role === 'system'
            ? PromptTemplates.wrapWorkspaceContext(content)
            : content;

        return PromptTemplates.wrapMessage(role, wrappedContent);
    }

    /**
     * Formats an entire conversation history into an array of XML strings.
     * 
     * This method processes each message in the conversation history and converts
     * it to an XML-formatted string using the formatToXml method.
     * 
     * @param history - Array of ApiMessage objects representing the conversation history
     * @returns Array of formatted XML strings, one for each message
     * 
     * @example
     * ```ts
     * const history: ApiMessage[] = [
     *   { role: 'user', content: 'Hello' },
     *   { role: 'assistant', content: 'Hi there!' }
     * ];
     * const formatted = MessageFormatter.formatConversationHistory(history);
     * // Returns: [
     * //   '<user>\nHello\n</user>',
     * //   '<assistant>\nHi there!\n</assistant>'
     * // ]
     * ```
     */
    static formatConversationHistory(history: ApiMessage[]): string[] {
        return history.map((msg) => this.formatToXml(msg));
    }
}
