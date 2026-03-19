/**
 * Simplified MemoryModule - Manages conversation memory without turn-based concepts
 *
 * This module manages:
 * 1. Simple message storage
 * 2. Token-based context compression when exceeding context limit
 * 3. Error tracking for context injection
 * 4. LLM-based summarization for compression
 */

import { injectable, inject, optional } from 'inversify';
import { ApiMessage } from './types.js';
import type { IMemoryModule, MemoryModuleConfig } from './types.js';
import { TYPES } from '../di/types.js';
import { tiktoken } from '../utils/tiktoken.js';
import type { ApiClient } from '../api-client/index.js';

// Re-export types
export type { MemoryModuleConfig };

/**
 * Default context sizes for different models
 */
export const DEFAULT_MODEL_CONTEXT_SIZES: Record<string, number> = {
    'claude-3-5-sonnet': 200000,
    'claude-3-opus': 200000,
    'claude-3-haiku': 200000,
    'Minimax-M2.5-highspeed': 200000,
    'gpt-4o': 128000,
    'gpt-4-turbo': 128000,
    'gpt-4': 8192,
    'gpt-3.5-turbo': 16385,
};

/**
 * Default configuration for simplified MemoryModule
 */
export const defaultMemoryConfig: MemoryModuleConfig = {
    enableRecall: false,
    maxRecallContexts: 3,
    maxRecalledMessages: 20,
    // Token-based compression settings
    maxContextTokens: 100000,           // Max tokens in context (80% of 200k)
    contextCompressionRatio: 0.8,        // Compress when at 80% of maxContextTokens
    compressionTargetTokens: 60000,     // Target after compression
    // LLM summarization settings
    enableLLMSummarization: true,       // Use LLM for summarization
    maxTokensForSummary: 15000,         // Max tokens to send for summarization
    summaryModel: 'claude-3-5-sonnet', // Model to use for summarization
};

/**
 * System prompt for LLM summarization
 */
const SUMMARIZATION_PROMPT = `You are a concise summarizer. Given a conversation history, create a brief summary that captures the key points, decisions, and important context. Keep the summary under 500 words. Focus on:
- Main topics discussed
- Key conclusions or decisions made
- Any important context or constraints mentioned
- Outstanding tasks or questions

Format your response as a concise narrative summary.`;

/**
 * Simplified MemoryModule - no turn concepts, with token-based compression
 */
@injectable()
export class MemoryModule implements IMemoryModule {
    private config: MemoryModuleConfig;

    // Simple message storage
    private messages: ApiMessage[] = [];

    // Error storage
    private savedErrors: Error[] = [];

    // Cached token count
    private _cachedTokenCount: number | null = null;

    // API client for LLM calls
    private apiClient: ApiClient | null = null;

    // Flag to prevent recursive compression
    private _isCompressing = false;

    constructor(
        @inject(TYPES.Logger) private logger: Logger,
        @inject(TYPES.MemoryModuleConfig) @optional() config: Partial<MemoryModuleConfig> = {},
        @inject(TYPES.ApiClient) @optional() apiClient: ApiClient | null = null,
    ) {
        this.config = { ...defaultMemoryConfig, ...config };
        this.apiClient = apiClient || null;
    }

    /**
     * Set API client (can be set after construction)
     */
    setApiClient(apiClient: ApiClient): void {
        this.apiClient = apiClient;
    }

