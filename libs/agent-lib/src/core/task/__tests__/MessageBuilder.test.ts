import { describe, it, expect } from 'vitest';
import { MessageBuilder, ApiMessage } from '../task.type';

describe('MessageBuilder', () => {
    describe('text', () => {
        it('should create a text message with correct structure', () => {
            const message = MessageBuilder.text('user', 'Hello world');

            expect(message.role).toBe('user');
            expect(message.content).toHaveLength(1);
            expect(message.content[0]).toEqual({
                type: 'text',
                text: 'Hello world'
            });
            expect(message.ts).toBeDefined();
            expect(typeof message.ts).toBe('number');
        });

        it('should support all role types', () => {
            const userMsg = MessageBuilder.text('user', 'user message');
            const assistantMsg = MessageBuilder.text('assistant', 'assistant message');
            const systemMsg = MessageBuilder.text('system', 'system message');

            expect(userMsg.role).toBe('user');
            expect(assistantMsg.role).toBe('assistant');
            expect(systemMsg.role).toBe('system');
        });
    });

    describe('user', () => {
        it('should create a user message', () => {
            const message = MessageBuilder.user('Hello');

            expect(message.role).toBe('user');
            expect(message.content[0]).toEqual({
                type: 'text',
                text: 'Hello'
            });
        });
    });

    describe('assistant', () => {
        it('should create an assistant message', () => {
            const message = MessageBuilder.assistant('Hi there');

            expect(message.role).toBe('assistant');
            expect(message.content[0]).toEqual({
                type: 'text',
                text: 'Hi there'
            });
        });
    });

    describe('system', () => {
        it('should create a system message', () => {
            const message = MessageBuilder.system('System context');

            expect(message.role).toBe('system');
            expect(message.content[0]).toEqual({
                type: 'text',
                text: 'System context'
            });
        });
    });

    describe('custom', () => {
        it('should create a message with custom content blocks', () => {
            const content = [
                { type: 'text' as const, text: 'Hello' },
                { type: 'tool_use' as const, id: '123', name: 'test_tool', input: {} }
            ];

            const message = MessageBuilder.custom('assistant', content);

            expect(message.role).toBe('assistant');
            expect(message.content).toEqual(content);
            expect(message.ts).toBeDefined();
        });

        it('should handle empty content array', () => {
            const message = MessageBuilder.custom('user', []);

            expect(message.content).toEqual([]);
            expect(message.role).toBe('user');
        });
    });

    describe('timestamp', () => {
        it('should add timestamp to all messages', () => {
            const before = Date.now();
            const message = MessageBuilder.user('test');
            const after = Date.now();

            expect(message.ts).toBeGreaterThanOrEqual(before);
            expect(message.ts).toBeLessThanOrEqual(after);
        });
    });

    describe('type consistency', () => {
        it('should create messages that match ApiMessage interface', () => {
            const message: ApiMessage = MessageBuilder.user('test');

            // This test passes if TypeScript compilation succeeds
            expect(message).toBeDefined();
        });

        it('should have content as array type', () => {
            const message = MessageBuilder.user('test');

            expect(Array.isArray(message.content)).toBe(true);
        });
    });
});
