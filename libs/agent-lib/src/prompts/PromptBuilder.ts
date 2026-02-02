import Anthropic from '@anthropic-ai/sdk';
import { ApiMessage, ThinkingBlock } from '../task/task.type';
import { MessageFormatter } from './MessageFormatter';

/**
 * Interface for the structured prompt used by BAML.
 * 
 * This interface represents the complete prompt structure that will be passed
 * to the BAML API request, containing all necessary context for the agent.
 */
export interface BamlPrompt {
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
 * 4. Build the final BamlPrompt object
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
 *         { role: 'user', content: 'Hello' },
 *         { role: 'assistant', content: 'Hi there!' }
 *     ])
 *     .build();
 * 
 * console.log(prompt.systemPrompt); // 'You are a helpful assistant.'
 * console.log(prompt.workspaceContext); // 'Current project: AI Agent'
 * console.log(prompt.memoryContext); // ['<user>\nHello\n</user>', '<assistant>\nHi there!\n</assistant>']
 * ```
 */
export class PromptBuilder {
    private _systemPrompt: string = '';
    private _workspaceContext: string = '';
    private _conversationHistory: ApiMessage[] = [];

    /**
     * Sets the system prompt for the agent.
     * 
     * The system prompt defines the agent's core behavior, personality,
     * and instructions. It is the first thing the AI sees when processing
     * a request.
     * 
     * @param systemPrompt - The system prompt string to set
     * @returns This builder instance for method chaining
     * 
     * @example
     * ```ts
     * builder.setSystemPrompt('You are a helpful medical assistant.');
     * ```
     */
    setSystemPrompt(systemPrompt: string): this {
        this._systemPrompt = systemPrompt;
        return this;
    }

    /**
     * Sets the workspace context for the agent.
     * 
     * The workspace context provides information about the current workspace,
     * including available tools, files, and other relevant state information.
     * 
     * @param workspaceContext - The workspace context string to set
     * @returns This builder instance for method chaining
     * 
     * @example
     * ```ts
     * builder.setWorkspaceContext('Workspace: /home/user/project\nTools: search, execute');
     * ```
     */
    setWorkspaceContext(workspaceContext: string): this {
        this._workspaceContext = workspaceContext;
        return this;
    }

    /**
     * Sets the conversation history for the agent.
     * 
     * The conversation history contains all previous interactions between
     * the user and the agent. This context is used to maintain conversation
     * state and provide relevant history to the AI.
     * 
     * @param history - Array of ApiMessage objects representing the conversation history
     * @returns This builder instance for method chaining
     * 
     * @example
     * ```ts
     * builder.setConversationHistory([
     *     { role: 'user', content: 'What is the weather?' },
     *     { role: 'assistant', content: 'The weather is sunny.' }
     * ]);
     * ```
     */
    setConversationHistory(history: ApiMessage[]): this {
        this._conversationHistory = history;
        return this;
    }

    /**
     * Builds and returns the final BamlPrompt object.
     * 
     * This method performs the following operations:
     * 1. Cleans the conversation history by filtering out non-relevant roles
     * 2. Removes ThinkingBlock content from the history
     * 3. Formats each message using MessageFormatter
     * 4. Constructs and returns the BamlPrompt object
     * 
     * @returns A BamlPrompt object containing systemPrompt, workspaceContext, and memoryContext
     * 
     * @example
     * ```ts
     * const prompt = builder.build();
     * // Returns: {
     * //   systemPrompt: '...',
     * //   workspaceContext: '...',
     * //   memoryContext: ['<user>...</user>', '<assistant>...</assistant>']
     * // }
     * ```
     */
    build(): BamlPrompt {
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
     * - Removes ThinkingBlock content from messages that have content blocks
     * - Returns a cleaned array of ApiMessage objects
     * 
     * @param history - The raw conversation history to clean
     * @returns A cleaned array of ApiMessage objects
     * 
     * @private
     */
    private cleanConversationHistory(history: ApiMessage[]): ApiMessage[] {
        return history
            .filter((msg): msg is ApiMessage & { role: 'user' | 'assistant' | 'system' } =>
                msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system'
            )
            .map((msg) => {
                if (typeof msg.content === 'string') {
                    return {
                        role: msg.role,
                        content: msg.content,
                    };
                }

                // Filter out custom ThinkingBlock and keep only Anthropic.ContentBlockParam
                const content = (msg.content as Anthropic.ContentBlockParam[]).filter(
                    (block): block is Anthropic.ContentBlockParam => block.type !== 'thinking'
                ) as Anthropic.ContentBlockParam[];

                return {
                    role: msg.role,
                    content,
                };
            });
    }
}
