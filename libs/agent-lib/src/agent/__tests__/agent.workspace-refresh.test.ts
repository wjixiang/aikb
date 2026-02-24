import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent, AgentConfig, AgentPrompt } from '../agent.js';
import { VirtualWorkspace } from '../../statefulContext/index.js';
import { ToolComponent } from '../../statefulContext/index.js';
import { Tool } from '../../statefulContext/index.js';
import { tdiv } from '../../statefulContext/index.js';
import * as z from 'zod';
import type { ApiClient, ToolCall } from '../../api-client/index.js';
import { MemoryModule } from '../../memory/MemoryModule.js';
import { TurnMemoryStore } from '../../memory/TurnMemoryStore.js';
import type { Logger } from 'pino';
import { ThinkingModule } from '../../thinking/ThinkingModule.js';
import { TaskModule } from '../../task/TaskModule.js';
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

/**
 * Test component that tracks tool calls and renders state
 */
class StatefulTestComponent extends ToolComponent {
    toolSet = new Map<string, Tool>([
        ['update_state', {
            toolName: 'update_state',
            desc: 'Update the component state with a message',
            paramsSchema: z.object({ message: z.string() })
        }],
        ['increment_counter', {
            toolName: 'increment_counter',
            desc: 'Increment a counter',
            paramsSchema: z.object({ amount: z.number().optional().default(1) })
        }]
    ]);

    private stateMessage = 'Initial State';
    private counter = 0;
    private renderCallCount = 0;

    renderImply = async (): Promise<tdiv[]> => {
        this.renderCallCount++;
        return [
            new tdiv({
                content: `Message: ${this.stateMessage}`,
                styles: { width: 80, showBorder: false }
            }),
            new tdiv({
                content: `Counter: ${this.counter}`,
                styles: { width: 80, showBorder: false }
            }),
            new tdiv({
                content: `Render Count: ${this.renderCallCount}`,
                styles: { width: 80, showBorder: false }
            })
        ];
    };

    handleToolCall = async (toolName: string, params: any): Promise<void> => {
        if (toolName === 'update_state') {
            this.stateMessage = params.message;
        } else if (toolName === 'increment_counter') {
            this.counter += params.amount || 1;
        }
    };

    getStateMessage(): string {
        return this.stateMessage;
    }

    getCounter(): number {
        return this.counter;
    }

    getRenderCallCount(): number {
        return this.renderCallCount;
    }

    resetRenderCallCount(): void {
        this.renderCallCount = 0;
    }
}

