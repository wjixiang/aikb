import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent, AgentConfig, AgentPrompt } from '../agent.js';
import { VirtualWorkspace } from '../../statefulContext/index.js';
import { ToolComponent } from '../../statefulContext/index.js';
import { Tool } from '../../statefulContext/index.js';
import { tdiv } from '../../statefulContext/index.js';
import * as z from 'zod';
import type { ApiClient, ApiResponse } from '../../api-client/index.js';
import { MemoryModule } from '../../memory/MemoryModule.js';
import { TurnMemoryStore } from '../../memory/TurnMemoryStore.js';
import type { Logger } from 'pino';
import { ThinkingModule } from '../../thinking/ThinkingModule.js';
import { TaskModule } from '../../task/TaskModule.js';
import { TYPES } from '../../di/types.js';
import { Container } from 'inversify';
import { ToolManager } from '../../tools/index.js';
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
    close: vi.fn(),
} as any;

// Mock ApiClient for MemoryModule and ThinkingModule
const mockApiClient: ApiClient = {
    makeRequest: vi.fn().mockResolvedValue({
        toolCalls: [],
        textResponse: 'Test response',
        requestTime: 100,
        tokenUsage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150
        }
    })
};

// Mock ApiClient for Agent (with tool calls for action phase)
const createMockApiClientWithToolCalls = (toolCalls: any[]): ApiClient => {
    return {
        makeRequest: vi.fn().mockResolvedValue({
            toolCalls,
            textResponse: null,
            requestTime: 100,
            tokenUsage: {
                promptTokens: 100,
                completionTokens: 50,
                totalTokens: 150
            }
        })
    };
};

// Test component with a simple tool
class TestToolComponent extends ToolComponent {
    toolSet = new Map<string, Tool>([
        ['test_action_tool', {
            toolName: 'test_action_tool',
            desc: 'A test action tool',
            paramsSchema: z.object({ action: z.string() })
        }]
    ]);

    private lastAction = '';

    renderImply = async (): Promise<tdiv[]> => {
        return [
            new tdiv({
                content: `Last Action: ${this.lastAction}`,
                styles: { width: 80, showBorder: false }
            })
        ];
    };

    handleToolCall = async (toolName: string, params: any): Promise<void> => {
        if (toolName === 'test_action_tool') {
            this.lastAction = params.action;
        }
    };

    getLastAction(): string {
        return this.lastAction;
    }
}

