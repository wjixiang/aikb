/**
 * Unit tests for ActionModule tool validation
 * Tests that tools are properly validated before being passed to API client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Container } from 'inversify';
import { TYPES } from '../../di/types.js';
import { ActionModule } from '../ActionModule.js';
import type { IActionModule } from '../types.js';
import type { ApiClient } from '../../api-client/index.js';
import type { IToolManager } from '../../tools/index.js';
import type { ITurnMemoryStore } from '../../memory/TurnMemoryStore.interface.js';
import type { ChatCompletionTool } from '../../api-client/index.js';
import { ValidationError } from '../../api-client/errors.js';
import pino from 'pino';
import { z } from 'zod';

describe('ActionModule - Tool Validation', () => {
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

    describe('Tool format validation', () => {
        it('should accept valid ChatCompletionTool with type "function"', async () => {
            const validTool: ChatCompletionTool = {
                type: 'function',
                function: {
                    name: 'test_tool',
                    description: 'A test tool',
                    parameters: {
                        type: 'object',
                        properties: {
                            param: { type: 'string' },
                        },
                    },
                },
            };

            // Mock successful API response
            vi.mocked(mockApiClient.makeRequest).mockResolvedValue({
                toolCalls: [],
                textResponse: 'Test response',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 100,
                    completionTokens: 50,
                    totalTokens: 150,
                },
            });

            // This should not throw
            await expect(
                actionModule.performActionPhase(
                    'test workspace context',
                    'test system prompt',
                    [],
                    [validTool],
                    () => false
                )
            ).resolves.toBeDefined();
        });

        it('should reject tool without type field', async () => {
            const invalidTool = {
                function: {
                    name: 'test_tool',
                    description: 'A test tool',
                },
            } as any; // Missing type field

            // Mock API client to throw ValidationError
            vi.mocked(mockApiClient.makeRequest).mockRejectedValue(
                new ValidationError('Tool at index 0 has invalid type', 'tools[0].type')
            );

            await expect(
                actionModule.performActionPhase(
                    'test workspace context',
                    'test system prompt',
                    [],
                    [invalidTool],
                    () => false
                )
            ).rejects.toThrow(ValidationError);
        });

        it('should reject tool with invalid type', async () => {
            const invalidTool = {
                type: 'invalid_type',
                function: {
                    name: 'test_tool',
                },
            } as any;

            // Mock API client to throw ValidationError
            vi.mocked(mockApiClient.makeRequest).mockRejectedValue(
                new ValidationError('Tool at index 0 has invalid type', 'tools[0].type')
            );

            await expect(
                actionModule.performActionPhase(
                    'test workspace context',
                    'test system prompt',
                    [],
                    [invalidTool],
                    () => false
                )
            ).rejects.toThrow(ValidationError);
        });

        it('should reject raw Tool object (not converted to ChatCompletionTool)', async () => {
            // This simulates the bug where raw Tool objects are passed instead of ChatCompletionTool
            const rawTool = {
                toolName: 'test_tool',
                desc: 'A test tool',
                paramsSchema: z.object({
                    param: z.string(),
                }),
            } as any; // Raw Tool object - missing type field

            // Mock API client to throw ValidationError
            vi.mocked(mockApiClient.makeRequest).mockRejectedValue(
                new ValidationError('Tool at index 0 has invalid type', 'tools[0].type')
            );

            await expect(
                actionModule.performActionPhase(
                    'test workspace context',
                    'test system prompt',
                    [],
                    [rawTool],
                    () => false
                )
            ).rejects.toThrow(ValidationError);
        });

        it('should accept multiple valid tools', async () => {
            const validTools: ChatCompletionTool[] = [
                {
                    type: 'function',
                    function: {
                        name: 'tool1',
                        description: 'Tool 1',
                        parameters: {
                            type: 'object',
                            properties: {
                                param: { type: 'string' },
                            },
                        },
                    },
                },
                {
                    type: 'function',
                    function: {
                        name: 'tool2',
                        description: 'Tool 2',
                        parameters: {
                            type: 'object',
                            properties: {
                                num: { type: 'number' },
                            },
                        },
                    },
                },
            ];

            // Mock successful API response
            vi.mocked(mockApiClient.makeRequest).mockResolvedValue({
                toolCalls: [],
                textResponse: 'Test response',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 100,
                    completionTokens: 50,
                    totalTokens: 150,
                },
            });

            // This should not throw
            await expect(
                actionModule.performActionPhase(
                    'test workspace context',
                    'test system prompt',
                    [],
                    validTools,
                    () => false
                )
            ).resolves.toBeDefined();
        });

        it('should reject array with mixed valid and invalid tools', async () => {
            const mixedTools = [
                {
                    type: 'function',
                    function: {
                        name: 'valid_tool',
                        description: 'Valid tool',
                        parameters: {
                            type: 'object',
                            properties: {},
                        },
                    },
                },
                {
                    toolName: 'invalid_tool',
                    desc: 'Invalid raw tool',
                    paramsSchema: z.object({}),
                } as any, // Raw Tool object
            ];

            // Mock API client to throw ValidationError
            vi.mocked(mockApiClient.makeRequest).mockRejectedValue(
                new ValidationError('Tool at index 1 has invalid type', 'tools[1].type')
            );

            await expect(
                actionModule.performActionPhase(
                    'test workspace context',
                    'test system prompt',
                    [],
                    mixedTools,
                    () => false
                )
            ).rejects.toThrow(ValidationError);
        });
    });
});
