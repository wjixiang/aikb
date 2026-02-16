import { describe, it, expect, vi } from 'vitest';
import { Agent } from '../agent';
import { VirtualWorkspace } from 'stateful-context';
import { ApiClient, ApiResponse, ToolCall } from '../../api-client/ApiClient.interface';
import { z } from 'zod';

describe('Agent Tool Coordination', () => {
    describe('convertWorkspaceToolsToOpenAI', () => {
        it('should convert workspace tools to OpenAI format', async () => {
            // Create a mock workspace with tools
            const workspace = new VirtualWorkspace({
                id: 'test-workspace',
                name: 'Test Workspace',
            });

            // Create a mock tool component
            const mockComponent = {
                toolSet: new Map([
                    ['test_tool', {
                        toolName: 'test_tool',
                        desc: 'A test tool',
                        paramsSchema: z.object({
                            param1: z.string(),
                        }),
                    }],
                ]),
                render: async () => ({
                    render: () => '',
                    renderWithWidth: () => ({ content: '', width: 0, height: 0 }),
                }),
                renderToolSection: () => ({
                    render: () => '',
                    renderWithWidth: () => ({ content: '', width: 0, height: 0 }),
                }),
                handleToolCall: async () => ({ success: true }),
            };

            workspace.registerComponent({
                key: 'test-component',
                component: mockComponent as any,
                priority: 1,
            });

            // Create mock API client
            const mockApiClient: ApiClient = {
                makeRequest: vi.fn().mockResolvedValue({
                    toolCalls: [],
                    textResponse: '',
                    requestTime: 0,
                    tokenUsage: {
                        promptTokens: 0,
                        completionTokens: 0,
                        totalTokens: 0,
                    },
                } as ApiResponse),
            };

            // Create agent
            const agent = new Agent(
                {
                    apiRequestTimeout: 5000,
                    maxRetryAttempts: 3,
                    consecutiveMistakeLimit: 3,
                },
                workspace,
                {
                    capability: 'Test capability',
                    direction: 'Test direction',
                },
                mockApiClient
            );

            // Access private method for testing
            const convertMethod = (agent as any).convertWorkspaceToolsToOpenAI.bind(agent);
            const openaiTools = convertMethod();

            // Verify conversion
            expect(openaiTools).toHaveLength(1);
            expect(openaiTools[0]).toHaveProperty('type', 'function');
            expect(openaiTools[0]).toHaveProperty('function');
            expect(openaiTools[0].function).toHaveProperty('name', 'test_tool');
            expect(openaiTools[0].function).toHaveProperty('description', 'A test tool');
            expect(openaiTools[0].function).toHaveProperty('parameters');
        });

        it('should handle empty workspace', () => {
            const workspace = new VirtualWorkspace({
                id: 'empty-workspace',
                name: 'Empty Workspace',
            });

            // Create mock API client
            const mockApiClient: ApiClient = {
                makeRequest: vi.fn().mockResolvedValue({
                    toolCalls: [],
                    textResponse: '',
                    requestTime: 0,
                    tokenUsage: {
                        promptTokens: 0,
                        completionTokens: 0,
                        totalTokens: 0,
                    },
                } as ApiResponse),
            };

            const agent = new Agent(
                {
                    apiRequestTimeout: 5000,
                    maxRetryAttempts: 3,
                    consecutiveMistakeLimit: 3,
                },
                workspace,
                {
                    capability: 'Test capability',
                    direction: 'Test direction',
                },
                mockApiClient
            );

            const convertMethod = (agent as any).convertWorkspaceToolsToOpenAI.bind(agent);
            const openaiTools = convertMethod();

            expect(openaiTools).toHaveLength(0);
        });
    });

    describe('attemptApiRequest with tools', () => {
        it('should pass tools to API client', async () => {
            // Create mock workspace
            const workspace = new VirtualWorkspace({
                id: 'test-workspace',
                name: 'Test Workspace',
            });

            // Create mock API client
            const mockApiClient: ApiClient = {
                makeRequest: vi.fn().mockResolvedValue({
                    toolCalls: [
                        {
                            id: 'fc_test',
                            call_id: 'call_test',
                            type: 'function_call',
                            name: 'attempt_completion',
                            arguments: JSON.stringify({ result: 'Test completed' }),
                        },
                    ],
                    textResponse: '',
                    requestTime: 1000,
                    tokenUsage: {
                        promptTokens: 50,
                        completionTokens: 20,
                        totalTokens: 70,
                    },
                } as ApiResponse),
            };

            // Create agent with mock API client
            const agent = new Agent(
                {
                    apiRequestTimeout: 5000,
                    maxRetryAttempts: 3,
                    consecutiveMistakeLimit: 3,
                },
                workspace,
                {
                    capability: 'Test capability',
                    direction: 'Test direction',
                },
                mockApiClient
            );

            // Call attemptApiRequest
            await agent.attemptApiRequest();

            // Verify that makeRequest was called with tools parameter
            expect(mockApiClient.makeRequest).toHaveBeenCalled();
            const callArgs = (mockApiClient.makeRequest as any).mock.calls[0];

            // Check that tools parameter was passed (5th parameter)
            expect(callArgs).toHaveLength(5);
            expect(Array.isArray(callArgs[4])).toBe(true); // tools should be an array
        });

        it('should convert workspace tools before passing to API client', async () => {
            // Create workspace with a tool
            const workspace = new VirtualWorkspace({
                id: 'test-workspace',
                name: 'Test Workspace',
            });

            const mockComponent = {
                toolSet: new Map([
                    ['search_tool', {
                        toolName: 'search_tool',
                        desc: 'Search for information',
                        paramsSchema: z.object({
                            query: z.string(),
                        }),
                    }],
                ]),
                render: async () => ({ render: () => '' }),
                renderToolSection: () => ({ render: () => '' }),
                handleToolCall: async () => ({ success: true }),
            };

            workspace.registerComponent({
                key: 'search-component',
                component: mockComponent as any,
                priority: 1,
            });

            // Create mock API client
            const mockApiClient: ApiClient = {
                makeRequest: vi.fn().mockResolvedValue({
                    toolCalls: [
                        {
                            id: 'fc_test',
                            call_id: 'call_test',
                            type: 'function_call',
                            name: 'attempt_completion',
                            arguments: JSON.stringify({ result: 'Test completed' }),
                        },
                    ],
                    textResponse: '',
                    requestTime: 1000,
                    tokenUsage: {
                        promptTokens: 50,
                        completionTokens: 20,
                        totalTokens: 70,
                    },
                } as ApiResponse),
            };

            // Create agent
            const agent = new Agent(
                {
                    apiRequestTimeout: 5000,
                    maxRetryAttempts: 3,
                    consecutiveMistakeLimit: 3,
                },
                workspace,
                {
                    capability: 'Test capability',
                    direction: 'Test direction',
                },
                mockApiClient
            );

            // Call attemptApiRequest
            await agent.attemptApiRequest();

            // Verify tools were passed
            const callArgs = (mockApiClient.makeRequest as any).mock.calls[0];
            const tools = callArgs[4];

            expect(tools).toHaveLength(1);
            expect(tools[0].function.name).toBe('search_tool');
            expect(tools[0].function.description).toBe('Search for information');
        });
    });

    describe('Integration with ApiClient', () => {
        it('should work end-to-end with tool passing', async () => {
            // This test verifies the complete flow:
            // Workspace -> Agent -> ApiClient with tools

            const workspace = new VirtualWorkspace({
                id: 'integration-workspace',
                name: 'Integration Test Workspace',
            });

            const mockComponent = {
                toolSet: new Map([
                    ['calculate', {
                        toolName: 'calculate',
                        desc: 'Perform calculation',
                        paramsSchema: z.object({
                            expression: z.string(),
                        }),
                    }],
                ]),
                render: async () => ({ render: () => '' }),
                renderToolSection: () => ({ render: () => '' }),
                handleToolCall: async () => ({ success: true }),
            };

            workspace.registerComponent({
                key: 'calc-component',
                component: mockComponent as any,
                priority: 1,
            });

            let capturedTools: any[] = [];

            const mockApiClient: ApiClient = {
                makeRequest: vi.fn().mockImplementation(async (
                    systemPrompt,
                    workspaceContext,
                    memoryContext,
                    timeoutConfig,
                    tools
                ) => {
                    // Capture tools for verification
                    capturedTools = tools || [];

                    return {
                        toolCalls: [
                            {
                                id: 'fc_calc',
                                call_id: 'call_calc',
                                type: 'function_call',
                                name: 'calculate',
                                arguments: JSON.stringify({ expression: '2+2' }),
                            },
                        ],
                        textResponse: '',
                        requestTime: 800,
                        tokenUsage: {
                            promptTokens: 30,
                            completionTokens: 15,
                            totalTokens: 45,
                        },
                    } as ApiResponse;
                }),
            };

            const agent = new Agent(
                {
                    apiRequestTimeout: 5000,
                    maxRetryAttempts: 3,
                    consecutiveMistakeLimit: 3,
                },
                workspace,
                {
                    capability: 'Test capability',
                    direction: 'Test direction',
                },
                mockApiClient
            );

            await agent.attemptApiRequest();

            // Verify tools were captured
            expect(capturedTools).toHaveLength(1);
            expect(capturedTools[0].function.name).toBe('calculate');
            expect(capturedTools[0].type).toBe('function');
        });
    });
});