describe('Agent Workspace Refresh After Tool Calls', () => {
    let agent: Agent;
    let workspace: VirtualWorkspace;
    let testComponent: StatefulTestComponent;
    let memoryModule: MemoryModule;
    let thinkingModule: ThinkingModule;
    let taskModule: TaskModule;

    const agentPrompt: AgentPrompt = {
        capability: 'Test agent capability',
        direction: 'Test agent direction'
    };

    const agentConfig: AgentConfig = {
        apiRequestTimeout: 40000,
        maxRetryAttempts: 3,
        consecutiveMistakeLimit: 5
    };

    beforeEach(() => {
        // Create a new workspace for each test
        const toolManager = new ToolManager();
        workspace = new VirtualWorkspace({
            id: 'test-workspace',
            name: 'Test Workspace',
            description: 'A workspace for testing workspace refresh after tool calls'
        }, toolManager);

        // Create and register test component
        testComponent = new StatefulTestComponent();
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

        // Create agent
        agent = new Agent(
            agentConfig,
            workspace,
            agentPrompt,
            mockApiClient as ApiClient,
            memoryModule,
            thinkingModule,
            taskModule
        );
    });

    describe('Workspace State Updates', () => {
        it('should update workspace state after tool call execution', async () => {
            // Mock the API client to return a tool call then completion
            const mockAgentApi = {
                makeRequest: vi.fn()
                    .mockResolvedValueOnce({
                        toolCalls: [{
                            id: 'tool_call_1',
                            call_id: 'call_1',
                            type: 'function_call',
                            name: 'update_state',
                            arguments: JSON.stringify({ message: 'Updated State' })
                        }],
                        textResponse: null,
                        requestTime: 100,
                        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
                    })
                    .mockResolvedValueOnce({
                        toolCalls: [{
                            id: 'completion_call',
                            call_id: 'completion_call_id',
                            type: 'function_call',
                            name: 'attempt_completion',
                            arguments: JSON.stringify({ result: 'Task completed' })
                        }],
                        textResponse: null,
                        requestTime: 100,
                        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
                    })
            };

            const agentWithMock = new Agent(
                agentConfig,
                workspace,
                agentPrompt,
                mockAgentApi,
                memoryModule,
                thinkingModule,
                taskModule
            );

            // Start agent
            await agentWithMock.start('Test task: update state');

            // Verify component state was updated
            expect(testComponent.getStateMessage()).toBe('Updated State');

            // Verify workspace render includes updated state
            const workspaceContext = await workspace.render();
            expect(workspaceContext).toContain('Updated State');
        });

        it('should handle multiple tool calls and update state incrementally', async () => {
            // Mock API to return multiple tool calls in sequence
            const mockAgentApi = {
                makeRequest: vi.fn()
                    .mockResolvedValueOnce({
                        toolCalls: [{
                            id: 'tool_call_1',
                            call_id: 'call_1',
                            type: 'function_call',
                            name: 'update_state',
                            arguments: JSON.stringify({ message: 'First Update' })
                        }],
                        textResponse: null,
                        requestTime: 100,
                        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
                    })
                    .mockResolvedValueOnce({
                        toolCalls: [{
                            id: 'tool_call_2',
                            call_id: 'call_2',
                            type: 'function_call',
                            name: 'increment_counter',
                            arguments: JSON.stringify({ amount: 5 })
                        }],
                        textResponse: null,
                        requestTime: 100,
                        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
                    })
                    .mockResolvedValueOnce({
                        toolCalls: [{
                            id: 'completion_call',
                            call_id: 'completion_call_id',
                            type: 'function_call',
                            name: 'attempt_completion',
                            arguments: JSON.stringify({ result: 'Done' })
                        }],
                        textResponse: null,
                        requestTime: 100,
                        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
                    })
            };

            const agentWithMock = new Agent(
                agentConfig,
                workspace,
                agentPrompt,
                mockAgentApi,
                memoryModule,
                thinkingModule,
                taskModule
            );

            // Start agent
            await agentWithMock.start('Test task: multiple updates');

            // Verify both tool calls were executed
            expect(testComponent.getStateMessage()).toBe('First Update');
            expect(testComponent.getCounter()).toBe(5);

            // Verify workspace render includes both updates
            const workspaceContext = await workspace.render();
            expect(workspaceContext).toContain('First Update');
            expect(workspaceContext).toContain('Counter: 5');
        });
    });

    describe('Workspace Render Refresh', () => {
        it('should call renderImply after tool execution', async () => {
            testComponent.resetRenderCallCount();

            const mockAgentApi = {
                makeRequest: vi.fn()
                    .mockResolvedValueOnce({
                        toolCalls: [{
                            id: 'tool_call_1',
                            call_id: 'call_1',
                            type: 'function_call',
                            name: 'increment_counter',
                            arguments: JSON.stringify({ amount: 3 })
                        }],
                        textResponse: null,
                        requestTime: 100,
                        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
                    })
                    .mockResolvedValueOnce({
                        toolCalls: [{
                            id: 'completion_call',
                            call_id: 'completion_call_id',
                            type: 'function_call',
                            name: 'attempt_completion',
                            arguments: JSON.stringify({ result: 'Done' })
                        }],
                        textResponse: null,
                        requestTime: 100,
                        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
                    })
            };

            const agentWithMock = new Agent(
                agentConfig,
                workspace,
                agentPrompt,
                mockAgentApi,
                memoryModule,
                thinkingModule,
                taskModule
            );

            // Start agent
            await agentWithMock.start('Test task: increment counter');

            // Verify renderImply was called after tool execution
            expect(testComponent.getRenderCallCount()).toBeGreaterThan(0);

            // Verify the rendered content reflects the updated state
            const workspaceContext = await workspace.render();
            expect(workspaceContext).toContain('Counter: 3');
        });
    });

    describe('Workspace Context in API Requests', () => {
        it('should reflect component state changes in workspace context', async () => {
            const workspaceContexts: string[] = [];

            const mockAgentApi = {
                makeRequest: vi.fn()
                    .mockImplementationOnce(async (systemPrompt, workspaceContext, memoryContext, options, tools) => {
                        workspaceContexts.push(workspaceContext);
                        return {
                            toolCalls: [{
                                id: 'tool_call_1',
                                call_id: 'call_1',
                                type: 'function_call',
                                name: 'update_state',
                                arguments: JSON.stringify({ message: 'After First Tool Call' })
                            }],
                            textResponse: null,
                            requestTime: 100,
                            tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
                        };
                    })
                    .mockImplementationOnce(async (systemPrompt, workspaceContext, memoryContext, options, tools) => {
                        workspaceContexts.push(workspaceContext);
                        return {
                            toolCalls: [{
                                id: 'completion_call',
                                call_id: 'completion_call_id',
                                type: 'function_call',
                                name: 'attempt_completion',
                                arguments: JSON.stringify({ result: 'Done' })
                            }],
                            textResponse: null,
                            requestTime: 100,
                            tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
                        };
                    })
            };

            const agentWithMock = new Agent(
                agentConfig,
                workspace,
                agentPrompt,
                mockAgentApi,
                memoryModule,
                thinkingModule,
                taskModule
            );

            // Start agent
            await agentWithMock.start('Test task: verify state propagation');

            // Verify we got 2 API calls
            expect(workspaceContexts.length).toBe(2);

            // First context should have initial state
            expect(workspaceContexts[0]).toContain('Initial State');

            // Second context should have updated state
            expect(workspaceContexts[1]).toContain('After First Tool Call');
        });
    });

    describe('Error Handling', () => {
        it('should continue processing even if one tool call fails', async () => {
            const mockAgentApi = {
                makeRequest: vi.fn()
                    .mockResolvedValueOnce({
                        toolCalls: [{
                            id: 'tool_call_1',
                            call_id: 'call_1',
                            type: 'function_call',
                            name: 'update_state',
                            arguments: JSON.stringify({ message: 'First Success' })
                        }],
                        textResponse: null,
                        requestTime: 100,
                        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
                    })
                    .mockResolvedValueOnce({
                        toolCalls: [{
                            id: 'tool_call_2',
                            call_id: 'call_2',
                            type: 'function_call',
                            name: 'nonexistent_tool',
                            arguments: JSON.stringify({})
                        }],
                        textResponse: null,
                        requestTime: 100,
                        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
                    })
                    .mockResolvedValueOnce({
                        toolCalls: [{
                            id: 'completion_call',
                            call_id: 'completion_call_id',
                            type: 'function_call',
                            name: 'attempt_completion',
                            arguments: JSON.stringify({ result: 'Done despite error' })
                        }],
                        textResponse: null,
                        requestTime: 100,
                        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
                    })
            };

            const agentWithMock = new Agent(
                agentConfig,
                workspace,
                agentPrompt,
                mockAgentApi,
                memoryModule,
                thinkingModule,
                taskModule
            );

            // Start agent - should handle the error and continue
            await agentWithMock.start('Test task: error handling');

            // Verify first tool call succeeded
            expect(testComponent.getStateMessage()).toBe('First Success');

            // Agent should have completed despite the error
            expect(agentWithMock.status).toBe('completed');
        });
    });
});
