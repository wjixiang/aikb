import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent, defaultAgentConfig } from '../agent.js';
import {
    createObservableAgent,
    ObservableAgentFactory,
    observeAgent,
    type ObservableAgentCallbacks,
} from '../ObservableAgent.js';
import { TaskStatus } from '../../task/task.type.js';
import { VirtualWorkspace } from '../../statefulContext/index.js';
import { OpenaiCompatibleApiClient } from '../../api-client/OpenaiCompatibleApiClient.js';
import { MemoryModule } from '../../memory/MemoryModule.js';
import { TurnMemoryStore } from '../../memory/TurnMemoryStore.js';
import type { Logger } from 'pino';

// Mock VirtualWorkspace
vi.mock('statefulContext', () => ({
    VirtualWorkspace: class {
        render = vi.fn().mockResolvedValue('mock workspace context');
        renderToolBox = vi.fn().mockReturnValue({ render: () => '' });
        handleToolCall = vi.fn().mockResolvedValue({ success: true });
    },
}));

// Mock Logger
const mockLogger: Logger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    silent: vi.fn(),
    child: vi.fn(() => mockLogger as any),
} as any;

// Helper function to create a mock API client
function createMockApiClient() {
    return new OpenaiCompatibleApiClient({
        apiKey: 'test-key',
        model: 'gpt-4',
        enableLogging: false,
    });
}

// Helper function to create a mock MemoryModule
function createMockMemoryModule(apiClient: ReturnType<typeof createMockApiClient>) {
    const turnStore = new TurnMemoryStore();
    return new MemoryModule(apiClient, mockLogger, {}, turnStore);
}

