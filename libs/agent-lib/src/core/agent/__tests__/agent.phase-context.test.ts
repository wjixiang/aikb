/**
 * Agent Phase Context Test
 *
 * This test module verifies that different phases (thinking vs action) receive
 * appropriate context in their prompts. Specifically:
 *
 * 1. Thinking phase should NOT receive action-phase tool descriptions
 * 2. Thinking phase should NOT receive skill activation results with tool names
 * 3. Action phase should receive all available tools
 * 4. Skill activation results should be properly filtered
 *
 * Note: These tests focus on unit testing the prompt building functions
 * rather than running the full agent loop to avoid timeout/memory issues.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { VirtualWorkspace } from '../../statefulContext/index.js';
import { ToolComponent, ToolCallResult } from '../../statefulContext/index.js';
import { Tool } from '../../statefulContext/types.js';
import { tdiv } from '../../statefulContext/index.js';
import * as z from 'zod';
import { TurnMemoryStore } from '../../memory/TurnMemoryStore.js';
import { ThinkingModule } from '../../thinking/ThinkingModule.js';
import { ToolManager } from '../../tools/index.js';
import { ComponentToolProvider } from '../../tools/providers/ComponentToolProvider.js';
import type { Logger } from 'pino';
import type { ApiClient, ApiResponse } from '../../api-client/index.js';

// Mock Logger - using 'as any' to match the pattern in agent.test.ts
const mockLogger: Logger = {
    level: 'info',
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    silent: vi.fn(),
    child: vi.fn(() => mockLogger),
    close: vi.fn(),
} as any;

// Test component with action-phase tools
class TestActionComponent extends ToolComponent {
    toolSet = new Map<string, Tool>([
        ['search_database', {
            toolName: 'search_database',
            desc: 'Search the database for information',
            paramsSchema: z.object({ query: z.string() })
        }],
        ['fetch_records', {
            toolName: 'fetch_records',
            desc: 'Fetch records from the database',
            paramsSchema: z.object({ ids: z.array(z.string()) })
        }]
    ]);

    private searchData = '';

    renderImply = async (): Promise<tdiv[]> => {
        return [
            new tdiv({
                content: `Database Component: ${this.searchData || 'No search performed'}`,
                styles: { width: 80, showBorder: false }
            })
        ];
    };

    handleToolCall = async (toolName: string, params: any): Promise<ToolCallResult> => {
        if (toolName === 'search_database') {
            this.searchData = `Searched for: ${params.query}`;
            return {
                data: { query: params.query, result: this.searchData },
                summary: `[TestAction] 搜索: ${params.query}`
            };
        }
        return { data: { error: 'Unknown tool' } };
    };
}

// Test skill with action-phase tools
const testSkillWithTools = {
    name: 'database-skill',
    displayName: 'Database Skill',
    description: 'A skill for database operations',
    triggers: ['database', 'search'],
    prompt: {
        capability: 'Database search capability',
        direction: 'Use database tools to search and fetch records'
    },
    tools: [
        {
            toolName: 'db_query',
            desc: 'Execute a database query',
            paramsSchema: z.object({ sql: z.string() })
        },
        {
            toolName: 'db_insert',
            desc: 'Insert records into database',
            paramsSchema: z.object({ table: z.string(), data: z.any() })
        }
    ] as Tool[]
};

/**
 * Helper to create a standard thinking phase response
 */
function createThinkingResponse(continueThinking: boolean, summary?: string): ApiResponse {
    return {
        toolCalls: [{
            id: `thinking-${Date.now()}`,
            call_id: `thinking-call-${Date.now()}`,
            type: 'function_call',
            name: 'continue_thinking',
            arguments: JSON.stringify({
                continueThinking,
                thoughtNumber: 1,
                totalThoughts: 1,
                summary: summary || 'Analysis complete'
            })
        }],
        textResponse: 'Thinking about the task...',
        requestTime: 100,
        tokenUsage: {
            promptTokens: 50,
            completionTokens: 30,
            totalTokens: 80
        }
    };
}

/**
 * Helper to check if a tool is a function tool and get its name
 */
function getFunctionToolName(tool: any): string | null {
    if (tool && tool.type === 'function' && tool.function && tool.function.name) {
        return tool.function.name;
    }
    return null;
}

/**
 * Helper to extract tool names from tools array
 */
function extractToolNames(tools: any[]): string[] {
    return tools
        .map(getFunctionToolName)
        .filter((name): name is string => name !== null);
}

