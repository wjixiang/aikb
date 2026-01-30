// npx vitest run src/api/providers/__tests__/sambanova.spec.ts

import OpenAI from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';

import {
  type SambaNovaModelId,
  sambaNovaDefaultModelId,
  sambaNovaModels,
} from '../../../types';

import { SambaNovaHandler } from '../sambanova';

// Use vi.hoisted to properly handle the mock initialization
const { mockCreate, mockOpenAI } = vi.hoisted(() => {
  const mockCreate = vi.fn();
  const mockOpenAI = vi.fn();
  return { mockCreate, mockOpenAI };
});

vitest.mock('openai', () => {
  // Create a proper constructor function using the hoisted mock
  function MockOpenAI(this: any, options: any) {
    // Track the call to the constructor
    mockOpenAI(options);
    return {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };
  }

  return {
    __esModule: true,
    default: MockOpenAI,
  };
});

describe('SambaNovaHandler', () => {
  let handler: SambaNovaHandler;

  beforeEach(() => {
    mockCreate.mockClear();
    // mockCreate is already defined above
    handler = new SambaNovaHandler({
      sambaNovaApiKey: 'test-sambanova-api-key',
    });
  });

  afterEach(() => {
    vi.doUnmock('openai');
  });

  it('should use the correct SambaNova base URL', () => {
    new SambaNovaHandler({ sambaNovaApiKey: 'test-sambanova-api-key' });
    expect(mockOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: 'https://api.sambanova.ai/v1' }),
    );
  });

  it('should use the provided API key', () => {
    const sambaNovaApiKey = 'test-sambanova-api-key';
    new SambaNovaHandler({ sambaNovaApiKey });
    expect(mockOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: sambaNovaApiKey }),
    );
  });

  it('should return default model when no model is specified', () => {
    const model = handler.getModel();
    expect(model.id).toBe(sambaNovaDefaultModelId);
    expect(model.info).toEqual(sambaNovaModels[sambaNovaDefaultModelId]);
  });

  it('should return specified model when valid model is provided', () => {
    const testModelId: SambaNovaModelId = 'Meta-Llama-3.3-70B-Instruct';
    const handlerWithModel = new SambaNovaHandler({
      apiModelId: testModelId,
      sambaNovaApiKey: 'test-sambanova-api-key',
    });
    const model = handlerWithModel.getModel();
    expect(model.id).toBe(testModelId);
    expect(model.info).toEqual(sambaNovaModels[testModelId]);
  });

  it('completePrompt method should return text from SambaNova API', async () => {
    const expectedResponse = 'This is a test response from SambaNova';
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: expectedResponse } }],
    });
    const result = await handler.completePrompt('test prompt');
    expect(result).toBe(expectedResponse);
  });

  it('should handle errors in completePrompt', async () => {
    const errorMessage = 'SambaNova API error';
    mockCreate.mockRejectedValueOnce(new Error(errorMessage));
    await expect(handler.completePrompt('test prompt')).rejects.toThrow(
      `SambaNova completion error: ${errorMessage}`,
    );
  });

  it('createMessage should yield text content from stream', async () => {
    const testContent = 'This is test content from SambaNova stream';

    mockCreate.mockImplementationOnce(() => {
      return {
        [Symbol.asyncIterator]: () => ({
          next: vitest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: { choices: [{ delta: { content: testContent } }] },
            })
            .mockResolvedValueOnce({ done: true }),
        }),
      };
    });

    const stream = handler.createMessage('system prompt', []);
    const firstChunk = await stream.next();

    expect(firstChunk.done).toBe(false);
    expect(firstChunk.value).toEqual({ type: 'text', text: testContent });
  });

  it('createMessage should yield usage data from stream', async () => {
    mockCreate.mockImplementationOnce(() => {
      return {
        [Symbol.asyncIterator]: () => ({
          next: vitest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: {
                choices: [{ delta: {} }],
                usage: { prompt_tokens: 10, completion_tokens: 20 },
              },
            })
            .mockResolvedValueOnce({ done: true }),
        }),
      };
    });

    const stream = handler.createMessage('system prompt', []);
    const firstChunk = await stream.next();

    expect(firstChunk.done).toBe(false);
    expect(firstChunk.value).toMatchObject({
      type: 'usage',
      inputTokens: 10,
      outputTokens: 20,
    });
  });

  it('createMessage should pass correct parameters to SambaNova client', async () => {
    const modelId: SambaNovaModelId = 'Meta-Llama-3.3-70B-Instruct';
    const modelInfo = sambaNovaModels[modelId];
    const handlerWithModel = new SambaNovaHandler({
      apiModelId: modelId,
      sambaNovaApiKey: 'test-sambanova-api-key',
    });

    mockCreate.mockImplementationOnce(() => {
      return {
        [Symbol.asyncIterator]: () => ({
          async next() {
            return { done: true };
          },
        }),
      };
    });

    const systemPrompt = 'Test system prompt for SambaNova';
    const messages: Anthropic.Messages.MessageParam[] = [
      { role: 'user', content: 'Test message for SambaNova' },
    ];

    const messageGenerator = handlerWithModel.createMessage(
      systemPrompt,
      messages,
    );
    await messageGenerator.next();

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: modelId,
        max_tokens: modelInfo.maxTokens,
        temperature: 0.7,
        messages: expect.arrayContaining([
          { role: 'system', content: systemPrompt },
        ]),
        stream: true,
        stream_options: { include_usage: true },
      }),
      undefined,
    );
  });
});
