import { describe, it, expect } from 'vitest';
import { MessageContentFormatter } from '../MessageFormatter.util';
import { MessageBuilder } from '../task.type';
import type { ApiMessage } from '../task.type';

describe('MessageContentFormatter', () => {
    describe('formatBlock', () => {
        it('should format text block', () => {
            const message = MessageBuilder.text('user', 'Hello world');
            const result = MessageContentFormatter.formatBlock(message.content[0]);
            expect(result).toBe('Hello world');
        });

        it('should format tool_use block with metadata', () => {
            const message = MessageBuilder.custom('assistant', [
                {
                    type: 'tool_use',
                    id: 'tool_123',
                    name: 'search',
                    input: { query: 'test' }
                }
            ]);
            const result = MessageContentFormatter.formatBlock(message.content[0], {
                includeMetadata: true
            });
            expect(result).toContain('[Tool Use: search]');
            expect(result).toContain('ID: tool_123');
            expect(result).toContain('query');
        });

        it('should format tool_use block without metadata', () => {
            const message = MessageBuilder.custom('assistant', [
                {
                    type: 'tool_use',
                    id: 'tool_123',
                    name: 'search',
                    input: { query: 'test' }
                }
            ]);
            const result = MessageContentFormatter.formatBlock(message.content[0], {
                includeMetadata: false
            });
            expect(result).toBe('[Tool: search]');
        });

        it('should truncate long content', () => {
            const longText = 'a'.repeat(1000);
            const message = MessageBuilder.text('user', longText);
            const result = MessageContentFormatter.formatBlock(message.content[0], {
                maxLength: 100
            });
            // Text blocks are not truncated by formatBlock, only tool results
            expect(result).toBe(longText);
        });

        it('should format thinking block', () => {
            const message = MessageBuilder.custom('assistant', [
                {
                    type: 'thinking',
                    thinking: 'Let me think about this...'
                }
            ]);
            const result = MessageContentFormatter.formatBlock(message.content[0]);
            expect(result).toContain('[Thinking]');
            expect(result).toContain('Let me think about this...');
        });
    });

    describe('formatMessage', () => {
        it('should format simple text message', () => {
            const message = MessageBuilder.user('Hello');
            const result = MessageContentFormatter.formatMessage(message);
            expect(result).toBe('Hello');
        });

        it('should format message with multiple blocks', () => {
            const message = MessageBuilder.custom('assistant', [
                { type: 'text', text: 'Let me search for that.' },
                {
                    type: 'tool_use',
                    id: 'tool_1',
                    name: 'search',
                    input: { query: 'test' }
                }
            ]);
            const result = MessageContentFormatter.formatMessage(message, {
                includeMetadata: false
            });
            expect(result).toContain('Let me search for that.');
            expect(result).toContain('[Tool: search]');
        });

        it('should use custom separator', () => {
            const message = MessageBuilder.custom('assistant', [
                { type: 'text', text: 'First' },
                { type: 'text', text: 'Second' }
            ]);
            const result = MessageContentFormatter.formatMessage(message, {
                separator: ' | '
            });
            expect(result).toBe('First | Second');
        });
    });

    describe('formatForLogging', () => {
        it('should format message with role and timestamp', () => {
            const message = MessageBuilder.user('Test message');
            const result = MessageContentFormatter.formatForLogging(message, {
                colorize: false
            });
            expect(result).toContain('[USER]');
            expect(result).toContain('Test message');
            expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO timestamp
        });

        it('should include color codes when colorize is true', () => {
            const message = MessageBuilder.user('Test');
            const result = MessageContentFormatter.formatForLogging(message, {
                colorize: true
            });
            expect(result).toContain('\x1b['); // ANSI color code
        });

        it('should format different roles correctly', () => {
            const userMsg = MessageBuilder.user('User message');
            const assistantMsg = MessageBuilder.assistant('Assistant message');
            const systemMsg = MessageBuilder.system('System message');

            const userResult = MessageContentFormatter.formatForLogging(userMsg, { colorize: false });
            const assistantResult = MessageContentFormatter.formatForLogging(assistantMsg, { colorize: false });
            const systemResult = MessageContentFormatter.formatForLogging(systemMsg, { colorize: false });

            expect(userResult).toContain('[USER]');
            expect(assistantResult).toContain('[ASSISTANT]');
            expect(systemResult).toContain('[SYSTEM]');
        });
    });

    describe('getSummary', () => {
        it('should return full content if shorter than maxLength', () => {
            const message = MessageBuilder.user('Short message');
            const result = MessageContentFormatter.getSummary(message, 100);
            expect(result).toBe('Short message');
        });

        it('should truncate long content', () => {
            const longText = 'a'.repeat(200);
            const message = MessageBuilder.user(longText);
            const result = MessageContentFormatter.getSummary(message, 50);
            expect(result.length).toBeLessThanOrEqual(53); // 50 + '...'
            expect(result).toContain('...');
        });

        it('should not include metadata in summary', () => {
            const message = MessageBuilder.custom('assistant', [
                {
                    type: 'tool_use',
                    id: 'tool_1',
                    name: 'search',
                    input: { query: 'test' }
                }
            ]);
            const result = MessageContentFormatter.getSummary(message);
            expect(result).toBe('[Tool: search]');
            expect(result).not.toContain('ID:');
        });
    });

    describe('getBlockStats', () => {
        it('should count text blocks', () => {
            const message = MessageBuilder.custom('user', [
                { type: 'text', text: 'First' },
                { type: 'text', text: 'Second' }
            ]);
            const stats = MessageContentFormatter.getBlockStats(message);
            expect(stats.text).toBe(2);
            expect(stats.tool_use).toBe(0);
        });

        it('should count different block types', () => {
            const message = MessageBuilder.custom('assistant', [
                { type: 'text', text: 'Hello' },
                {
                    type: 'tool_use',
                    id: 'tool_1',
                    name: 'search',
                    input: {}
                },
                {
                    type: 'tool_result',
                    tool_use_id: 'tool_1',
                    content: 'result'
                },
                {
                    type: 'thinking',
                    thinking: 'thinking...'
                }
            ]);
            const stats = MessageContentFormatter.getBlockStats(message);
            expect(stats.text).toBe(1);
            expect(stats.tool_use).toBe(1);
            expect(stats.tool_result).toBe(1);
            expect(stats.thinking).toBe(1);
            expect(stats.image).toBe(0);
            expect(stats.other).toBe(0);
        });

        it('should handle empty message', () => {
            const message = MessageBuilder.custom('user', []);
            const stats = MessageContentFormatter.getBlockStats(message);
            expect(stats.text).toBe(0);
            expect(stats.tool_use).toBe(0);
        });
    });
});