describe('ObservableAgent', () => {
    let mockWorkspace: VirtualWorkspace;
    let agent: Agent;

    beforeEach(() => {
        mockWorkspace = new VirtualWorkspace({ id: 'test-workspace' } as any);
        const apiClient = createMockApiClient();
        const memoryModule = createMockMemoryModule(apiClient);
        agent = new Agent(
            defaultAgentConfig,
            mockWorkspace,
            { capability: 'test', direction: 'test' },
            apiClient,
            memoryModule
        );
    });

    describe('createObservableAgent', () => {
        it('should create a proxy that wraps the original agent', () => {
            const callbacks: ObservableAgentCallbacks = {
                onStatusChanged: vi.fn(),
            };
            const observableAgent = createObservableAgent(agent, callbacks);

            expect(observableAgent).toBeInstanceOf(Agent);
            expect(observableAgent.status).toBe('idle');
        });

        it('should notify onStatusChanged when status changes', () => {
            const onStatusChanged = vi.fn();
            const callbacks: ObservableAgentCallbacks = {
                onStatusChanged,
            };
            const observableAgent = createObservableAgent(agent, callbacks);

            // Directly set _status to test the proxy
            (observableAgent as any)._status = 'running';

            expect(onStatusChanged).toHaveBeenCalledWith(
                observableAgent.getTaskId,
                'running'
            );
        });

        it('should notify onTaskCompleted when status becomes completed', () => {
            const onTaskCompleted = vi.fn();
            const callbacks: ObservableAgentCallbacks = {
                onTaskCompleted,
            };
            const observableAgent = createObservableAgent(agent, callbacks);

            // Simulate completion
            (observableAgent as any)._status = 'completed';

            expect(onTaskCompleted).toHaveBeenCalledWith(observableAgent.getTaskId);
        });

        it('should notify onTaskAborted when status becomes aborted', () => {
            const onTaskAborted = vi.fn();
            const callbacks: ObservableAgentCallbacks = {
                onTaskAborted,
            };
            const observableAgent = createObservableAgent(agent, callbacks);

            // Simulate abortion
            (observableAgent as any)._status = 'aborted';

            expect(onTaskAborted).toHaveBeenCalledWith(
                observableAgent.getTaskId,
                'Task aborted'
            );
        });

        it('should notify onPropertyChange for non-status properties', () => {
            const onPropertyChange = vi.fn();
            const callbacks: ObservableAgentCallbacks = {
                onPropertyChange,
            };
            const observableAgent = createObservableAgent(agent, callbacks);

            // Change a non-status property
            (observableAgent as any)._consecutiveMistakeCount = 5;

            expect(onPropertyChange).toHaveBeenCalledWith(
                '_consecutiveMistakeCount',
                5,
                0
            );
        });

        it('should notify onMethodCall when methods are called', () => {
            const onMethodCall = vi.fn();
            const callbacks: ObservableAgentCallbacks = {
                onMethodCall,
            };
            const observableAgent = createObservableAgent(agent, callbacks);

            observableAgent.getCollectedErrors();

            expect(onMethodCall).toHaveBeenCalledWith('getCollectedErrors', []);
        });

        it('should preserve all original agent methods and properties', () => {
            const callbacks: ObservableAgentCallbacks = {};
            const observableAgent = createObservableAgent(agent, callbacks);

            expect(observableAgent.status).toBe(agent.status);
            expect(observableAgent.getTaskId).toBe(agent.getTaskId);
            expect(observableAgent.tokenUsage).toEqual(agent.tokenUsage);
            expect(observableAgent.toolUsage).toEqual(agent.toolUsage);
            expect(observableAgent.conversationHistory).toEqual(
                agent.conversationHistory
            );
        });
    });

    describe('ObservableAgentFactory', () => {
        it('should create an observable agent with fluent API', () => {
            const onStatusChanged = vi.fn();
            const onTaskCompleted = vi.fn();

            const factory = new ObservableAgentFactory()
                .onStatusChanged(onStatusChanged)
                .onTaskCompleted(onTaskCompleted);

            const observableAgent = factory.create(agent);

            (observableAgent as any)._status = 'completed';

            expect(onStatusChanged).toHaveBeenCalledWith(
                observableAgent.getTaskId,
                'completed'
            );
            expect(onTaskCompleted).toHaveBeenCalledWith(
                observableAgent.getTaskId
            );
        });

        it('should support chaining all callback types', () => {
            const factory = new ObservableAgentFactory()
                .onMessageAdded(vi.fn())
                .onStatusChanged(vi.fn())
                .onTaskCompleted(vi.fn())
                .onTaskAborted(vi.fn())
                .onMethodCall(vi.fn())
                .onPropertyChange(vi.fn())
                .onError(vi.fn());

            const observableAgent = factory.create(agent);

            expect(observableAgent).toBeInstanceOf(Agent);
        });
    });

    describe('observeAgent utility', () => {
        it('should create an observable agent with shorthand syntax', () => {
            const onStatusChanged = vi.fn();
            const observableAgent = observeAgent(agent, {
                onStatusChanged,
            });

            (observableAgent as any)._status = 'running';

            expect(onStatusChanged).toHaveBeenCalledWith(
                observableAgent.getTaskId,
                'running'
            );
        });
    });

    describe('Error handling', () => {
        it('should notify onError when method throws error', () => {
            const onError = vi.fn();
            const callbacks: ObservableAgentCallbacks = {
                onError,
            };

            // Create an agent that will throw
            const errorApiClient = createMockApiClient();
            const errorAgent = new Agent(
                defaultAgentConfig,
                new VirtualWorkspace({ id: 'error-workspace' } as any),
                { capability: 'test', direction: 'test' },
                errorApiClient,
                createMockMemoryModule(errorApiClient)
            ) as any;
            errorAgent.throwError = () => {
                throw new Error('Test error');
            };

            const observableAgent = createObservableAgent(errorAgent, callbacks);

            expect(() => observableAgent.throwError()).toThrow('Test error');
            expect(onError).toHaveBeenCalledWith(
                expect.any(Error),
                'Method: throwError'
            );
        });
    });

    describe('Integration with existing Agent behavior', () => {
        it('should work with complete() method', () => {
            const onStatusChanged = vi.fn();
            const onTaskCompleted = vi.fn();
            const callbacks: ObservableAgentCallbacks = {
                onStatusChanged,
                onTaskCompleted,
            };
            const observableAgent = createObservableAgent(agent, callbacks);

            observableAgent.complete();

            expect(onStatusChanged).toHaveBeenCalledWith(
                observableAgent.getTaskId,
                'completed'
            );
            expect(onTaskCompleted).toHaveBeenCalledWith(
                observableAgent.getTaskId
            );
            expect(observableAgent.status).toBe('completed');
        });

        it('should work with abort() method', () => {
            const onStatusChanged = vi.fn();
            const onTaskAborted = vi.fn();
            const callbacks: ObservableAgentCallbacks = {
                onStatusChanged,
                onTaskAborted,
            };
            const observableAgent = createObservableAgent(agent, callbacks);

            observableAgent.abort('Test abort reason');

            expect(onStatusChanged).toHaveBeenCalledWith(
                observableAgent.getTaskId,
                'aborted'
            );
            expect(onTaskAborted).toHaveBeenCalledWith(
                observableAgent.getTaskId,
                'Test abort reason'
            );
            expect(observableAgent.status).toBe('aborted');
        });

        it('should allow setting conversation history', () => {
            const callbacks: ObservableAgentCallbacks = {};
            const observableAgent = createObservableAgent(agent, callbacks);

            const newHistory = [
                { role: 'user' as const, content: [{ type: 'text' as const, text: 'test message' }] },
            ];
            observableAgent.conversationHistory = newHistory;

            expect(observableAgent.conversationHistory).toEqual(newHistory);
        });
    });

    describe('Multiple observers', () => {
        it('should support multiple independent observers', () => {
            const observer1 = vi.fn();
            const observer2 = vi.fn();

            const agent1 = createObservableAgent(agent, {
                onStatusChanged: observer1,
            });
            const agent2 = createObservableAgent(agent, {
                onStatusChanged: observer2,
            });

            (agent1 as any)._status = 'running';

            expect(observer1).toHaveBeenCalledWith(agent1.getTaskId, 'running');
            expect(observer2).not.toHaveBeenCalled();
        });
    });
});
