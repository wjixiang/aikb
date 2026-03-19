import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Agent, defaultAgentConfig } from '../agent.js';
import { VirtualWorkspace } from '../../statefulContext/virtualWorkspace.js';
import { MemoryModule } from '../../memory/MemoryModule.js';
import { TurnMemoryStore } from '../../memory/TurnMemoryStore.js';
import { ApiClient, ApiResponse, ChatCompletionTool } from '../../api-client/index.js';
import pino, { Logger } from 'pino';
import { IToolManager } from '../../tools/index.js';

/**
 * Error Rendering Test for Agent
 *
 * Tests that errors captured during tool execution are properly rendered
 * into the Context for the next LLM call.
 */

// Mock Logger
const mockLogger: Logger = {
    level: 'info',
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => mockLogger as any),
    close: vi.fn(),
    isLevelEnabled: vi.fn(() => true),
    levelChange: vi.fn(),
} as any;

describe('Agent - Error Rendering in Loop', () => {
    let mockApiClient: ApiClient;
    let mockToolManager: IToolManager;
    let workspace: VirtualWorkspace;
    let memoryModule: MemoryModule;
    let agent: Agent;
    let capturedRequests: any[] = [];

    beforeEach(() => {
        capturedRequests = [];

        // Create mock ApiClient that captures requests and simulates tool failures
        mockApiClient = {
            makeRequest: vi.fn().mockImplementation(async (
                systemPrompt: string,
                workspaceContext: string,
                memoryContext: string[],
                timeoutConfig?: any,
                tools?: ChatCompletionTool[]
            ): Promise<ApiResponse> => {
                // Capture the request for verification
                capturedRequests.push({
                    systemPrompt,
                    workspaceContext,
                    memoryContext,
                });

                const callCount = capturedRequests.length;

                if (callCount === 1) {
                    // First call: return a tool call that will fail
                    return {
                        toolCalls: [{
                            id: 'call-fail-1',
                            call_id: 'call-fail-1',
                            type: 'function_call',
                            name: 'failing_tool',
                            arguments: JSON.stringify({})
                        }],
                        textResponse: 'I will try a tool that fails',
                        requestTime: 100,
                        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
                    };
                } else if (callCount === 2) {
                    // Second call: after seeing error, complete
                    return {
                        toolCalls: [{
                            id: 'call-complete',
                            call_id: 'call-complete',
                            type: 'function_call',
                            name: 'attempt_completion',
                            arguments: JSON.stringify({ result: 'Handled error and completed' })
                        }],
                        textResponse: 'I saw the error and completed',
                        requestTime: 100,
                        tokenUsage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 }
                    };
                }

                // Fallback
                return {
                    toolCalls: [],
                    textResponse: 'Done',
                    requestTime: 100,
                    tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
                };
            })
        } as any;

        // Create mock ToolManager that throws on specific tools
        mockToolManager = {
            executeTool: vi.fn().mockImplementation(async (name: string, params: any) => {
                if (name === 'failing_tool') {
                    throw new Error('Simulated tool failure for testing');
                }
                if (name === 'attempt_completion') {
                    return { success: true, result: params.result };
                }
                return { success: true };
            }),
            getAllTools: vi.fn().mockReturnValue([]),
            getAvailableTools: vi.fn().mockReturnValue([]),
            registerProvider: vi.fn(),
            unregisterProvider: vi.fn(),
            enableTool: vi.fn(),
            disableTool: vi.fn(),
            isToolEnabled: vi.fn().mockReturnValue(true),
            getToolSource: vi.fn().mockReturnValue(null),
            onAvailabilityChange: vi.fn(),
            notifyAvailabilityChange: vi.fn(),
            getProvider: vi.fn(),
            getProviderIds: vi.fn().mockReturnValue([]),
            getToolCount: vi.fn().mockReturnValue({ total: 0, enabled: 0, disabled: 0 }),
        } as any;

        // Create workspace
        workspace = new VirtualWorkspace(
            { id: 'test-workspace', name: 'Test Workspace' } as any,
            mockToolManager
        );

        // Create MemoryModule
        memoryModule = new MemoryModule(mockLogger, {}, mockApiClient);

        // Create Agent
        agent = new Agent(
            defaultAgentConfig,
            workspace,
            { capability: 'Test agent', direction: 'Test direction' },
            memoryModule,
            mockApiClient,
            mockToolManager,
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should render tool execution error in context for next LLM call', async () => {
        // Start the agent
        const startPromise = agent.start();
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Test timeout')), 5000)
        );

        try {
            await Promise.race([startPromise, timeoutPromise]);
        } catch (e) {
            // Ignore timeout or other errors
        }

        // Give a moment for async operations
        await new Promise(resolve => setTimeout(resolve, 100));

        // Verify the API was called
        expect(capturedRequests.length).toBeGreaterThanOrEqual(2);

        // First request should have been a tool call
        expect(capturedRequests[0].memoryContext).toBeDefined();

        // Second request (after tool failure) should contain the error in memoryContext
        const secondRequest = capturedRequests[1];
        expect(secondRequest).toBeDefined();

        // Check that the memory context contains the error
        const memoryContext = secondRequest.memoryContext;
        expect(memoryContext).toBeDefined();
        expect(Array.isArray(memoryContext)).toBe(true);

        console.log('=== Memory Context in Second Request ===');
        memoryContext.forEach((ctx: string, i: number) => {
            console.log(`[${i}]: ${typeof ctx === 'string' ? ctx.substring(0, 200) : ctx}...`);
        });
        console.log('========================================');

        // The error should be rendered as a system message at the beginning
        // Check for [Error: pattern in the memory context
        const hasError = memoryContext.some((ctx: string) =>
            typeof ctx === 'string' && ctx.includes('[Error:')
        );

        expect(hasError).toBe(true);

        // Find the error message and verify its content
        const errorMessages = memoryContext.filter((ctx: string) =>
            typeof ctx === 'string' && ctx.includes('[Error:')
        );

        // The error should contain the tool failure message
        const errorContent = errorMessages.join('');
        expect(errorContent).toContain('failing_tool');
    });

    it('should verify error format in memory context', async () => {
        // Create agent that will have a tool failure
        const startPromise = agent.start();
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Test timeout')), 5000)
        );

        try {
            await Promise.race([startPromise, timeoutPromise]);
        } catch (e) {
            // Ignore
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        if (capturedRequests.length < 2) {
            console.log('capturedRequests:', capturedRequests.length);
            // Skip if we don't have enough requests
            return;
        }

        const secondRequest = capturedRequests[1];
        const memoryContext = secondRequest.memoryContext;

        // Find the error message
        const errorCtx = memoryContext.find((ctx: string) =>
            typeof ctx === 'string' && ctx.includes('[Error:')
        );

        expect(errorCtx).toBeDefined();

        // Error should be in format: [Error: <message>]
        console.log('Error context:', errorCtx);

        // The error should be wrapped in <system> tags (from formatMessage)
        // and have the format [Error: <message>]
        expect(errorCtx).toMatch(/\[Error:.*?\]/);
    });

    it('should render noToolUsedError in context', async () => {
        const spy = vi.spyOn(mockApiClient, 'makeRequest')
        spy.mockResolvedValueOnce({
            toolCalls: [],
            textResponse: 'llm response without toolCalls',
            requestTime: 0,
            tokenUsage: {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0
            }
        }).mockResolvedValueOnce(
            {
                toolCalls: [{
                    id: '',
                    call_id: '',
                    type: 'function_call',
                    name: 'attempt_completion',
                    arguments: JSON.stringify({})
                }],
                textResponse: 'llm response without toolCalls',
                requestTime: 0,
                tokenUsage: {
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0
                }
            }
        )
        // Start the agent and wait for completion
        const startPromise = agent.start();
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Test timeout')), 5000)
        );

        try {
            await Promise.race([startPromise, timeoutPromise]);
        } catch (e) {
            // Ignore timeout or other errors
        }

        // Now check messages after agent has completed
        const messages = agent.getMemoryModule().getAllMessages();

        // Should have at least the assistant message and the error
        expect(messages.length).toBeGreaterThan(0);
        console.log(JSON.stringify(messages, null, 2))
        console.log(spy.mock.calls)
        // The error should be rendered as a system message
        const hasError = messages.some(m =>
            m.role === 'system' &&
            Array.isArray(m.content) &&
            m.content.some((c: any) => c.type === 'text' && c.text.includes('[Error:'))
        );
        expect(hasError).toBe(true);
    })
});
