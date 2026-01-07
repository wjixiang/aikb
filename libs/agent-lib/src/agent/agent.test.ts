import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { Agent, defaultAgentConfig, defaultApiConfig, AgentConfig } from './agent';
import { ApiStreamChunk, ApiStream } from '../api';
import { BookshelfWorkspace } from './workspaces/bookshelfWorkspace/bookshelfWorkspace';
import { WorkspaceBase } from './agentWorkspace';
import { ApiMessage } from '../task/task.type';
import { z } from 'zod';

// Mock workspace for testing
class MockWorkspace extends WorkspaceBase {
    editableProps: Record<string, any>;

    constructor() {
        super({
            name: 'Test Workspace',
            desc: 'A test workspace',
        });
        this.editableProps = {
            test_field: {
                value: null,
                schema: z.string(),
                description: 'Test field',
                readonly: false,
            },
        };
    }

    async getWorkspacePrompt(): Promise<string> {
        return ``;
    }

    protected async renderContextImpl(): Promise<string> {
        return 'Test workspace context';
    }

    override async updateEditableProps(updates: Array<{ field_name: string; value: any }>): Promise<any[]> {
        return updates.map(update => ({
            success: true,
            updatedField: update.field_name,
            previousValue: this.editableProps[update.field_name]?.value,
            newValue: update.value,
        }));
    }

    override getEditablePropsSchema(): any {
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
        workspace?: WorkspaceBase,
        taskId?: string,
    ) {
        super(config, apiConfig, workspace || new MockWorkspace(), taskId);
    }

    // Expose private methods for testing
    exposeResetMessageState() {
        (this as any).taskExecutor.resetMessageState();
    }

    exposeGetMessageState() {
        return (this as any).taskExecutor.messageState;
    }

    exposeGetObservers() {
        return (this as any).taskExecutor.observers;
    }

    exposeGetTokenUsageTracker() {
        return (this as any).taskExecutor.tokenUsageTracker;
    }

    exposeGetToolUsageTracker() {
        return (this as any).taskExecutor.toolUsageTracker;
    }

    exposeGetErrorHandler() {
        return (this as any).taskExecutor.errorHandler;
    }

    exposeGetToolExecutor() {
        return (this as any).taskExecutor;
    }

    exposeBuildCleanConversationHistory(history: ApiMessage[]): Anthropic.MessageParam[] {
        return (this as any).taskExecutor.buildCleanConversationHistory(history);
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
            const spy = vi.spyOn((agent as any).taskExecutor, 'recursivelyMakeClineRequests').mockResolvedValue(true);

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

            // Trigger the message added event through complete method
            agent.complete();
            // Manually add a message to history which should trigger the observer
            (agent as any).taskExecutor.conversationHistoryRef.push(testMessage);

            // Since the observer is triggered by addToConversationHistory, we need to trigger it directly
            const observers = agent.exposeGetObservers();
            if (observers && typeof observers.notifyMessageAdded === 'function') {
                observers.notifyMessageAdded('test-task-id', testMessage);
                expect(callback).toHaveBeenCalledWith('test-task-id', testMessage);
            }

            unsubscribe();
            callback.mockClear();

            if (observers && typeof observers.notifyMessageAdded === 'function') {
                observers.notifyMessageAdded('test-task-id', testMessage);
                expect(callback).not.toHaveBeenCalled();
            }
        });

        it('should register and notify status changed observers', () => {
            const callback = vi.fn();
            const unsubscribe = agent.onStatusChanged(callback);

            // Trigger status change through complete method
            agent.complete();
            expect(callback).toHaveBeenCalledWith('test-task-id', 'completed');

            unsubscribe();
            callback.mockClear();

            // Trigger another status change
            agent.abort('Test abort');
            expect(callback).not.toHaveBeenCalled();
        });

        it('should register and notify task completed observers', () => {
            const callback = vi.fn();
            const unsubscribe = agent.onTaskCompleted(callback);

            // Trigger task completion
            agent.complete();
            expect(callback).toHaveBeenCalledWith('test-task-id');

            unsubscribe();
            callback.mockClear();

            // Trigger another completion
            agent.complete();
            expect(callback).not.toHaveBeenCalled();
        });

        it('should register and notify task aborted observers', () => {
            const callback = vi.fn();
            const unsubscribe = agent.onTaskAborted(callback);

            // Trigger task abort
            agent.abort('Test abort reason');
            expect(callback).toHaveBeenCalledWith('test-task-id', 'Test abort reason');

            unsubscribe();
            callback.mockClear();

            // Trigger another abort
            agent.abort('Another reason');
            expect(callback).not.toHaveBeenCalled();
        });

        it('should support multiple observers for same event', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            const callback3 = vi.fn();

            agent.onStatusChanged(callback1);
            agent.onStatusChanged(callback2);
            agent.onStatusChanged(callback3);

            // Trigger status change
            agent.complete();

            expect(callback1).toHaveBeenCalledWith('test-task-id', 'completed');
            expect(callback2).toHaveBeenCalledWith('test-task-id', 'completed');
            expect(callback3).toHaveBeenCalledWith('test-task-id', 'completed');
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

    describe('Task Executor', () => {
        it('should have task executor instance', () => {
            const taskExecutor = agent.exposeGetToolExecutor();
            expect(taskExecutor).toBeDefined();
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
        });
    });
})