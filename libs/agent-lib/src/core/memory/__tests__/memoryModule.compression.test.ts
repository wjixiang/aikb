import { MemoryModule, defaultMemoryConfig } from '../MemoryModule';
import { Message, MessageBuilder } from '../types';
import { Logger } from 'pino';
import { vi } from 'vitest';

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

function getText(content: Message['content']): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(c => c.type === 'text' ? c.text : JSON.stringify(c)).join('');
  }
  return String(content);
}

describe('MemoryModule - Token-Based Compression', () => {
  let memoryModule: MemoryModule;

  beforeEach(() => {
    memoryModule = new MemoryModule(mockLogger, {
      maxContextTokens: 1000,
      contextCompressionRatio: 0.8,
      compressionTargetTokens: 500,
      minRetainedMessages: 10,
    });
  });

  it('should not compress when below threshold', async () => {
    for (let i = 0; i < 10; i++) {
      await memoryModule.addMessage(MessageBuilder.user(`Short message ${i}`));
    }

    const messages = memoryModule.getAllMessages();
    expect(messages).toHaveLength(10);
    expect(messages[0].role).toBe('user');
  });

  it('should compress when exceeding token threshold', async () => {
    // Add enough messages to exceed 800 token threshold
    for (let i = 0; i < 100; i++) {
      await memoryModule.addMessage(MessageBuilder.user(`This is message number ${i} with some content to fill tokens`));
    }

    const messages = memoryModule.getAllMessages();
    const tokens = await memoryModule.getTotalTokens();

    // Should have fewer messages than original (compression happened)
    expect(messages.length).toBeLessThan(100);

    // First message should be summary (system role)
    expect(messages[0].role).toBe('system');
    expect(getText(messages[0].content)).toContain('summarized');
  });

  it('should retain at least minRetainedMessages recent messages', async () => {
    for (let i = 0; i < 100; i++) {
      await memoryModule.addMessage(MessageBuilder.user(`Message ${i} with enough content to accumulate tokens`));
    }

    const messages = memoryModule.getAllMessages();

    // First is summary, then at least minRetainedMessages recent messages
    expect(messages[0].role).toBe('system');
    const nonSummary = messages.filter(m => m.role !== 'system');
    expect(nonSummary.length).toBeGreaterThanOrEqual(10);

    // Last message should be from the recent batch
    expect(getText(messages[messages.length - 1].content)).toContain('Message 99');
  });

  it('should not compress when message count is at or below minRetainedMessages', async () => {
    // Only add 5 messages, below minRetainedMessages of 10
    for (let i = 0; i < 5; i++) {
      await memoryModule.addMessage(MessageBuilder.user(`Message ${i}`));
    }

    const messages = memoryModule.getAllMessages();
    expect(messages).toHaveLength(5);
    expect(messages[0].role).toBe('user');
  });

  it('should use addMessageSync without triggering compression', async () => {
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
      new Error('Error 3'),
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
    expect(config.minRetainedMessages).toBe(20);
  });
});
