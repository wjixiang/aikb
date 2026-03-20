import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Agent } from '../agent.js';
import { AgentFactory } from '../AgentFactory.js';
import { VirtualWorkspace } from '../../statefulContext/virtualWorkspace.js';
import { ToolManager } from '../../tools/ToolManager.js';
import { ApiClient } from '../../api-client/index.js';
import { getGlobalContainer, resetGlobalContainer } from '../../di/container.js';
import { TYPES } from '../../di/types.js';
import { TestToolComponentA, TestToolComponentB, TestToolComponentC } from '../../statefulContext/__tests__/testComponents.js';
import type { AgentPrompt } from '../agent.js';

/**
 * Quick unit test for Agent with mocked ApiClient
 * Uses the native DI container (no test container creation)
 */
describe('Agent - Quick Integration Test', () => {
    let agent: Agent;
    let workspace: VirtualWorkspace;
    let container: ReturnType<typeof getGlobalContainer>;

    const agentPrompt: AgentPrompt = {
        capability: 'You are a helpful research assistant',
        direction: 'Help user with their research tasks'
    };

    beforeEach(() => {
        // Reset and get global container
        resetGlobalContainer();
        AgentFactory.resetContainer();
        container = getGlobalContainer();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should run agent with mocked ApiClient', async () => {
        // Create mock ApiClient with sequential responses
        const mockApiClient: ApiClient = {
            makeRequest: vi.fn()
                // First call: thinking phase - stop thinking
                .mockResolvedValueOnce({
                    textResponse: 'think step 1',
                    toolCalls: [{
                        id: 'call-1',
                        call_id: 'call-1',
                        type: 'function_call',
                        name: 'continue_thinking',
                        arguments: JSON.stringify({
                            continueThinking: false,
                            thoughtNumber: 1,
                            totalThoughts: 1,
                            summary: 'Task analyzed'
                        })
                    }],
                    requestTime: 100,
                    tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
                })
                // Second call: action phase - complete with attempt_completion
                .mockResolvedValueOnce({
                    textResponse: 'Task completed successfully',
                    toolCalls: [{
                        id: 'call-2',
                        call_id: 'call-2',
                        type: 'function_call',
                        name: 'attempt_completion',
                        arguments: JSON.stringify({
                            result: 'Task completed successfully'
                        })
                    }],
                    requestTime: 100,
                    tokenUsage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 }
                })
        };

        // Create workspace using default container
        const toolManager = new ToolManager();
        workspace = new VirtualWorkspace(
            {
                id: 'test-workspace',
                name: 'Test Workspace'
            },
            toolManager
        );

        // Create agent with mock ApiClient through mocks parameter
        agent = AgentFactory.create(
            workspace,
            agentPrompt,
            {},
            {
                ApiClient: mockApiClient
            }
        );

        // Run agent with timeout to prevent hanging
        const result = await Promise.race([
            agent.start('Help me with research'),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Agent start timed out')), 3000)
            )
        ]);

        // Verify API was called
        expect(mockApiClient.makeRequest).toHaveBeenCalled();
        expect(result).toBeDefined();
    }, 10000);

    it.skip('should handle tool execution with mocked ApiClient', async () => {
        // Mock ApiClient that returns tool call
        const mockApiClient: ApiClient = {
            makeRequest: vi.fn()
                // First call: thinking phase - stop thinking
                .mockResolvedValueOnce({
                    textResponse: 'Analysis complete',
                    toolCalls: [{
                        id: 'call-1',
                        call_id: 'call-1',
                        type: 'function_call',
                        name: 'continue_thinking',
                        arguments: JSON.stringify({
                            continueThinking: false,
                            thoughtNumber: 1,
                            totalThoughts: 1,
                            summary: 'Task analyzed'
                        })
                    }],
                    requestTime: 100,
                    tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
                })
                // Second call: action phase with tool call
                .mockResolvedValueOnce({
                    textResponse: 'I will search for information',
                    toolCalls: [{
                        id: 'call-search-1',
                        call_id: 'call-search-1',
                        type: 'function_call',
                        name: 'search',
                        arguments: JSON.stringify({
                            query: 'test query'
                        })
                    }],
                    requestTime: 100,
                    tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
                })
                // Third call: after tool execution - complete
                .mockResolvedValueOnce({
                    textResponse: 'Found the information',
                    toolCalls: [{
                        id: 'call-completion',
                        call_id: 'call-completion',
                        type: 'function_call',
                        name: 'attempt_completion',
                        arguments: JSON.stringify({ result: 'Task completed' })
                    }],
                    requestTime: 100,
                    tokenUsage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 }
                })
        };

        // Create workspace
        const toolManager = new ToolManager();
        workspace = new VirtualWorkspace(
            {
                id: 'test-workspace',
                name: 'Test Workspace with Tools'
            },
            toolManager
        );

        // Create agent
        agent = AgentFactory.create(
            workspace,
            agentPrompt,
            {},
            {
                ApiClient: mockApiClient
            }
        );

        // Run agent with timeout
        await Promise.race([
            agent.start('Search for information'),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Agent start timed out')), 3000)
            )
        ]);

        // Verify calls happened
        expect(mockApiClient.makeRequest).toHaveBeenCalled();
    }, 10000);

    it.skip('should handle skill activation with mocked ApiClient', async () => {
        // Mock ApiClient with get_skill tool call
        const mockApiClient: ApiClient = {
            makeRequest: vi.fn()
                // First call: action phase with get_skill
                .mockResolvedValueOnce({
                    textResponse: 'Activating skill',
                    toolCalls: [{
                        id: 'call-skill-1',
                        call_id: 'call-skill-1',
                        type: 'function_call',
                        name: 'get_skill',
                        arguments: JSON.stringify({
                            skill_name: 'prisma-checklist'
                        })
                    }],
                    requestTime: 100,
                    tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
                })
                // Second call: after skill activation
                .mockResolvedValueOnce({
                    textResponse: 'Skill activated',
                    toolCalls: [],
                    requestTime: 100,
                    tokenUsage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 }
                })
        };

        // Create workspace
        const toolManager = new ToolManager();
        workspace = new VirtualWorkspace(
            {
                id: 'test-workspace',
                name: 'Test Workspace with Skills'
            },
            toolManager
        );

        // Create agent
        agent = AgentFactory.create(
            workspace,
            agentPrompt,
            {},
            {
                ApiClient: mockApiClient
            }
        );

        // Run agent
        await agent.start('Activate PRISMA checklist skill');

        // Verify calls
        expect(mockApiClient.makeRequest).toHaveBeenCalled();
    });
});

