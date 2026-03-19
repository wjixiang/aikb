import { MemoryModule, defaultMemoryConfig, DEFAULT_MODEL_CONTEXT_SIZES } from "../MemoryModule";
import { ApiMessage, MessageBuilder } from "../types";
import { Logger } from "pino";
import { vi } from "vitest";

// Mock Logger
const mockLogger: Logger = {
    level: 'info',
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => mockLogger as any),
} as any;

// Helper to extract text from content array
function getText(content: ApiMessage['content']): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map(c => c.type === 'text' ? c.text : JSON.stringify(c)).join('');
    }
    return String(content);
}

describe('MemoryModule - Token-Based Compression', () => {
    let memoryModule: MemoryModule;

    beforeEach(() => {
        // Use small token limits for testing
        memoryModule = new MemoryModule(mockLogger, {
            maxContextTokens: 1000,              // 1000 tokens max
            contextCompressionRatio: 0.8,        // Compress at 800 tokens
            compressionTargetTokens: 500,         // Target 500 tokens after compression
        });
    });

    it('should not compress when below threshold', async () => {
        // Add small messages (~20 tokens each)
        for (let i = 0; i < 10; i++) {
            await memoryModule.addMessage(MessageBuilder.user(`Short message ${i}`));
        }

        const messages = memoryModule.getAllMessages();
        expect(messages).toHaveLength(10);
        // No compression should have happened
        expect(messages[0].role).toBe('user');
    });

    it('should compress when exceeding token threshold', async () => {
        // Add messages until compression triggers
        // Each message is ~30-40 tokens
        for (let i = 0; i < 50; i++) {
            await memoryModule.addMessage(MessageBuilder.user(`This is message number ${i} with some content`));
        }

        const messages = memoryModule.getAllMessages();
        const tokens = await memoryModule.getTotalTokens();

        // Should be under target tokens (with some margin for token estimation variance)
        expect(tokens).toBeLessThanOrEqual(800); // 500 target + 300 margin

        // First message should be summary if compression happened
        if (messages.length < 50) {
            expect(messages[0].role).toBe('system');
            expect(getText(messages[0].content)).toContain('summarized');
        }
    });

    it('should calculate token count correctly', async () => {
        memoryModule.addMessageSync(MessageBuilder.user('Hello world'));  // ~6 tokens

        const tokens = await memoryModule.getTotalTokens();
        expect(tokens).toBeGreaterThan(0);
    });

    it('should keep recent messages after compression', async () => {
        // Add many messages
        for (let i = 0; i < 30; i++) {
            await memoryModule.addMessage(MessageBuilder.user(`Message ${i}`));
        }

        const messages = memoryModule.getAllMessages();
        // Last message should be from the recent batch
        expect(getText(messages[messages.length - 1].content)).toContain('Message 29');
    });

    it('should use sync addMessage without compression check', async () => {
        // addMessageSync doesn't trigger compression
        memoryModule.addMessageSync(MessageBuilder.user('Sync message'));

        const messages = memoryModule.getAllMessages();
        expect(messages).toHaveLength(1);
    });
});

describe('MemoryModule - Error Context', () => {
    let memoryModule: MemoryModule;

    beforeEach(() => {
        memoryModule = new MemoryModule(mockLogger);
    });

    it('should prepend errors to history for prompt', async () => {
        memoryModule.addMessageSync(MessageBuilder.user('Hello'));
        memoryModule.addMessageSync(MessageBuilder.assistant('Hi there'));
        memoryModule.pushErrors([new Error('Something went wrong')]);

        const history = memoryModule.getHistoryForPrompt();

        expect(history[0].role).toBe('system');
        expect(getText(history[0].content)).toContain('[Error: Something went wrong]');
    });

    it('should clear errors after getHistoryForPrompt', async () => {
        memoryModule.addMessageSync(MessageBuilder.user('Test'));
        memoryModule.pushErrors([new Error('Test error')]);

        const history1 = memoryModule.getHistoryForPrompt();
        expect(getText(history1[0].content)).toContain('Test error');

        const history2 = memoryModule.getHistoryForPrompt();
        expect(history2[0].role).toBe('user');
    });

    it('should handle multiple errors', async () => {
        memoryModule.pushErrors([
            new Error('Error 1'),
            new Error('Error 2'),
            new Error('Error 3')
        ]);

        const history = memoryModule.getHistoryForPrompt();

        expect(history).toHaveLength(3);
        expect(getText(history[0].content)).toContain('Error 1');
        expect(getText(history[1].content)).toContain('Error 2');
        expect(getText(history[2].content)).toContain('Error 3');
    });

    it('should get and clear errors with popErrors', async () => {
        memoryModule.pushErrors([new Error('Error A')]);

        const errors = memoryModule.popErrors();
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('Error A');

        expect(memoryModule.getErrors()).toHaveLength(0);
    });
});

describe('MemoryModule - Simple Message Storage', () => {
    let memoryModule: MemoryModule;

    beforeEach(() => {
        memoryModule = new MemoryModule(mockLogger);
    });

    it('should add and retrieve messages', async () => {
        await memoryModule.addMessage(MessageBuilder.user('Hello'));
        await memoryModule.addMessage(MessageBuilder.assistant('Hi'));

        const messages = memoryModule.getAllMessages();
        expect(messages).toHaveLength(2);
        expect(messages[0].role).toBe('user');
        expect(messages[1].role).toBe('assistant');
    });

    it('should export and import state', async () => {
        memoryModule.addMessageSync(MessageBuilder.user('Test message'));
        memoryModule.pushErrors([new Error('Test error')]);

        const exported = memoryModule.export();

        const newModule = new MemoryModule(mockLogger);
        newModule.import(exported);

        const messages = newModule.getAllMessages();
        expect(messages).toHaveLength(1);
        expect(getText(messages[0].content)).toContain('Test message');

        const errors = newModule.getErrors();
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('Test error');
    });

    it('should clear all state', async () => {
        memoryModule.addMessageSync(MessageBuilder.user('Hello'));
        memoryModule.pushErrors([new Error('Error')]);

        memoryModule.clear();

        expect(memoryModule.getAllMessages()).toHaveLength(0);
        expect(memoryModule.getErrors()).toHaveLength(0);
    });
});

describe('MemoryModule - Default Config', () => {
    it('should have correct default values', () => {
        const config = defaultMemoryConfig;

        expect(config.maxContextTokens).toBe(100000);
        expect(config.contextCompressionRatio).toBe(0.8);
        expect(config.compressionTargetTokens).toBe(60000);
    });

    it('should have common model context sizes', () => {
        expect(DEFAULT_MODEL_CONTEXT_SIZES['claude-3-5-sonnet']).toBe(200000);
        expect(DEFAULT_MODEL_CONTEXT_SIZES['gpt-4o']).toBe(128000);
    });
});