    /**
     * Get current configuration
     */
    getConfig(): MemoryModuleConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<MemoryModuleConfig>): void {
        this.config = { ...this.config, ...config };
    }

    // ==================== Message Management ====================

    /**
     * Add message to storage
     */
    async addMessage(message: ApiMessage): Promise<ApiMessage> {
        this.messages.push(message);
        this._cachedTokenCount = null; // Invalidate cache

        // Don't compress if already compressing or if this is a summary message
        if (!this._isCompressing && !this.isSummaryMessage(message)) {
            await this.compressIfNeeded();
        }

        return message;
    }

    /**
     * Check if message is a summary (to avoid recursive compression)
     */
    private isSummaryMessage(message: ApiMessage): boolean {
        const text = this.extractText(message.content);
        return text.includes('[Previous conversation summarized:') ||
            text.includes('[LLM Summary:');
    }

    /**
     * Add message (sync version for compatibility - doesn't trigger compression)
     */
    addMessageSync(message: ApiMessage): ApiMessage {
        this.messages.push(message);
        this._cachedTokenCount = null;
        return message;
    }

    /**
     * Record tool call result (no-op - already handled by addMessage)
     */
    recordToolCall(toolName: string, success: boolean, result: any): void {
        // No-op
    }

    // ==================== History Retrieval ====================

    /**
     * Get all historical messages
     */
    getAllMessages(): ApiMessage[] {
        return [...this.messages];
    }

    /**
     * Get total token count for all messages
     */
    async getTotalTokens(): Promise<number> {
        if (this._cachedTokenCount !== null) {
            return this._cachedTokenCount;
        }

        if (this.messages.length === 0) {
            this._cachedTokenCount = 0;
            return 0;
        }

        // Convert ApiMessage to ContentBlockParam format for tiktoken
        const contentBlocks = this.messages.flatMap(msg => {
            if (msg.role === 'system') {
                // System messages become text blocks
                return this.extractContentBlocks(msg.content);
            } else if (msg.role === 'user') {
                return this.extractContentBlocks(msg.content);
            } else if (msg.role === 'assistant') {
                return this.extractContentBlocks(msg.content);
            }
            return [];
        });

        this._cachedTokenCount = await tiktoken(contentBlocks);
        return this._cachedTokenCount;
    }

    /**
     * Get total token count synchronously (estimate)
     */
    getTotalTokensEstimate(): number {
        if (this._cachedTokenCount !== null) {
            return this._cachedTokenCount;
        }

        // Simple estimate: ~4 chars per token
        let totalChars = 0;
        for (const msg of this.messages) {
            const text = this.extractText(msg.content);
            totalChars += text.length;
        }

        this._cachedTokenCount = Math.ceil(totalChars / 4);
        return this._cachedTokenCount;
    }

    /**
     * Extract content blocks from message content
     */
    private extractContentBlocks(content: ApiMessage['content']) {
        if (typeof content === 'string') {
            return [{ type: 'text' as const, text: content }];
        }
        if (Array.isArray(content)) {
            return content.map(block => {
                if (block.type === 'text') {
                    return { type: 'text' as const, text: block.text };
                }
                if (block.type === 'tool_result') {
                    return { type: 'text' as const, text: `[Tool Result: ${block.content}]` };
                }
                return { type: 'text' as const, text: JSON.stringify(block) };
            });
        }
        return [{ type: 'text' as const, text: String(content) }];
    }

    /**
     * Extract plain text from content
     */
    private extractText(content: ApiMessage['content']): string {
        if (typeof content === 'string') {
            return content;
        }
        if (Array.isArray(content)) {
            return content.map(c => c.type === 'text' ? c.text : JSON.stringify(c)).join(' ');
        }
        return String(content);
    }

    /**
     * Get history for prompt injection
     * Returns all messages with errors prepended as system messages
     */
    getHistoryForPrompt(): ApiMessage[] {
        const result: ApiMessage[] = [];

        // Prepend errors as system messages
        const errors = this.popErrors();
        for (const error of errors) {
            result.push({
                role: 'system',
                content: [{ type: 'text' as const, text: `[Error: ${error.message}]` }],
                ts: Date.now(),
            });
        }

        // Add all messages
        result.push(...this.messages);

        return result;
    }

    // ==================== Error Management ====================

    /**
     * Push errors to be saved for later retrieval
     */
    pushErrors(errors: Error[]): void {
        this.savedErrors.push(...errors);
    }

    /**
     * Pop and return all saved errors
     */
    popErrors(): Error[] {
        const errors = [...this.savedErrors];
        this.savedErrors = [];
        return errors;
    }

    /**
     * Get saved errors without clearing them
     */
    getErrors(): Error[] {
        return [...this.savedErrors];
    }

    /**
     * Clear all saved errors
     */
    clearErrors(): void {
        this.savedErrors = [];
    }

    // ==================== Token-Based Context Compression ====================

    /**
     * Check if compression is needed based on token count
     */
    private async compressIfNeeded(): Promise<void> {
        const maxTokens = this.config.maxContextTokens || 100000;
        const threshold = this.config.contextCompressionRatio || 0.8;
        const triggerTokens = Math.floor(maxTokens * threshold);

        const currentTokens = await this.getTotalTokens();

        if (currentTokens > triggerTokens) {
            const targetTokens = this.config.compressionTargetTokens || Math.floor(maxTokens * 0.6);
            await this.compress(targetTokens);
        }
    }

    /**
     * Compress messages to target token count
     */
    private async compress(targetTokens: number): Promise<void> {
        if (this.messages.length === 0 || this._isCompressing) {
            return;
        }

        this._isCompressing = true;

        try {
            const startCount = this.messages.length;

            // Collect messages to be removed for summarization
            const messagesToSummarize: ApiMessage[] = [];
            let currentTokens = await this.getTotalTokens();

            // Remove oldest messages until under target
            while (this.messages.length > 1 && currentTokens > targetTokens) {
                const removed = this.messages.shift();
                if (removed) {
                    messagesToSummarize.push(removed);
                    this._cachedTokenCount = null;
                    currentTokens = await this.getTotalTokens();
                }
            }

            const removedCount = messagesToSummarize.length;
            if (removedCount > 0) {
                // Generate summary using LLM or fallback to simple summary
                const summaryText = await this.generateSummary(messagesToSummarize);

                const summaryMessage: ApiMessage = {
                    role: 'system',
                    content: [{ type: 'text' as const, text: `[Previous conversation summarized:\n${summaryText}]` }],
                    ts: Date.now(),
                };

                // Insert summary at the beginning (sync to avoid recursion)
                this.messages.unshift(summaryMessage);
                this._cachedTokenCount = null;

                this.logger.info(`[MemoryModule] Compressed ${removedCount} messages with LLM summary, now ${this.messages.length} messages`);
            }
        } finally {
            this._isCompressing = false;
        }
    }

    /**
     * Generate summary using LLM or fallback to simple summary
     */
    private async generateSummary(messages: ApiMessage[]): Promise<string> {
        if (!this.config.enableLLMSummarization || !this.apiClient) {
            return this.simpleSummary(messages);
        }

        try {
            return await this.summarizeWithLLM(messages);
        } catch (error) {
            this.logger.warn(`[MemoryModule] LLM summarization failed, using simple summary: ${error}`);
            return this.simpleSummary(messages);
        }
    }

    /**
     * Summarize messages using LLM
     */
    private async summarizeWithLLM(messages: ApiMessage[]): Promise<string> {
        if (!this.apiClient) {
            throw new Error('ApiClient not available');
        }

        // Format messages for summarization
        const conversationText = this.formatMessagesForSummary(messages);

        // Check token count - limit to maxTokensForSummary
        const tokenEstimate = Math.ceil(conversationText.length / 4);
        let textToSummarize = conversationText;

        if (tokenEstimate > (this.config.maxTokensForSummary || 15000)) {
            // Truncate to fit token limit
            const maxChars = (this.config.maxTokensForSummary || 15000) * 4;
            textToSummarize = conversationText.substring(0, maxChars) + '\n[truncated]';
        }

        // Build messages for LLM
        const systemMsg: ApiMessage = {
            role: 'system',
            content: [{ type: 'text' as const, text: SUMMARIZATION_PROMPT }],
            ts: Date.now(),
        };

        const userMsg: ApiMessage = {
            role: 'user',
            content: [{ type: 'text' as const, text: `Please summarize the following conversation:\n\n${textToSummarize}` }],
            ts: Date.now(),
        };

        // Call LLM
        const response = await this.apiClient.makeRequest(
            SUMMARIZATION_PROMPT,
            '',  // workspace context - empty for summarization
            [this.formatMessageAsString(systemMsg), this.formatMessageAsString(userMsg)],
            { timeout: 60000 },
            []   // no tools
        );

        // Extract summary from response
        const summary = response.textResponse?.trim() || this.simpleSummary(messages);
        return summary;
    }

    /**
     * Format messages for summary prompt
     */
    private formatMessagesForSummary(messages: ApiMessage[]): string {
        return messages
            .map(msg => {
                const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System';
                const text = this.extractText(msg.content);
                return `[${role}]: ${text}`;
            })
            .join('\n\n');
    }

    /**
     * Format a message as string for LLM context
     */
    private formatMessageAsString(message: ApiMessage): string {
        const role = message.role === 'user' ? 'User' : message.role === 'assistant' ? 'Assistant' : 'System';
        const text = this.extractText(message.content);
        return `<${role}>\n${text}\n</${role}>`;
    }

    /**
     * Simple statistical summary fallback
     */
    private simpleSummary(messages: ApiMessage[]): string {
        const userMsgs = messages.filter(m => m.role === 'user').length;
        const assistantMsgs = messages.filter(m => m.role === 'assistant').length;
        const toolResults = messages.filter(m =>
            Array.isArray(m.content) &&
            m.content.some(c => c.type === 'tool_result')
        ).length;

        const firstText = this.extractText(messages[0]?.content || '').substring(0, 100);
        const lastText = this.extractText(messages[messages.length - 1]?.content || '').substring(0, 100);

        return `${messages.length} messages (${userMsgs} user, ${assistantMsgs} assistant, ${toolResults} tool results). ` +
            `First exchange: "${firstText}...". ` +
            `Last exchange: "${lastText}...".`;
    }

    // ==================== Import/Export ====================

    /**
     * Export memory state
     */
    export() {
        return {
            messages: this.messages,
            config: this.config,
            savedErrors: this.savedErrors,
        };
    }

    /**
     * Import memory state
     */
    import(data: any) {
        if (data.messages) {
            this.messages = data.messages;
        }
        if (data.savedErrors) {
            this.savedErrors = data.savedErrors;
        }
        this._cachedTokenCount = null;
    }

    /**
     * Clear all memory
     */
    clear() {
        this.messages = [];
        this.savedErrors = [];
        this._cachedTokenCount = null;
    }
}

// Type for Logger (pino)
type Logger = import('pino').Logger;
