import type { Message, ContentBlock } from '../memory/types.js';
import { MessageFormatter } from './MessageFormatter.js';

/**
 * Interface for the structured prompt used by BAML.
 *
 * This interface represents the complete prompt structure that will be passed
 * to the BAML API request, containing all necessary context for the agent.
 */
export interface FullPrompt {
    /** The system prompt that defines the agent's behavior and instructions */
    systemPrompt: string;
    /** The workspace context containing current workspace state and information */
    workspaceContext: string;
    /** The conversation history formatted as an array of XML strings */
    memoryContext: string[];
}

/**
 * A fluent builder class for constructing unified prompts.
 *
 * This class provides a clean, fluent API for building prompts that will be
 * passed to BAML. It consolidates the prompt building logic from agent.ts,
 * making it easier to maintain and test.
 *
 * The builder follows these steps:
 * 1. Set the system prompt (agent's core instructions)
 * 2. Set the workspace context (current workspace state)
 * 3. Set the conversation history (previous interactions)
 * 4. Build the final FullPrompt object
 *
 * During the build process, the conversation history is:
 * - Filtered to only include relevant roles (user, assistant, system)
 * - Cleaned to remove ThinkingBlock content
 * - Formatted using MessageFormatter to produce XML strings
 *
 * @example
 * ```ts
 * const builder = new PromptBuilder();
 * const prompt = builder
 *     .setSystemPrompt('You are a helpful assistant.')
 *     .setWorkspaceContext('Current project: AI Agent')
 *     .setConversationHistory([
 *         { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
 *         { role: 'assistant', content: [{ type: 'text', text: 'Hi there!' }] }
 *     ])
 *     .build();
 * ```
 */
export class PromptBuilder {
    private _systemPrompt: string = '';
    private _workspaceContext: string = '';
    private _conversationHistory: Message[] = [];

    setSystemPrompt(systemPrompt: string): this {
        this._systemPrompt = systemPrompt;
        return this;
    }

    setWorkspaceContext(workspaceContext: string): this {
        this._workspaceContext = workspaceContext;
        return this;
    }

    setConversationHistory(history: Message[]): this {
        this._conversationHistory = history;
        return this;
    }

    build(): FullPrompt {
        const cleanHistory = this.cleanConversationHistory(this._conversationHistory);
        const memoryContext = cleanHistory.map((msg) => MessageFormatter.formatToXml(msg));

        return {
            systemPrompt: this._systemPrompt,
            workspaceContext: this._workspaceContext,
            memoryContext,
        };
    }

    /**
     * Cleans the conversation history by filtering and transforming messages.
     *
     * This method:
     * - Filters out messages with non-relevant roles (only keeps user, assistant, system)
     * - Removes ThinkingBlock content from messages
     *
     * @private
     */
    private cleanConversationHistory(history: Message[]): Message[] {
        return history
            .filter((msg): msg is Message & { role: 'user' | 'assistant' | 'system' } =>
                msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system'
            )
            .map((msg) => {
                // Filter out ThinkingBlock and keep other content blocks
                const content = msg.content.filter(
                    (block): block is ContentBlock => block.type !== 'thinking'
                );

                return {
                    role: msg.role,
                    content,
                };
            });
    }
}
