import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { Agent, defaultAgentConfig, defaultApiConfig, AgentConfig } from './agent';
import { ApiStreamChunk, ApiStream } from '../api';
import { BookshelfWorkspace } from './bookshelfWorkspace';
import { IWorkspace } from './agentWorkspace';
import { TaskStatus, ApiMessage } from '../task/task.type';
import { ToolUsage, TokenUsage } from '../types';
import { z } from 'zod';

// Mock workspace for testing
class MockWorkspace implements IWorkspace {
    info = {
        name: 'Test Workspace',
        desc: 'A test workspace',
    };

    editableProps: Record<string, any> = {
        test_field: {
            value: null,
            schema: z.string(),
            description: 'Test field',
            readonly: false,
        },
    };

    async renderContext(): Promise<string> {
        return 'Test workspace context';
    }

    async updateEditableProps(fieldName: string, value: any): Promise<any> {
        return {
            success: true,
            updatedField: fieldName,
            value,
        };
    }

    async handleStateUpdateToolCall(updates: Array<{ field_name: string; value: any }>): Promise<any[]> {
        return updates.map(update => ({
            success: true,
            updatedField: update.field_name,
            value: update.value,
        }));
    }

    getEditablePropsSchema(): any {
        return {
            fields: this.editableProps,
        };
    }
}

// Concrete Agent implementation for testing
class TestAgent extends Agent {
    constructor(
        config?: AgentConfig,
        apiConfig?: any,
        workspace?: IWorkspace,
        taskId?: string,
    ) {
        super(config, apiConfig, workspace || new MockWorkspace(), taskId);
    }

    // Expose private methods for testing
    exposeResetMessageState() {
        (this as any).resetMessageState();
    }

    exposeGetMessageState() {
        return (this as any).messageState;
    }

    exposeGetObservers() {
        return (this as any).observers;
    }

    exposeGetTokenUsageTracker() {
        return (this as any).tokenUsageTracker;
    }

    exposeGetToolUsageTracker() {
        return (this as any).toolUsageTracker;
    }

    exposeGetErrorHandler() {
        return (this as any).errorHandler;
    }

    exposeGetToolExecutor() {
        return (this as any).toolExecutor;
    }

    exposeBuildCleanConversationHistory(history: ApiMessage[]): Anthropic.MessageParam[] {
        return (this as any).buildCleanConversationHistory(history);
    }
}

// Helper function to create mock stream chunks
function createMockStream(chunks: ApiStreamChunk[]): ApiStream {
    return (async function* () {
        for (const chunk of chunks) {
            yield chunk;
        }
    })();
}

