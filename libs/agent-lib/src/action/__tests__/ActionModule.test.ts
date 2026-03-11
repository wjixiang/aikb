/**
 * Unit tests for ActionModule
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Container } from 'inversify';
import { TYPES } from '../../di/types.js';
import { ActionModule } from '../ActionModule.js';
import type { IActionModule } from '../types.js';
import type { ApiClient } from '../../api-client/index.js';
import type { IToolManager } from '../../tools/index.js';
import type { ITurnMemoryStore } from '../../memory/TurnMemoryStore.interface.js';
import pino from 'pino';

describe('ActionModule', () => {
    let container: Container;
    let actionModule: IActionModule;
    let mockApiClient: ApiClient;
    let mockToolManager: IToolManager;
    let mockTurnMemoryStore: ITurnMemoryStore;
    let mockLogger: any;

    beforeEach(() => {
        // Create container
        container = new Container();

        // Create mock logger
        mockLogger = pino({ level: 'silent' });

        // Create mock ApiClient
        mockApiClient = {
            makeRequest: vi.fn(),
        } as any;

        // Create mock ToolManager
        mockToolManager = {
            executeTool: vi.fn(),
        } as any;

        // Create mock TurnMemoryStore
        mockTurnMemoryStore = {
            getTurnByNumber: vi.fn(),
            getRecentMessages: vi.fn(),
            getAllMessages: vi.fn(),
        } as any;

        // Bind dependencies
        container.bind(TYPES.Logger).toConstantValue(mockLogger);
        container.bind(TYPES.ApiClient).toConstantValue(mockApiClient);
        container.bind(TYPES.IToolManager).toConstantValue(mockToolManager);
        container.bind(TYPES.ITurnMemoryStore).toConstantValue(mockTurnMemoryStore);
        container.bind(TYPES.MemoryModuleConfig).toConstantValue({
            enableRecall: true,
            maxRecallContexts: 3,
            maxRecalledMessages: 20,
        });
        container.bind(TYPES.IActionModule).to(ActionModule);

        // Resolve ActionModule
        actionModule = container.get<IActionModule>(TYPES.IActionModule);
    });

    describe('getConfig', () => {
        it('should return current configuration', () => {
            const config = actionModule.getConfig();

            expect(config).toBeDefined();
            expect(config.apiRequestTimeout).toBe(60000);
            expect(config.maxToolRetryAttempts).toBe(3);
            expect(config.enableParallelExecution).toBe(true);
        });
    });

    describe('updateConfig', () => {
        it('should update configuration', () => {
            actionModule.updateConfig({
                apiRequestTimeout: 120000,
                enableParallelExecution: true,
            });

            const config = actionModule.getConfig();

            expect(config.apiRequestTimeout).toBe(120000);
            expect(config.maxToolRetryAttempts).toBe(3); // unchanged
            expect(config.enableParallelExecution).toBe(true);
        });
    });

    describe('performActionPhase', () => {
        it('should make API request and execute tool calls', async () => {
            // Mock API response
            const mockApiResponse = {
                toolCalls: [
                    {
                        id: 'test-tool-1',
                        call_id: 'call-1',
                        type: 'function_call' as const,
                        name: 'test_tool',
                        arguments: JSON.stringify({ param: 'value' }),
                    },
                ],
                textResponse: 'Test response',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 100,
                    completionTokens: 50,
                    totalTokens: 150,
                },
            };

            vi.mocked(mockApiClient.makeRequest).mockResolvedValue(mockApiResponse);

            // Mock tool execution
            vi.mocked(mockToolManager.executeTool).mockResolvedValue({
                success: true,
                result: 'tool result',
            });

            // Mock conversation history
            const conversationHistory: any[] = [];

            // Mock tools
            const tools: any[] = [];

            // Perform action phase
            const result = await actionModule.performActionPhase(
                'test workspace context',
                'test system prompt',
                conversationHistory,
                tools,
                () => false
            );

            // Verify API request was made
            expect(mockApiClient.makeRequest).toHaveBeenCalled();

            // Verify result structure
            expect(result.apiResponse).toEqual(mockApiResponse);
            expect(result.toolResults).toHaveLength(1);
            expect(result.toolResults[0].toolName).toBe('test_tool');
            expect(result.toolResults[0].success).toBe(true);
            expect(result.assistantMessage).toBeDefined();
            expect(result.assistantMessage.role).toBe('assistant');
            expect(result.tokensUsed).toBe(150);
            expect(result.didAttemptCompletion).toBe(false);
        });

        it('should handle attempt_completion tool', async () => {
            // Mock API response with attempt_completion
            const mockApiResponse = {
                toolCalls: [
                    {
                        id: 'completion-1',
                        call_id: 'call-1',
                        type: 'function_call' as const,
                        name: 'attempt_completion',
                        arguments: JSON.stringify({ result: 'Task completed successfully' }),
                    },
                ],
                textResponse: '',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 100,
                    completionTokens: 50,
                    totalTokens: 150,
                },
            };

            vi.mocked(mockApiClient.makeRequest).mockResolvedValue(mockApiResponse);

            // Perform action phase
            const result = await actionModule.performActionPhase(
                'test workspace context',
                'test system prompt',
                [],
                [],
                () => false
            );

            // Verify completion was detected
            expect(result.didAttemptCompletion).toBe(true);
            expect(result.toolResults[0].result).toEqual({
                success: true,
                result: 'Task completed successfully',
            });
        });

        it('should handle tool execution errors', async () => {
            // Mock API response
            const mockApiResponse = {
                toolCalls: [
                    {
                        id: 'test-tool-1',
                        call_id: 'call-1',
                        type: 'function_call' as const,
                        name: 'failing_tool',
                        arguments: '{}',
                    },
                ],
                textResponse: '',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 100,
                    completionTokens: 50,
                    totalTokens: 150,
                },
            };

            vi.mocked(mockApiClient.makeRequest).mockResolvedValue(mockApiResponse);

            // Mock tool execution error
            vi.mocked(mockToolManager.executeTool).mockRejectedValue(
                new Error('Tool execution failed')
            );

            // Perform action phase
            const result = await actionModule.performActionPhase(
                'test workspace context',
                'test system prompt',
                [],
                [],
                () => false
            );

            // Verify error was handled
            expect(result.toolResults[0].success).toBe(false);
            expect(result.toolResults[0].result).toContain('Tool execution failed');
        });

        it('should stop execution when aborted', async () => {
            // Mock API response with multiple tools
            const mockApiResponse = {
                toolCalls: [
                    {
                        id: 'tool-1',
                        call_id: 'call-1',
                        type: 'function_call' as const,
                        name: 'tool1',
                        arguments: '{}',
                    },
                    {
                        id: 'tool-2',
                        call_id: 'call-2',
                        type: 'function_call' as const,
                        name: 'tool2',
                        arguments: '{}',
                    },
                ],
                textResponse: '',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 100,
                    completionTokens: 50,
                    totalTokens: 150,
                },
            };

            vi.mocked(mockApiClient.makeRequest).mockResolvedValue(mockApiResponse);

            // Mock tool manager to delay execution
            let toolCallCount = 0;
            vi.mocked(mockToolManager.executeTool).mockImplementation(async () => {
                toolCallCount++;
                if (toolCallCount === 2) {
                    // Second tool call - abort
                    throw new Error('Aborted');
                }
                return { success: true, result: 'ok' };
            });

            // Perform action phase with abort callback
            const result = await actionModule.performActionPhase(
                'test workspace context',
                'test system prompt',
                [],
                [],
                () => toolCallCount >= 1 // Abort after first tool
            );

            // Verify only first tool was executed
            expect(result.toolResults).toHaveLength(1);
            expect(result.toolResults[0].toolName).toBe('tool1');
        });
    });

    describe('tool usage tracking', () => {
        it('should track tool usage statistics', async () => {
            // Mock API response with multiple tool calls
            const mockApiResponse = {
                toolCalls: [
                    {
                        id: 'tool-1',
                        call_id: 'call-1',
                        type: 'function_call' as const,
                        name: 'successful_tool',
                        arguments: '{}',
                    },
                    {
                        id: 'tool-2',
                        call_id: 'call-2',
                        type: 'function_call' as const,
                        name: 'successful_tool',
                        arguments: '{}',
                    },
                    {
                        id: 'tool-3',
                        call_id: 'call-3',
                        type: 'function_call' as const,
                        name: 'failing_tool',
                        arguments: '{}',
                    },
                ],
                textResponse: '',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 100,
                    completionTokens: 50,
                    totalTokens: 150,
                },
            };

            vi.mocked(mockApiClient.makeRequest).mockResolvedValue(mockApiResponse);

            // Mock tool executions
            vi.mocked(mockToolManager.executeTool).mockImplementation(async (name) => {
                if (name === 'failing_tool') {
                    throw new Error('Failed');
                }
                return { success: true, result: 'ok' };
            });

            // Perform action phase
            const result = await actionModule.performActionPhase(
                'test workspace context',
                'test system prompt',
                [],
                [],
                () => false
            );

            // Verify tool usage statistics
            expect(result.toolUsage['successful_tool']).toEqual({
                attempts: 2,
                failures: 0,
            });
            expect(result.toolUsage['failing_tool']).toEqual({
                attempts: 1,
                failures: 1,
            });
        });
    });
});
