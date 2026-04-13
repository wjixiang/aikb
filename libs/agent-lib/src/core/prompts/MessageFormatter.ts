import type { Message } from '../memory/types.js';
import { PromptTemplates } from './PromptTemplates.js';

/**
 * Formats conversation history messages into XML strings for prompt building.
 *
 * This class extracts the complex conversation history formatting logic from agent.ts,
 * providing a clean, reusable interface for converting Message objects to XML format.
 *
 * The formatting follows these rules:
 * - System messages with string content: wrapped with `<workspace_context_update>` tags
 * - Messages with content blocks:
 *   - Text blocks: return block.text
 *   - Tool use blocks: formatted as `<tool_use name="${name}" id="${id}">${input}</tool_use>`
 *   - Tool result blocks: formatted as `<tool_result tool_use_id="${id}">${content}</tool_result>`
 * - Thinking blocks: skipped
 * - Final result wrapped with `<role>...</role>` tags
 */
export class MessageFormatter {
    static formatToXml(msg: Message): string {
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
                    return PromptTemplates.wrapToolResult(
                        block.tool_use_id,
                        block.content,
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

    static formatConversationHistory(history: Message[]): string[] {
        return history.map((msg) => this.formatToXml(msg));
    }
}
