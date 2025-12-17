import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Task } from '../task.entity';
import {
    TaskAbortedError,
    ConsecutiveMistakeError,
    ApiTimeoutError,
    ApiRequestError,
    NoApiResponseError,
    NoToolsUsedError,
    StreamingError,
    MaxRetryExceededError
} from '../task.entity';

// Mock dependencies
vi.mock('llm-api', () => ({
    buildApiHandler: vi.fn(() => ({
        createMessage: vi.fn(),
        getModel: vi.fn(() => ({ info: { supportsToolCalling: true } }))
    })),
    ApiStream: Symbol.for('ApiStream')
}));

vi.mock('llm-utils/resolveToolProtocol', () => ({
    resolveToolProtocol: vi.fn(() => 'native')
}));

vi.mock('llm-core/prompts/system', () => ({
    SYSTEM_PROMPT: vi.fn(() => 'Mock system prompt')
}));

vi.mock('./simplified-dependencies/processUserContentMentions', () => ({
    processUserContentMentions: vi.fn((args) => args.userContent)
}));

describe('Task Error Handling', () => {
    let task: Task;
    const mockApiConfiguration = {
        apiProvider: 'anthropic' as const,
        apiKey: 'test-key',
        modelId: 'claude-3-sonnet-20240229'
    };

    beforeEach(() => {
        task = new Task('test-task-id', mockApiConfiguration);
        vi.clearAllMocks();
    });

    describe('Custom Error Types', () => {
        it('should create TaskAbortedError with correct properties', () => {
            const error = new TaskAbortedError('test-task');

            expect(error).toBeInstanceOf(Error);
            expect(error.code).toBe('TASK_ABORTED');
            expect(error.retryable).toBe(false);
            expect(error.message).toContain('test-task');
        });

        it('should create ConsecutiveMistakeError with correct properties', () => {
            const error = new ConsecutiveMistakeError(5);

            expect(error).toBeInstanceOf(Error);
            expect(error.code).toBe('CONSECUTIVE_MISTAKE_LIMIT');
            expect(error.retryable).toBe(false);
            expect(error.message).toContain('5');
        });

        it('should create ApiTimeoutError with correct properties', () => {
            const error = new ApiTimeoutError(60000);

            expect(error).toBeInstanceOf(Error);
            expect(error.code).toBe('API_TIMEOUT');
            expect(error.retryable).toBe(true);
            expect(error.message).toContain('60000');
        });

        it('should create ApiRequestError with correct properties', () => {
            const error = new ApiRequestError('Network error', 500);

            expect(error).toBeInstanceOf(Error);
            expect(error.code).toBe('API_REQUEST_FAILED');
            expect(error.retryable).toBe(true);
            expect(error.message).toContain('Network error');
            expect((error as any).statusCode).toBe(500);
        });

        it('should create NoApiResponseError with correct properties', () => {
            const error = new NoApiResponseError(2);

            expect(error).toBeInstanceOf(Error);
            expect(error.code).toBe('NO_API_RESPONSE');
            expect(error.retryable).toBe(true);
            expect(error.message).toContain('attempt 2');
        });

        it('should create NoToolsUsedError with correct properties', () => {
            const error = new NoToolsUsedError();

            expect(error).toBeInstanceOf(Error);
            expect(error.code).toBe('NO_TOOLS_USED');
            expect(error.retryable).toBe(true);
            expect(error.message).toContain('did not use any tools');
        });

        it('should create StreamingError with correct properties', () => {
            const error = new StreamingError('Stream interrupted');

            expect(error).toBeInstanceOf(Error);
            expect(error.code).toBe('STREAMING_FAILED');
            expect(error.retryable).toBe(true);
            expect(error.message).toContain('Stream interrupted');
        });

        it('should create MaxRetryExceededError with collected errors', () => {
            const errors = [
                new ApiTimeoutError(60000),
                new NoApiResponseError(1),
                new StreamingError('Connection lost')
            ];

            const error = new MaxRetryExceededError(3, errors);

            expect(error).toBeInstanceOf(Error);
            expect(error.code).toBe('MAX_RETRY_EXCEEDED');
            expect(error.retryable).toBe(false);
            expect(error.message).toContain('3');
            expect(error.message).toContain('3 errors');
            expect((error as any).errors).toEqual(errors);
        });
    });

    describe('Error Collection', () => {
        it('should start with empty collected errors', () => {
            const errors = task.getCollectedErrors();
            expect(errors).toEqual([]);
        });

        it('should reset collected errors', () => {
            // Simulate adding errors (we'll need to access private property for testing)
            (task as any).collectedErrors.push(new ApiTimeoutError(60000));

            expect(task.getCollectedErrors()).toHaveLength(1);

            task.resetCollectedErrors();
            expect(task.getCollectedErrors()).toEqual([]);
        });
    });

    describe('Error Handling in recursivelyMakeClineRequests', () => {
        it('should reset errors at the start of recursivelyMakeClineRequests', async () => {
            // Add some errors first
            (task as any).collectedErrors.push(new ApiTimeoutError(60000));
            expect(task.getCollectedErrors()).toHaveLength(1);

            // Mock the API to throw an error immediately
            const { buildApiHandler } = await import('llm-api');
            const mockCreateMessage = vi.fn().mockRejectedValue(new Error('API Error'));
            (buildApiHandler as any).mockReturnValue({
                createMessage: mockCreateMessage,
                getModel: vi.fn(() => ({ info: { supportsToolCalling: true } }))
            });

            // Create a new task with the mocked API
            const newTask = new Task('test-task', mockApiConfiguration);

            try {
                await newTask.recursivelyMakeClineRequests([{ type: 'text', text: 'test' }]);
            } catch (error) {
                // Expected to fail
            }

            // Errors should be reset at the start, then new errors collected
            const errors = newTask.getCollectedErrors();
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]).not.toBeInstanceOf(ApiTimeoutError); // Should be new errors
        });
    });
});