describe('Agent Thinking to Action Phase Transition', () => {
    let agent: Agent;
    let workspace: VirtualWorkspace;
    let testComponent: TestToolComponent;
    let memoryModule: MemoryModule;
    let thinkingModule: ThinkingModule;
    let taskModule: TaskModule;
    let mockApiClientWithToolCalls: ApiClient;
    const agentPrompt: AgentPrompt = {
        capability: 'Base agent capability - can perform general tasks',
        direction: 'Base agent direction - follow standard operating procedures'
    };
    const agentConfig: AgentConfig = {
        apiRequestTimeout: 40000,
        maxRetryAttempts: 3,
        consecutiveMistakeLimit: 5
    };

    beforeEach(() => {
        // Create a new workspace for each test with ToolManager
        const toolManager = new ToolManager();
        workspace = new VirtualWorkspace({
            id: 'test-workspace',
            name: 'Test Workspace',
            description: 'A workspace for testing thinking to action transition'
        }, toolManager);

        // Create and register test component
        testComponent = new TestToolComponent();
        workspace.registerComponent({
            key: 'test-component',
            component: testComponent,
            priority: 0
        });

        // Create memory module
        const turnStore = new TurnMemoryStore();
        thinkingModule = new ThinkingModule(mockApiClient, mockLogger, {}, turnStore);
        memoryModule = new MemoryModule(mockLogger, {}, turnStore, thinkingModule);

        // Create task module
        taskModule = new TaskModule();

        // Create mock API client with tool calls for action phase
        mockApiClientWithToolCalls = createMockApiClientWithToolCalls([
            {
                id: 'tool_call_1',
                call_id: 'call_1',
                type: 'function_call',
                name: 'test_action_tool',
                arguments: JSON.stringify({ action: 'test_action' })
            }
        ]);

        // Create agent with mocked API client for action phase
        agent = new Agent(
            agentConfig,
            workspace,
            agentPrompt,
            mockApiClientWithToolCalls,
            memoryModule,
            thinkingModule,
            taskModule,
            mockLogger as any
        );
    });

    describe('Thinking Phase Exit', () => {
        it.only('should exit thinking phase and enter action phase when LLM decides to stop thinking', async () => {
            // Mock ThinkingModule to return a result indicating thinking is complete
            const mockThinkingResult = {
                rounds: [{
                    roundNumber: 1,
                    content: 'Analysis completed',
                    continueThinking: false,
                    recalledContexts: [],
                    tokens: 50,
                    summary: 'Analysis completed. Ready to proceed to action phase.',
                    thoughtNumber: 1,
                    totalThoughts: 1,
                }],
                tokensUsed: 50,
                shouldProceedToAction: true,
                summary: 'Analysis completed. Ready to proceed to action phase.'
            };

            // Spy on thinking module
            const thinkingSpy = vi.spyOn(thinkingModule, 'performThinkingPhase')
                .mockResolvedValue(mockThinkingResult);

            // Spy on the API client that the agent actually uses
            // Use a counter to return different responses on first vs second call
            let apiCallCount = 0;
            const agentApiSpy = vi.spyOn(mockApiClientWithToolCalls, 'makeRequest')
                .mockImplementation(async (...args: any[]) => {
                    apiCallCount++;

                    // First call: return test_action_tool
                    if (apiCallCount === 1) {
                        return {
                            toolCalls: [{
                                id: 'tool_call_1',
                                call_id: 'call_1',
                                type: 'function_call' as const,
                                name: 'test_action_tool',
                                arguments: JSON.stringify({ action: 'test_action' })
                            }],
                            textResponse: '',
                            requestTime: 100,
                            tokenUsage: {
                                promptTokens: 100,
                                completionTokens: 50,
                                totalTokens: 150
                            }
                        };
                    }

                    // Second call: return attempt_completion to stop the loop
                    return {
                        toolCalls: [{
                            id: 'completion_call',
                            call_id: 'completion_call_id',
                            type: 'function_call' as const,
                            name: 'attempt_completion',
                            arguments: JSON.stringify({ result: 'Task completed successfully' })
                        }],
                        textResponse: '',
                        requestTime: 100,
                        tokenUsage: {
                            promptTokens: 100,
                            completionTokens: 50,
                            totalTokens: 150
                        }
                    };
                });

            // Start agent
            const startPromise = agent.start('Test task: perform an action');

            // Wait for agent to complete (with timeout)
            await Promise.race([
                startPromise,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Agent start timed out')), 500)
                )
            ]);

            // console.log(agentApiSpy.mock.calls)
            for (const call of agentApiSpy.mock.calls) {

                if (call[4]) {
                    console.log(call[4])
                    // Verify all tools have been injected into request
                    expect(call[4]?.length > 0).toBe(true)
                }
            }
            // Verify thinking phase was called
            expect(thinkingSpy).toHaveBeenCalled();

            // Verify agent status is completed (not stuck in thinking phase)
            expect(agent.status).toBe('completed');

            thinkingSpy.mockRestore();
            agentApiSpy.mockRestore();
        });

        it('should continue thinking when LLM decides to continue thinking', async () => {
            // Mock ThinkingModule to return a result indicating more thinking is needed
            const mockThinkingResult = {
                rounds: [{
                    roundNumber: 1,
                    content: 'Need more analysis',
                    continueThinking: true,
                    recalledContexts: [],
                    tokens: 50,
                    thoughtNumber: 1,
                    totalThoughts: 3,
                }],
                tokensUsed: 50,
                shouldProceedToAction: true,
                summary: undefined
            };

            // Spy on thinking module - first call returns continueThinking: true
            // Second call returns continueThinking: false
            const mockThinkingResult2 = {
                rounds: [{
                    roundNumber: 1,
                    content: 'Analysis completed',
                    continueThinking: false,
                    recalledContexts: [],
                    tokens: 50,
                    summary: 'Analysis completed.',
                    thoughtNumber: 2,
                    totalThoughts: 3,
                }],
                tokensUsed: 50,
                shouldProceedToAction: true,
                summary: 'Analysis completed.'
            };

            const thinkingSpy = vi.spyOn(thinkingModule, 'performThinkingPhase')
                .mockResolvedValueOnce(mockThinkingResult)
                .mockResolvedValueOnce(mockThinkingResult2);

            // Start agent
            const startPromise = agent.start('Test task: analyze then act');

            // Wait for agent to complete (with timeout)
            await Promise.race([
                startPromise,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Agent start timed out')), 5000)
                )
            ]);

            // Verify thinking phase was called twice (continued thinking, then exited)
            expect(thinkingSpy).toHaveBeenCalledTimes(2);

            // Verify agent status is completed
            expect(agent.status).toBe('completed');

            thinkingSpy.mockRestore();
        });

        it('should handle multiple thinking rounds before exiting to action phase', async () => {
            // Mock multiple thinking rounds
            const mockThinkingResults = [
                {
                    rounds: [{
                        roundNumber: 1,
                        content: 'First round of analysis',
                        continueThinking: true,
                        recalledContexts: [],
                        tokens: 50,
                        thoughtNumber: 1,
                        totalThoughts: 3,
                    }],
                    tokensUsed: 50,
                    shouldProceedToAction: true,
                },
                {
                    rounds: [{
                        roundNumber: 1,
                        content: 'Second round of analysis',
                        continueThinking: true,
                        recalledContexts: [],
                        tokens: 50,
                        thoughtNumber: 2,
                        totalThoughts: 3,
                    }],
                    tokensUsed: 50,
                    shouldProceedToAction: true,
                },
                {
                    rounds: [{
                        roundNumber: 1,
                        content: 'Final analysis',
                        continueThinking: false,
                        recalledContexts: [],
                        tokens: 50,
                        summary: 'Analysis complete. Ready for action.',
                        thoughtNumber: 3,
                        totalThoughts: 3,
                    }],
                    tokensUsed: 50,
                    shouldProceedToAction: true,
                    summary: 'Analysis complete. Ready for action.'
                }
            ];

            const thinkingSpy = vi.spyOn(thinkingModule, 'performThinkingPhase')
                .mockResolvedValueOnce(mockThinkingResults[0])
                .mockResolvedValueOnce(mockThinkingResults[1])
                .mockResolvedValueOnce(mockThinkingResults[2]);

            // Start agent
            const startPromise = agent.start('Test task: multi-round analysis then act');

            // Wait for agent to complete (with timeout)
            await Promise.race([
                startPromise,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Agent start timed out')), 5000)
                )
            ]);

            // Verify thinking phase was called 3 times
            expect(thinkingSpy).toHaveBeenCalledTimes(3);

            // Verify agent completed
            expect(agent.status).toBe('completed');

            // Verify tool was called (action phase was entered)
            expect(testComponent.getLastAction()).toBe('test_action');

            thinkingSpy.mockRestore();
        });
    });

    describe('Action Phase Entry', () => {
        it('should execute tool calls after thinking phase completes', async () => {
            // Mock thinking result with summary
            const mockThinkingResult = {
                rounds: [{
                    roundNumber: 1,
                    content: 'Ready to act',
                    continueThinking: false,
                    recalledContexts: [],
                    tokens: 50,
                    summary: 'Ready to execute action.',
                    thoughtNumber: 1,
                    totalThoughts: 1,
                }],
                tokensUsed: 50,
                shouldProceedToAction: true,
                summary: 'Ready to execute action.'
            };

            const thinkingSpy = vi.spyOn(thinkingModule, 'performThinkingPhase')
                .mockResolvedValue(mockThinkingResult);

            // Start agent
            await Promise.race([
                agent.start('Test task: execute action'),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Agent start timed out')), 5000)
                )
            ]);

            // Verify action was executed
            expect(testComponent.getLastAction()).toBe('test_action');

            thinkingSpy.mockRestore();
        });

        it('should update workspace state after action phase', async () => {
            // Mock thinking result
            const mockThinkingResult = {
                rounds: [{
                    roundNumber: 1,
                    content: 'Execute action',
                    continueThinking: false,
                    recalledContexts: [],
                    tokens: 50,
                    summary: 'Execute action.',
                    thoughtNumber: 1,
                    totalThoughts: 1,
                }],
                tokensUsed: 50,
                shouldProceedToAction: true,
                summary: 'Execute action.'
            };

            const thinkingSpy = vi.spyOn(thinkingModule, 'performThinkingPhase')
                .mockResolvedValue(mockThinkingResult);

            // Start agent
            await Promise.race([
                agent.start('Test task: update workspace'),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Agent start timed out')), 5000)
                )
            ]);

            // Verify workspace was updated
            const workspaceRender = await workspace.render();
            expect(workspaceRender).toContain('Last Action: test_action');

            thinkingSpy.mockRestore();
        });

        it('should handle attempt_completion tool to exit action phase', async () => {
            // Create API client that returns attempt_completion
            const mockApiClientWithCompletion = createMockApiClientWithToolCalls([
                {
                    id: 'completion_call',
                    call_id: 'completion_call_id',
                    type: 'function_call',
                    name: 'attempt_completion',
                    arguments: JSON.stringify({ result: 'Task completed successfully' })
                }
            ]);

            // Create new agent with completion API client
            const turnStore = new TurnMemoryStore();
            const newThinkingModule = new ThinkingModule(mockApiClient, mockLogger, {}, turnStore);
            const newMemoryModule = new MemoryModule(mockLogger, {}, turnStore, newThinkingModule);
            const newTaskModule = new TaskModule();

            const completionAgent = new Agent(
                agentConfig,
                workspace,
                agentPrompt,
                mockApiClientWithCompletion,
                newMemoryModule,
                newThinkingModule,
                newTaskModule,
                mockLogger as any
            );

            // Mock thinking result
            const mockThinkingResult = {
                rounds: [{
                    roundNumber: 1,
                    content: 'Complete task',
                    continueThinking: false,
                    recalledContexts: [],
                    tokens: 50,
                    summary: 'Complete task.',
                    thoughtNumber: 1,
                    totalThoughts: 1,
                }],
                tokensUsed: 50,
                shouldProceedToAction: true,
                summary: 'Complete task.'
            };

            const thinkingSpy = vi.spyOn(newThinkingModule, 'performThinkingPhase')
                .mockResolvedValue(mockThinkingResult);

            // Start agent
            await Promise.race([
                completionAgent.start('Test task: complete with result'),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Agent start timed out')), 5000)
                )
            ]);

            // Verify agent completed
            expect(completionAgent.status).toBe('completed');

            thinkingSpy.mockRestore();
        });
    });

    describe('Thinking-Action Cycle', () => {
        it('should support multiple thinking-action cycles in a single task', async () => {
            let callCount = 0;

            // Mock API client to return different tool calls based on call count
            const mockApiClientForCycle: ApiClient = {
                makeRequest: vi.fn().mockImplementation(() => {
                    callCount++;
                    if (callCount === 1) {
                        // First action: test_action_tool
                        return Promise.resolve({
                            toolCalls: [{
                                id: 'tool_call_1',
                                call_id: 'call_1',
                                type: 'function_call',
                                name: 'test_action_tool',
                                arguments: JSON.stringify({ action: 'first_action' })
                            }],
                            textResponse: null,
                            requestTime: 100,
                            tokenUsage: {
                                promptTokens: 100,
                                completionTokens: 50,
                                totalTokens: 150
                            }
                        });
                    } else {
                        // Second action: attempt_completion
                        return Promise.resolve({
                            toolCalls: [{
                                id: 'completion_call',
                                call_id: 'completion_call_id',
                                type: 'function_call',
                                name: 'attempt_completion',
                                arguments: JSON.stringify({ result: 'Task completed after multiple cycles' })
                            }],
                            textResponse: null,
                            requestTime: 100,
                            tokenUsage: {
                                promptTokens: 100,
                                completionTokens: 50,
                                totalTokens: 150
                            }
                        });
                    }
                })
            };

            // Create new agent for cycle test
            const turnStore = new TurnMemoryStore();
            const newThinkingModule = new ThinkingModule(mockApiClient, mockLogger, {}, turnStore);
            const newMemoryModule = new MemoryModule(mockLogger, {}, turnStore, newThinkingModule);
            const newTaskModule = new TaskModule();

            const cycleAgent = new Agent(
                agentConfig,
                workspace,
                agentPrompt,
                mockApiClientForCycle,
                newMemoryModule,
                newThinkingModule,
                newTaskModule,
                mockLogger as any
            );

            // Mock thinking to return continueThinking: false for both cycles
            const mockThinkingResult = {
                rounds: [{
                    roundNumber: 1,
                    content: 'Execute action',
                    continueThinking: false,
                    recalledContexts: [],
                    tokens: 50,
                    summary: 'Execute action.',
                    thoughtNumber: 1,
                    totalThoughts: 1,
                }],
                tokensUsed: 50,
                shouldProceedToAction: true,
                summary: 'Execute action.'
            };

            const thinkingSpy = vi.spyOn(newThinkingModule, 'performThinkingPhase')
                .mockResolvedValue(mockThinkingResult);

            // Start agent
            await Promise.race([
                cycleAgent.start('Test task: multiple cycles'),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Agent start timed out')), 5000)
                )
            ]);

            // Verify agent completed
            expect(cycleAgent.status).toBe('completed');

            // Verify first action was executed
            expect(testComponent.getLastAction()).toBe('first_action');

            thinkingSpy.mockRestore();
        });
    });
});