describe('Agent', () => {
    let agent: TestAgent;
    let mockWorkspace: MockWorkspace;

    beforeEach(() => {
        mockWorkspace = new MockWorkspace();
        agent = new TestAgent(defaultAgentConfig, defaultApiConfig, mockWorkspace, 'test-task-id');
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Constructor', () => {
        it('should initialize with default config', () => {
            expect(agent.getTaskId).toBe('test-task-id');
            expect(agent.status).toBe('idle');
            expect(agent.conversationHistory).toEqual([]);
        });

        it('should generate taskId if not provided', () => {
            const agentWithoutId = new TestAgent(defaultAgentConfig, defaultApiConfig, mockWorkspace);
            expect(agentWithoutId.getTaskId).toBeDefined();
            expect(typeof agentWithoutId.getTaskId).toBe('string');
            expect(agentWithoutId.getTaskId.length).toBeGreaterThan(0);
        });

        it('should initialize with custom config', () => {
            const customConfig: AgentConfig = {
                apiRequestTimeout: 30000,
                maxRetryAttempts: 5,
                consecutiveMistakeLimit: 10,
            };
            const customAgent = new TestAgent(customConfig, defaultApiConfig, mockWorkspace);
            expect(customAgent).toBeDefined();
        });
    });

    describe('Status Management', () => {
        it('should have idle status initially', () => {
            expect(agent.status).toBe('idle');
        });

        it('should change status to running on start', async () => {
            // Mock the recursivelyMakeClineRequests to avoid actual API calls
            const spy = vi.spyOn(agent as any, 'recursivelyMakeClineRequests').mockResolvedValue(true);

            await agent.start('test query');

            expect(agent.status).toBe('running');
            spy.mockRestore();
        });

        it('should change status to completed on complete', () => {
            agent.complete();
            expect(agent.status).toBe('completed');
        });

        it('should change status to aborted on abort', () => {
            agent.abort('Test abort reason');
            expect(agent.status).toBe('aborted');
        });
    });

    describe('Task ID', () => {
        it('should return correct task ID', () => {
            expect(agent.getTaskId).toBe('test-task-id');
        });

        it('should generate unique task IDs', () => {
            const agent1 = new TestAgent(defaultAgentConfig, defaultApiConfig, mockWorkspace);
            const agent2 = new TestAgent(defaultAgentConfig, defaultApiConfig, mockWorkspace);
            expect(agent1.getTaskId).not.toBe(agent2.getTaskId);
        });
    });

    describe('Observer Pattern', () => {
        it('should register and notify message added observers', () => {
            const callback = vi.fn();
            const unsubscribe = agent.onMessageAdded(callback);

            const testMessage: ApiMessage = {
                role: 'user',
                content: 'test message',
                ts: Date.now(),
            };

            const observers = agent.exposeGetObservers();
            (observers as any).notifyMessageAdded('test-task-id', testMessage);

            expect(callback).toHaveBeenCalledWith('test-task-id', testMessage);

            unsubscribe();
            callback.mockClear();

            (observers as any).notifyMessageAdded('test-task-id', testMessage);
            expect(callback).not.toHaveBeenCalled();
        });

        it('should register and notify status changed observers', () => {
            const callback = vi.fn();
            const unsubscribe = agent.onStatusChanged(callback);

            const observers = agent.exposeGetObservers();
            (observers as any).notifyStatusChanged('test-task-id', 'running');

            expect(callback).toHaveBeenCalledWith('test-task-id', 'running');

            unsubscribe();
            callback.mockClear();

            (observers as any).notifyStatusChanged('test-task-id', 'completed');
            expect(callback).not.toHaveBeenCalled();
        });

        it('should register and notify task completed observers', () => {
            const callback = vi.fn();
            const unsubscribe = agent.onTaskCompleted(callback);

            const observers = agent.exposeGetObservers();
            (observers as any).notifyTaskCompleted('test-task-id');

            expect(callback).toHaveBeenCalledWith('test-task-id');

            unsubscribe();
            callback.mockClear();

            (observers as any).notifyTaskCompleted('test-task-id');
            expect(callback).not.toHaveBeenCalled();
        });

        it('should register and notify task aborted observers', () => {
            const callback = vi.fn();
            const unsubscribe = agent.onTaskAborted(callback);

            const observers = agent.exposeGetObservers();
            (observers as any).notifyTaskAborted('test-task-id', 'Test abort reason');

            expect(callback).toHaveBeenCalledWith('test-task-id', 'Test abort reason');

            unsubscribe();
            callback.mockClear();

            (observers as any).notifyTaskAborted('test-task-id', 'Another reason');
            expect(callback).not.toHaveBeenCalled();
        });

        it('should support multiple observers for same event', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            const callback3 = vi.fn();

            agent.onStatusChanged(callback1);
            agent.onStatusChanged(callback2);
            agent.onStatusChanged(callback3);

            const observers = agent.exposeGetObservers();
            (observers as any).notifyStatusChanged('test-task-id', 'running');

            expect(callback1).toHaveBeenCalledWith('test-task-id', 'running');
            expect(callback2).toHaveBeenCalledWith('test-task-id', 'running');
            expect(callback3).toHaveBeenCalledWith('test-task-id', 'running');
        });
    });

    describe('Message Processing State', () => {
        it('should reset message state', () => {
            const state = agent.exposeGetMessageState();
            state.assistantMessageContent = [{ type: 'text', content: 'test' }];
            state.userMessageContent = [{ type: 'text', text: 'test' }];
            state.didAttemptCompletion = true;

            agent.exposeResetMessageState();

            const resetState = agent.exposeGetMessageState();
            expect(resetState.assistantMessageContent).toEqual([]);
            expect(resetState.userMessageContent).toEqual([]);
            expect(resetState.didAttemptCompletion).toBe(false);
        });

        it('should initialize with empty message state', () => {
            const state = agent.exposeGetMessageState();
            expect(state.assistantMessageContent).toEqual([]);
            expect(state.userMessageContent).toEqual([]);
            expect(state.didAttemptCompletion).toBe(false);
            expect(state.cachedModel).toBeUndefined();
        });
    });

    describe('Token Usage Tracking', () => {
        it('should track token usage', () => {
            const tracker = agent.exposeGetTokenUsageTracker();

            const usageChunk: ApiStreamChunk = {
                type: 'usage',
                inputTokens: 100,
                outputTokens: 50,
                cacheWriteTokens: 20,
                cacheReadTokens: 10,
                totalCost: 0.001,
            };

            tracker.accumulate(usageChunk);

            const usage = agent.tokenUsage;
            expect(usage.totalTokensIn).toBe(100);
            expect(usage.totalTokensOut).toBe(50);
            expect(usage.totalCacheWrites).toBe(20);
            expect(usage.totalCacheReads).toBe(10);
            expect(usage.totalCost).toBe(0.001);
        });

        it('should accumulate multiple usage chunks', () => {
            const tracker = agent.exposeGetTokenUsageTracker();

            tracker.accumulate({
                type: 'usage',
                inputTokens: 100,
                outputTokens: 50,
            });

            tracker.accumulate({
                type: 'usage',
                inputTokens: 200,
                outputTokens: 100,
            });

            const usage = agent.tokenUsage;
            expect(usage.totalTokensIn).toBe(300);
            expect(usage.totalTokensOut).toBe(150);
        });

        it('should ignore non-usage chunks', () => {
            const tracker = agent.exposeGetTokenUsageTracker();

            tracker.accumulate({ type: 'text', text: 'test' } as any);
            tracker.accumulate({ type: 'error', error: 'test', message: 'test' } as any);

            const usage = agent.tokenUsage;
            expect(usage.totalTokensIn).toBe(0);
            expect(usage.totalTokensOut).toBe(0);
        });

        it('should reset token usage', () => {
            const tracker = agent.exposeGetTokenUsageTracker();

            tracker.accumulate({
                type: 'usage',
                inputTokens: 100,
                outputTokens: 50,
            });

            tracker.reset();

            const usage = agent.tokenUsage;
            expect(usage.totalTokensIn).toBe(0);
            expect(usage.totalTokensOut).toBe(0);
            expect(usage.totalCacheWrites).toBe(0);
            expect(usage.totalCacheReads).toBe(0);
            expect(usage.totalCost).toBe(0);
        });

        it('should set context tokens', () => {
            const tracker = agent.exposeGetTokenUsageTracker();
            tracker.setContextTokens(1000);

            const usage = agent.tokenUsage;
            expect(usage.contextTokens).toBe(1000);
        });
    });

    describe('Tool Usage Tracking', () => {
        it('should track tool attempts', () => {
            const tracker = agent.exposeGetToolUsageTracker();

            tracker.trackAttempt('attempt_completion' as any);
            tracker.trackAttempt('semantic_search' as any);
            tracker.trackAttempt('update_workspace' as any);

            const usage = agent.toolUsage;
            expect(usage['attempt_completion']?.attempts).toBe(1);
            expect(usage['semantic_search']?.attempts).toBe(1);
            expect(usage['update_workspace']?.attempts).toBe(1);
        });

        it('should track tool failures', () => {
            const tracker = agent.exposeGetToolUsageTracker();

            tracker.trackFailure('attempt_completion' as any);
            tracker.trackFailure('semantic_search' as any);

            const usage = agent.toolUsage;
            expect(usage['attempt_completion']?.failures).toBe(1);
            expect(usage['semantic_search']?.failures).toBe(1);
        });

        it('should track multiple attempts and failures', () => {
            const tracker = agent.exposeGetToolUsageTracker();

            tracker.trackAttempt('semantic_search' as any);
            tracker.trackAttempt('semantic_search' as any);
            tracker.trackFailure('semantic_search' as any);
            tracker.trackAttempt('semantic_search' as any);

            const usage = agent.toolUsage;
            expect(usage['semantic_search']?.attempts).toBe(3);
            expect(usage['semantic_search']?.failures).toBe(1);
        });

        it('should reset tool usage', () => {
            const tracker = agent.exposeGetToolUsageTracker();

            tracker.trackAttempt('attempt_completion' as any);
            tracker.trackFailure('semantic_search' as any);

            tracker.reset();

            const usage = agent.toolUsage;
            expect(usage).toEqual({});
        });
    });

    describe('Error Handling', () => {
        it('should collect errors', () => {
            const errorHandler = agent.exposeGetErrorHandler();

            const testError = new Error('Test error');
            errorHandler.handleError(testError, 0);

            const errors = agent.getCollectedErrors();
            expect(errors).toHaveLength(1);
            expect(errors[0]).toBe(testError);
        });

        it('should convert non-error objects to Error', () => {
            const errorHandler = agent.exposeGetErrorHandler();

            const testError = errorHandler.convertToTaskError('string error');
            expect(testError).toBeInstanceOf(Error);
            expect(testError.message).toBe('string error');

            const testError2 = errorHandler.convertToTaskError({ message: 'object error' });
            expect(testError2).toBeInstanceOf(Error);
            expect(testError2.message).toBe('[object Object]');
        });

        it('should reset collected errors', () => {
            const errorHandler = agent.exposeGetErrorHandler();

            errorHandler.handleError(new Error('Test error'), 0);
            expect(agent.getCollectedErrors()).toHaveLength(1);

            agent.resetCollectedErrors();
            expect(agent.getCollectedErrors()).toHaveLength(0);
        });

        it('should return shouldAbort based on retry attempts', () => {
            const errorHandler = agent.exposeGetErrorHandler();

            // Should not abort on first attempt
            const shouldAbort1 = errorHandler.handleError(new Error('Test error'), 0);
            expect(shouldAbort1).toBe(false);

            // Should abort on max retry attempts
            const shouldAbort2 = errorHandler.handleError(new Error('Test error'), 2);
            expect(shouldAbort2).toBe(true);
        });
    });

    describe('Conversation History', () => {
        it('should initialize with empty conversation history', () => {
            expect(agent.conversationHistory).toEqual([]);
        });

        it('should build clean conversation history', () => {
            const history: ApiMessage[] = [
                {
                    role: 'user',
                    content: 'Hello',
                    ts: Date.now(),
                },
                {
                    role: 'assistant',
                    content: 'Hi there!',
                    ts: Date.now(),
                },
            ];

            const cleanHistory = agent.exposeBuildCleanConversationHistory(history);

            expect(cleanHistory).toHaveLength(2);
            expect(cleanHistory[0].role).toBe('user');
            expect(cleanHistory[1].role).toBe('assistant');
        });

        it('should filter out system messages', () => {
            const history: ApiMessage[] = [
                {
                    role: 'system',
                    content: 'System prompt',
                    ts: Date.now(),
                },
                {
                    role: 'user',
                    content: 'Hello',
                    ts: Date.now(),
                },
            ];

            const cleanHistory = agent.exposeBuildCleanConversationHistory(history);

            expect(cleanHistory).toHaveLength(1);
            expect(cleanHistory[0].role).toBe('user');
        });

        it('should filter out thinking blocks', () => {
            const history: ApiMessage[] = [
                {
                    role: 'assistant',
                    content: [
                        { type: 'thinking', thinking: 'Thinking process' },
                        { type: 'text', text: 'Response' },
                    ],
                    ts: Date.now(),
                },
            ];

            const cleanHistory = agent.exposeBuildCleanConversationHistory(history);

            expect(cleanHistory).toHaveLength(1);
            expect(cleanHistory[0].role).toBe('assistant');
            const content = cleanHistory[0].content as Anthropic.ContentBlockParam[];
            expect(content).toHaveLength(1);
            expect(content[0].type).toBe('text');
        });

        it('should handle string content', () => {
            const history: ApiMessage[] = [
                {
                    role: 'user',
                    content: 'String content',
                    ts: Date.now(),
                },
            ];

            const cleanHistory = agent.exposeBuildCleanConversationHistory(history);

            expect(cleanHistory[0].content).toBe('String content');
        });

        it('should handle array content', () => {
            const history: ApiMessage[] = [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Text content' },
                    ],
                    ts: Date.now(),
                },
            ];

            const cleanHistory = agent.exposeBuildCleanConversationHistory(history);

            const content = cleanHistory[0].content as Anthropic.ContentBlockParam[];
            expect(content).toHaveLength(1);
            const textBlock = content[0] as Anthropic.TextBlockParam;
            expect(textBlock.type).toBe('text');
            expect(textBlock.text).toBe('Text content');
        });
    });

    describe('Workspace Integration', () => {
        it('should have workspace instance', () => {
            expect(agent).toBeDefined();
        });

        it('should get system prompt with workspace context', async () => {
            const systemPrompt = await (agent as any).getSystemPrompt();
            expect(systemPrompt).toContain('Test workspace context');
        });
    });

    describe('Consecutive Mistake Tracking', () => {
        it('should initialize with zero consecutive mistakes', () => {
            expect(agent.consecutiveMistakeCount).toBe(0);
        });

        it('should track consecutive mistakes', () => {
            agent.consecutiveMistakeCount = 3;
            expect(agent.consecutiveMistakeCount).toBe(3);
        });
    });

    describe('Tool Calling Parser', () => {
        it('should have tool calling parser instance', () => {
            expect(agent.toolCallingParser).toBeDefined();
        });
    });

    describe('Tool Execution', () => {
        it('should execute tool call with workspace context', async () => {
            const toolExecutor = agent.exposeGetToolExecutor();
            const result = await toolExecutor.executeToolCalls(
                [
                    {
                        type: 'tool_use',
                        id: 'test-id',
                        name: 'update_workspace',
                        params: { field_name: 'test_field', value: 'test_value' },
                    },
                ],
                () => false,
            );

            expect(result).toBeDefined();
        });
    });

    describe('Default Configurations', () => {
        it('should have default agent config', () => {
            expect(defaultAgentConfig.apiRequestTimeout).toBe(60000);
            expect(defaultAgentConfig.maxRetryAttempts).toBe(3);
            expect(defaultAgentConfig.consecutiveMistakeLimit).toBeDefined();
        });

        it('should have default API config', () => {
            expect(defaultApiConfig.apiProvider).toBe('zai');
            expect(defaultApiConfig.apiModelId).toBe('glm-4.7');
            expect(defaultApiConfig.toolProtocol).toBe('xml');
        });
    });

    describe('Abstract Class', () => {
        it('should be abstract and cannot be instantiated directly', () => {
            // Agent is abstract, so we need a concrete implementation
            // TestAgent is our concrete implementation
            expect(agent).toBeInstanceOf(TestAgent);
            expect(agent).toBeInstanceOf(Agent);
        });
    });
});

describe('Agent with BookshelfWorkspace', () => {
    let agent: TestAgent;
    let workspace: BookshelfWorkspace;

    beforeEach(async () => {
        workspace = new BookshelfWorkspace();
        await workspace.init();
        agent = new TestAgent(defaultAgentConfig, defaultApiConfig, workspace, 'test-task-id');
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Workspace Integration', () => {
        it('should get system prompt with bookshelf workspace context', async () => {
            const systemPrompt = await (agent as any).getSystemPrompt();
            expect(systemPrompt).toContain('Workspace Information');
            expect(systemPrompt).toContain('Book Viewer');
            expect(systemPrompt).toContain('Search');
        });

        it('should handle workspace state updates', async () => {
            const toolExecutor = agent.exposeGetToolExecutor();
            const result = await toolExecutor.executeToolCalls(
                [
                    {
                        type: 'tool_use',
                        id: 'test-id',
                        name: 'update_workspace',
                        params: { field_name: 'selected_book_name', value: 'Physiology' },
                    },
                ],
                () => false,
            );

            expect(result).toBeDefined();
        });
    });
});
