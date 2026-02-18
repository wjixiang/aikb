import type { ApiMessage, ExtendedContentBlock } from './task.type.js';

/**
 * Utility functions for formatting ApiMessage content for display
 */
export class MessageContentFormatter {
    /**
     * Format a single content block to string
     */
    static formatBlock(block: ExtendedContentBlock, options?: {
        maxLength?: number;
        includeMetadata?: boolean;
    }): string {
        const maxLength = options?.maxLength ?? 500;
        const includeMetadata = options?.includeMetadata ?? true;

        if (block.type === 'text') {
            return block.text;
        }

        if (block.type === 'tool_use') {
            const input = JSON.stringify(block.input, null, 2);
            const truncated = input.length > maxLength
                ? input.substring(0, maxLength) + '...'
                : input;

            if (includeMetadata) {
                return `[Tool Use: ${block.name}]\nID: ${block.id}\nInput:\n${truncated}`;
            }
            return `[Tool: ${block.name}]`;
        }

        if (block.type === 'tool_result') {
            const content = typeof block.content === 'string'
                ? block.content
                : JSON.stringify(block.content);
            const truncated = content.length > maxLength
                ? content.substring(0, maxLength) + '...'
                : content;

            if (includeMetadata) {
                return `[Tool Result: ${block.tool_use_id}]\n${truncated}`;
            }
            return `[Result: ${block.tool_use_id}]`;
        }

        if (block.type === 'thinking') {
            const truncated = block.thinking.length > maxLength
                ? block.thinking.substring(0, maxLength) + '...'
                : block.thinking;

            return `[Thinking]\n${truncated}`;
        }

        if (block.type === 'image') {
            return `[Image: ${block.source.type}]`;
        }

        return `[Unknown block type: ${(block as any).type}]`;
    }

    /**
     * Format entire message content to string
     */
    static formatMessage(message: ApiMessage, options?: {
        maxLength?: number;
        includeMetadata?: boolean;
        separator?: string;
    }): string {
        const separator = options?.separator ?? '\n';

        return message.content
            .map((block) => this.formatBlock(block, options))
            .join(separator);
    }

    /**
     * Format message with role and timestamp for logging
     */
    static formatForLogging(message: ApiMessage, options?: {
        maxLength?: number;
        includeMetadata?: boolean;
        colorize?: boolean;
    }): string {
        const colorize = options?.colorize ?? false;
        const timestamp = message.ts
            ? new Date(message.ts).toISOString()
            : new Date().toISOString();

        let rolePrefix = `[${message.role.toUpperCase()}]`;

        if (colorize) {
            const roleColors = {
                'user': '\x1b[36m',      // Cyan
                'assistant': '\x1b[32m', // Green
                'system': '\x1b[33m',    // Yellow
            };
            const roleColor = roleColors[message.role as keyof typeof roleColors] || '\x1b[37m';
            rolePrefix = `${roleColor}${rolePrefix}\x1b[0m`;
        }

        const content = this.formatMessage(message, options);

        return `${rolePrefix} ${timestamp}\n${content}`;
    }

    /**
     * Get a brief summary of message content (first 100 chars)
     */
    static getSummary(message: ApiMessage, maxLength: number = 100): string {
        const content = this.formatMessage(message, {
            maxLength: maxLength * 2, // Allow some buffer
            includeMetadata: false,
        });

        if (content.length <= maxLength) {
            return content;
        }

        return content.substring(0, maxLength) + '...';
    }

    /**
     * Count different types of blocks in message
     */
    static getBlockStats(message: ApiMessage): {
        text: number;
        tool_use: number;
        tool_result: number;
        thinking: number;
        image: number;
        other: number;
    } {
        const stats = {
            text: 0,
            tool_use: 0,
            tool_result: 0,
            thinking: 0,
            image: 0,
            other: 0,
        };

        for (const block of message.content) {
            if (block.type === 'text') stats.text++;
            else if (block.type === 'tool_use') stats.tool_use++;
            else if (block.type === 'tool_result') stats.tool_result++;
            else if (block.type === 'thinking') stats.thinking++;
            else if (block.type === 'image') stats.image++;
            else stats.other++;
        }

        return stats;
    }
}