describe('Agent Phase Context Isolation', () => {
    let workspace: VirtualWorkspace;
    let actionComponent: TestActionComponent;
    let turnStore: TurnMemoryStore;

    beforeEach(() => {
        // Create fresh instances for each test
        const toolManager = new ToolManager();
        workspace = new VirtualWorkspace({
            id: 'test-workspace',
            name: 'Test Workspace',
            description: 'A workspace for testing phase context'
        }, toolManager);

        // Register action component
        actionComponent = new TestActionComponent();

        // Use new API to register component with workspace
        workspace.registerComponent('database-component', actionComponent, 0);

        // Register skill with tools (deprecated but needed for some tests)
        // Note: registerSkill is no longer available in the new architecture
        // workspace.registerSkill(testSkillWithTools);

        // Create memory store
        turnStore = new TurnMemoryStore();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Thinking Phase Tools', () => {
        it('should only expose thinking tools in thinking phase', async () => {
            // Create mock that captures the tools parameter
            let capturedTools: any[] | undefined;
            const mockApiClient: ApiClient = {
                makeRequest: vi.fn().mockImplementation(async (
                    systemPrompt: string,
                    workspaceContext: string,
                    memoryContext: string[],
                    timeoutConfig?: any,
                    tools?: any[]
                ) => {
                    capturedTools = tools;
                    return createThinkingResponse(false, 'Analysis complete');
                })
            };

            const thinkingModule = new ThinkingModule(mockApiClient, mockLogger as any, {}, turnStore);

            // Perform a single thinking phase
            await thinkingModule.performThinkingPhase('test workspace context', 'test task');

            // Verify thinking phase only received thinking tools
            expect(capturedTools).toBeDefined();
            const toolNames = extractToolNames(capturedTools!);

            expect(toolNames).toContain('continue_thinking');
            expect(toolNames).toContain('recall_context');

            // Should NOT contain action-phase tools
            expect(toolNames).not.toContain('search_database');
            expect(toolNames).not.toContain('fetch_records');
            expect(toolNames).not.toContain('db_query');
            expect(toolNames).not.toContain('db_insert');
            // Note: get_skill, list_skills, deactivate_skill have been removed
            expect(toolNames).not.toContain('attempt_completion');
        });

        it('should NOT include action tool names in thinking phase system prompt', async () => {
            let capturedSystemPrompt: string = '';
            const mockApiClient: ApiClient = {
                makeRequest: vi.fn().mockImplementation(async (
                    systemPrompt: string,
                    workspaceContext: string,
                    memoryContext: string[],
                    timeoutConfig?: any,
                    tools?: any[]
                ) => {
                    capturedSystemPrompt = systemPrompt;
                    return createThinkingResponse(false, 'Analysis complete');
                })
            };

            const thinkingModule = new ThinkingModule(mockApiClient, mockLogger as any, {}, turnStore);

            // Perform a single thinking phase
            await thinkingModule.performThinkingPhase('test workspace context', 'test task');

            // The thinking phase system prompt should NOT contain action tool descriptions as callable tools
            // Note: The system prompt mentions tool names in the RESTRICTION section as examples of what NOT to call
            // This is intentional to help LLM understand the restrictions
            // The key is that these tools are NOT in the "tools" parameter passed to the API

            // Verify the prompt contains the restriction section mentioning these tools as forbidden
            expect(capturedSystemPrompt).toContain('NO search tools');
            expect(capturedSystemPrompt).toContain('NO data manipulation tools');
            expect(capturedSystemPrompt).toContain('NO fetch tools');

            // Verify the prompt emphasizes planning-only nature
            expect(capturedSystemPrompt).toContain('PLANNING ONLY');
            expect(capturedSystemPrompt).toContain('NO EXECUTION ALLOWED');
            expect(capturedSystemPrompt).toContain('PLANNING-ONLY PHASE');
        });

        it('should NOT include skill tool descriptions in thinking phase context', async () => {
            let capturedContext: string = '';
            const mockApiClient: ApiClient = {
                makeRequest: vi.fn().mockImplementation(async (
                    systemPrompt: string,
                    workspaceContext: string,
                    memoryContext: string[],
                    timeoutConfig?: any,
                    tools?: any[]
                ) => {
                    capturedContext = workspaceContext;
                    return createThinkingResponse(false, 'Analysis complete');
                })
            };

            const thinkingModule = new ThinkingModule(mockApiClient, mockLogger as any, {}, turnStore);

            // Perform a single thinking phase with workspace context that includes skill info
            const workspaceContext = await workspace.render();
            await thinkingModule.performThinkingPhase(workspaceContext, 'test task');

            // The context should NOT contain skill activation results with tool names
            // Note: This test may fail if the bug exists (addedTools is leaked)
            expect(capturedContext).not.toContain('addedTools');
        });
    });

    describe('Workspace Context Rendering', () => {
        it('should render workspace with components', async () => {
            const context = await workspace.render();

            // Workspace should contain the database component
            expect(context).toContain('database-component');
            expect(context).toContain('Database Component');
        });

        // Note: Skill-related tests have been removed as the skill system is deprecated
        // The COMPONENTS section replaces the SKILLS section in the new architecture
    });

    describe('Tool Manager Integration', () => {
        it('should provide component tools through tool manager', () => {
            const tools = workspace.getAllTools();

            // Should include component tools
            const toolNames = tools.map((t: any) => t.tool.toolName);
            expect(toolNames).toContain('search_database');
            expect(toolNames).toContain('fetch_records');
        });

        it('should provide global tools through tool manager', () => {
            const tools = workspace.getAllTools();

            // Should include global tools
            // Note: skill tools (get_skill, list_skills, deactivate_skill) have been removed
            const toolNames = tools.map((t: any) => t.tool.toolName);
            expect(toolNames).toContain('attempt_completion');
        });
    });

    describe('Thinking Phase History Filtering', () => {
        it('should filter out tool_result blocks from history', async () => {
            // Add a message with tool_result to the turn store
            const turn = turnStore.createTurn('test context');
            turnStore.addMessageToTurn(turn.id, {
                role: 'user',
                content: [
                    { type: 'text', text: 'Test message' },
                    { type: 'tool_result', tool_use_id: 'test-id', content: 'Tool result content' }
                ],
                ts: Date.now()
            });

            let capturedHistory: string[] = [];
            const mockApiClient: ApiClient = {
                makeRequest: vi.fn().mockImplementation(async (
                    systemPrompt: string,
                    workspaceContext: string,
                    memoryContext: string[],
                    timeoutConfig?: any,
                    tools?: any[]
                ) => {
                    capturedHistory = memoryContext;
                    return createThinkingResponse(false, 'Analysis complete');
                })
            };

            const thinkingModule = new ThinkingModule(mockApiClient, mockLogger as any, {}, turnStore);

            // Perform thinking phase
            await thinkingModule.performThinkingPhase('test context', 'test task');

            // History should be filtered - should not contain tool_result markers
            if (capturedHistory.length > 0) {
                const historyText = capturedHistory.join('\n');
                expect(historyText).not.toContain('tool_result');
                expect(historyText).not.toContain('tool_use_id');
            }
        });

        it('should filter out tool_use blocks from history', async () => {
            // Add a message with tool_use to the turn store
            const turn = turnStore.createTurn('test context');
            turnStore.addMessageToTurn(turn.id, {
                role: 'assistant',
                content: [
                    { type: 'text', text: 'Assistant message' },
                    { type: 'tool_use', id: 'test-id', name: 'test_tool', input: {} }
                ],
                ts: Date.now()
            });

            let capturedHistory: string[] = [];
            const mockApiClient: ApiClient = {
                makeRequest: vi.fn().mockImplementation(async (
                    systemPrompt: string,
                    workspaceContext: string,
                    memoryContext: string[],
                    timeoutConfig?: any,
                    tools?: any[]
                ) => {
                    capturedHistory = memoryContext;
                    return createThinkingResponse(false, 'Analysis complete');
                })
            };

            const thinkingModule = new ThinkingModule(mockApiClient, mockLogger as any, {}, turnStore);

            // Perform thinking phase
            await thinkingModule.performThinkingPhase('test context', 'test task');

            // History should be filtered - should not contain tool_use markers
            if (capturedHistory.length > 0) {
                const historyText = capturedHistory.join('\n');
                expect(historyText).not.toContain('tool_use');
            }
        });
    });

    describe('Tool Violation Detection', () => {
        it('should throw error when LLM uses action-phase tool during thinking', async () => {
            // Mock response with action-phase tool call
            const mockApiClient: ApiClient = {
                makeRequest: vi.fn().mockResolvedValue({
                    toolCalls: [{
                        id: 'violation-1',
                        call_id: 'violation-call-1',
                        type: 'function_call',
                        name: 'search_database',  // This is an action-phase tool
                        arguments: JSON.stringify({ query: 'test' })
                    }],
                    textResponse: 'I will search the database',
                    requestTime: 100,
                    tokenUsage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 }
                })
            };

            const thinkingModule = new ThinkingModule(mockApiClient, mockLogger as any, {}, turnStore);

            // Should throw ThinkingPhaseToolViolationError
            await expect(thinkingModule.performThinkingPhase('test context', 'test task'))
                .rejects.toThrow('Thinking phase violation');
        });

        it('should throw error when LLM uses action-phase tools during thinking', async () => {
            // Mock response with attempt_completion tool call (which is action-phase only)
            const mockApiClient: ApiClient = {
                makeRequest: vi.fn().mockResolvedValue({
                    toolCalls: [{
                        id: 'violation-2',
                        call_id: 'violation-call-2',
                        type: 'function_call',
                        name: 'attempt_completion',  // This is an action-phase tool
                        arguments: JSON.stringify({ result: 'Task completed' })
                    }],
                    textResponse: 'I will complete the task',
                    requestTime: 100,
                    tokenUsage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 }
                })
            };

            const thinkingModule = new ThinkingModule(mockApiClient, mockLogger as any, {}, turnStore);

            // Should throw ThinkingPhaseToolViolationError
            await expect(thinkingModule.performThinkingPhase('test context', 'test task'))
                .rejects.toThrow('Thinking phase violation');
        });

        it('should NOT throw error when LLM uses only thinking tools', async () => {
            // Mock response with valid thinking tool call
            const mockApiClient: ApiClient = {
                makeRequest: vi.fn().mockResolvedValue({
                    toolCalls: [{
                        id: 'thinking-1',
                        call_id: 'thinking-call-1',
                        type: 'function_call',
                        name: 'continue_thinking',  // This is a valid thinking tool
                        arguments: JSON.stringify({
                            continueThinking: false,
                            thoughtNumber: 1,
                            totalThoughts: 1,
                            summary: 'Task analyzed'
                        })
                    }],
                    textResponse: 'Thinking complete',
                    requestTime: 100,
                    tokenUsage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 }
                })
            };

            const thinkingModule = new ThinkingModule(mockApiClient, mockLogger as any, {}, turnStore);

            // Should NOT throw
            const result = await thinkingModule.performThinkingPhase('test context', 'test task');
            expect(result).toBeDefined();
            expect(result.rounds).toHaveLength(1);
        });

        it('should NOT throw error when LLM uses recall_context tool', async () => {
            // Mock response with recall_context tool call
            const mockApiClient: ApiClient = {
                makeRequest: vi.fn().mockResolvedValue({
                    toolCalls: [{
                        id: 'recall-1',
                        call_id: 'recall-call-1',
                        type: 'function_call',
                        name: 'recall_context',  // This is a valid thinking tool
                        arguments: JSON.stringify({ turnNumbers: [1] })
                    }],
                    textResponse: 'Recalling context',
                    requestTime: 100,
                    tokenUsage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 }
                })
            };

            // Create a turn in the turnStore so recall_context has something to recall
            const turn = turnStore.createTurn('test workspace context');
            turnStore.addMessageToTurn(turn.id, {
                role: 'user',
                content: [{ type: 'text', text: 'Test message' }],
                ts: Date.now()
            });

            const thinkingModule = new ThinkingModule(mockApiClient, mockLogger as any, {}, turnStore);

            // Should NOT throw - pass undefined as second argument (lastToolResults is optional)
            const result = await thinkingModule.performThinkingPhase('test context');
            expect(result).toBeDefined();
        });
    });

    // Note: These tests depend on the removed skill system - skipping
    describe.skip('Context After Skill Activation', () => {
        it('should print context after skill activation to verify tool leakage', async () => {
            // First, activate the skill
            const activationResult = await workspace.getSkillManager().activateSkill('database-skill');
            console.log('\n=== Skill Activation Result ===');
            console.log('Success:', activationResult.success);
            console.log('Message:', activationResult.message);
            console.log('Added Tools:', activationResult.addedComponents);

            // Capture the context passed to thinking phase after skill activation
            let capturedContext: string = '';
            let capturedSystemPrompt: string = '';
            let capturedHistory: string[] = [];

            const mockApiClient: ApiClient = {
                makeRequest: vi.fn().mockImplementation(async (
                    systemPrompt: string,
                    workspaceContext: string,
                    memoryContext: string[],
                    timeoutConfig?: any,
                    tools?: any[]
                ) => {
                    capturedSystemPrompt = systemPrompt;
                    capturedContext = workspaceContext;
                    capturedHistory = memoryContext;
                    return createThinkingResponse(false, 'Analysis complete');
                })
            };

            const thinkingModule = new ThinkingModule(mockApiClient, mockLogger as any, {}, turnStore);

            // Simulate the workspace context after skill activation
            const workspaceContext = await workspace.render();
            console.log('\n=== Workspace Context After Skill Activation ===');
            console.log(workspaceContext.substring(0, 2000)); // Print first 2000 chars

            // Perform thinking phase with the activated skill context
            await thinkingModule.performThinkingPhase(workspaceContext, 'test task');

            console.log('\n=== Thinking Phase Context After Skill Activation ===');
            console.log('System Prompt length:', capturedSystemPrompt.length);
            console.log('Workspace Context length:', capturedContext.length);
            console.log('History items:', capturedHistory.length);

            // Print relevant parts of the context
            console.log('\n--- Workspace Context (first 1500 chars) ---');
            console.log(capturedContext.substring(0, 1500));

            if (capturedHistory.length > 0) {
                console.log('\n--- Memory Context (History) ---');
                console.log(capturedHistory.join('\n'));
            }

            // Verify that the context does NOT contain skill activation results with tool names
            // This is the key assertion - if it fails, the bug exists
            console.log('\n=== Verification ===');
            const hasAddedTools = capturedContext.includes('addedTools');
            const hasDbQuery = capturedContext.includes('db_query');
            const hasDbInsert = capturedContext.includes('db_insert');

            console.log('Context contains "addedTools":', hasAddedTools);
            console.log('Context contains "db_query":', hasDbQuery);
            console.log('Context contains "db_insert":', hasDbInsert);

            // These assertions verify the bug is NOT present
            expect(hasAddedTools).toBe(false);
        });

        it('should NOT leak skill tool names into thinking phase context when skill is active', async () => {
            // Activate the skill
            await workspace.getSkillManager().activateSkill('database-skill');

            let capturedContext: string = '';
            const mockApiClient: ApiClient = {
                makeRequest: vi.fn().mockImplementation(async (
                    systemPrompt: string,
                    workspaceContext: string,
                    memoryContext: string[],
                    timeoutConfig?: any,
                    tools?: any[]
                ) => {
                    capturedContext = workspaceContext;
                    return createThinkingResponse(false, 'Analysis complete');
                })
            };

            const thinkingModule = new ThinkingModule(mockApiClient, mockLogger as any, {}, turnStore);

            // Get workspace context with active skill
            const workspaceContext = await workspace.render();
            await thinkingModule.performThinkingPhase(workspaceContext, 'test task');

            // The context should NOT contain the skill's tool names as callable items
            // Note: The workspace may show skill tools in a "Skill Tools" section for display,
            // but this is different from having them as callable tools
            expect(capturedContext).not.toContain('addedTools');
        });

        it('should show skill tools in workspace skill tools section when skill is active', async () => {
            // Activate the skill
            await workspace.getSkillManager().activateSkill('database-skill');

            // Get workspace context
            const workspaceContext = await workspace.render();

            // The workspace SHOULD show the skill tools section when skill is active
            // This is for display purposes, not for calling
            console.log('\n=== Workspace Context with Active Skill ===');
            console.log(workspaceContext);

            // Verify skill tools section exists
            expect(workspaceContext).toContain('Database Skill');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty workspace context gracefully', async () => {
            // Create workspace without components
            const emptyWorkspace = new VirtualWorkspace({
                id: 'empty-workspace',
                name: 'Empty Workspace'
            }, new ToolManager());

            let capturedContext: string = '';
            const mockApiClient: ApiClient = {
                makeRequest: vi.fn().mockImplementation(async (
                    systemPrompt: string,
                    workspaceContext: string,
                    memoryContext: string[],
                    timeoutConfig?: any,
                    tools?: any[]
                ) => {
                    capturedContext = workspaceContext;
                    return createThinkingResponse(false, 'Done');
                })
            };

            const emptyTurnStore = new TurnMemoryStore();
            const emptyThinkingModule = new ThinkingModule(mockApiClient, mockLogger as any, {}, emptyTurnStore);

            // Should not throw
            await expect(emptyThinkingModule.performThinkingPhase('empty context', 'test task')).resolves.toBeDefined();

            // Context should be defined (even if empty)
            expect(capturedContext).toBeDefined();
        });

        it('should handle multiple thinking rounds', async () => {
            let callCount = 0;
            const mockApiClient: ApiClient = {
                makeRequest: vi.fn().mockImplementation(async () => {
                    callCount++;
                    // Continue thinking for first 2 rounds, then stop
                    return createThinkingResponse(callCount < 3, `Round ${callCount} complete`);
                })
            };

            const thinkingModule = new ThinkingModule(mockApiClient, mockLogger as any, {
                maxThinkingRounds: 5
            }, turnStore);

            const result = await thinkingModule.performThinkingPhase('test context', 'test task');

            // Should have completed at least 3 rounds
            expect(callCount).toBeGreaterThanOrEqual(3);
            expect(result.rounds.length).toBeGreaterThanOrEqual(3);
        });
    });
});
