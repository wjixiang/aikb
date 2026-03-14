/**
 * Unit tests for ActionModule prompt inspection
 * Tests to verify and inspect the complete prompt structure passed to the API client
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
import type { ApiMessage } from '../../task/task.type.js';
import pino from 'pino';

describe('ActionModule - Prompt Inspection', () => {
    let container: Container;
    let actionModule: IActionModule;
    let mockApiClient: ApiClient;
    let mockToolManager: IToolManager;
    let mockTurnMemoryStore: ITurnMemoryStore;
    let mockLogger: any;
    let capturedPrompts: Array<{
        systemPrompt: string;
        workspaceContext: string;
        memoryContext: string[];
        tools: ChatCompletionTool[] | undefined;
    }>;

    beforeEach(() => {
        // Reset captured prompts
        capturedPrompts = [];

        // Create container
        container = new Container();

        // Create mock logger
        mockLogger = pino({ level: 'silent' });

        // Create mock ApiClient that captures prompts
        mockApiClient = {
            makeRequest: vi.fn().mockImplementation(
                (systemPrompt: string, workspaceContext: string, memoryContext: string[], timeoutConfig: any, tools?: ChatCompletionTool[]) => {
                    // Capture the prompt for inspection
                    capturedPrompts.push({
                        systemPrompt,
                        workspaceContext,
                        memoryContext,
                        tools,
                    });

                    // Return mock response with a tool call (attempt_completion)
                    return Promise.resolve({
                        toolCalls: [{
                            id: 'test-call-1',
                            call_id: 'test-call-id-1',
                            type: 'function_call',
                            name: 'attempt_completion',
                            arguments: JSON.stringify({ result: 'Task completed successfully' })
                        }],
                        textResponse: 'Task completed',
                        requestTime: 100,
                        tokenUsage: {
                            promptTokens: 100,
                            completionTokens: 50,
                            totalTokens: 150,
                        },
                    });
                }
            ),
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

    describe('Complete prompt structure', () => {
        it.only('should capture and display complete prompt with system prompt, workspace context, and conversation history', async () => {
            const systemPrompt = 'You are a helpful assistant.';
            const workspaceContext = 'Workspace: Test workspace with some state';
            const conversationHistory: ApiMessage[] = [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Hello, how are you?' },
                    ],
                    ts: Date.now(),
                },
                {
                    role: 'assistant',
                    content: [
                        { type: 'text', text: 'I am doing well, thank you!' },
                    ],
                    ts: Date.now(),
                },
            ];
            const tools: ChatCompletionTool[] = [
                {
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
                },
            ];

            // Perform action phase
            await actionModule.performActionPhase(
                workspaceContext,
                systemPrompt,
                conversationHistory,
                tools,
                () => false
            );

            // Verify prompt was captured
            expect(capturedPrompts).toHaveLength(1);
            const prompt = capturedPrompts[0];

            // Display complete prompt structure
            console.log('\n========== COMPLETE PROMPT STRUCTURE ==========');
            console.log('\n--- SYSTEM PROMPT ---');
            console.log(prompt.systemPrompt);
            console.log('\n--- WORKSPACE CONTEXT ---');
            console.log(prompt.workspaceContext);
            console.log('\n--- MEMORY CONTEXT (Conversation History) ---');
            prompt.memoryContext.forEach((item, index) => {
                console.log(`\n[${index + 1}] ${item}`);
            });
            console.log('\n--- TOOLS ---');
            console.log(JSON.stringify(prompt.tools, null, 2));
            console.log('\n==============================================\n');

            // Verify structure
            expect(prompt.systemPrompt).toBe(systemPrompt);
            expect(prompt.workspaceContext).toBe(workspaceContext);
            expect(prompt.memoryContext).toHaveLength(2);
            expect(prompt.tools).toEqual(tools);
        });

        it('should properly convert conversation history to memory context format', async () => {
            const conversationHistory: ApiMessage[] = [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'User message' },
                    ],
                    ts: Date.now(),
                },
                {
                    role: 'assistant',
                    content: [
                        { type: 'thinking', thinking: 'This is my thinking process' },
                        { type: 'text', text: 'Assistant response' },
                        { type: 'tool_use', id: 'tool-1', name: 'test_tool', input: { param: 'value' } },
                    ],
                    ts: Date.now(),
                },
                {
                    role: 'system',
                    content: [
                        { type: 'tool_result', tool_use_id: 'tool-1', content: 'Tool output' },
                    ],
                    ts: Date.now(),
                },
            ];

            await actionModule.performActionPhase(
                'test workspace',
                'test system prompt',
                conversationHistory,
                [],
                () => false
            );

            const prompt = capturedPrompts[0];

            console.log('\n========== MEMORY CONTEXT CONVERSION ==========');
            prompt.memoryContext.forEach((item, index) => {
                console.log(`\n[${index + 1}] Role: ${item.match(/<(user|assistant|system)>/)?.[1]}`);
                console.log(item);
            });
            console.log('\n==================================================\n');

            // Verify conversion format
            expect(prompt.memoryContext[0]).toContain('<user>');
            expect(prompt.memoryContext[0]).toContain('User message');
            expect(prompt.memoryContext[1]).toContain('<assistant>');
            expect(prompt.memoryContext[1]).toContain('<thinking>This is my thinking process</thinking>');
            expect(prompt.memoryContext[1]).toContain('Assistant response');
            expect(prompt.memoryContext[1]).toContain('<tool_use name="test_tool">');
            expect(prompt.memoryContext[2]).toContain('<system>');
            expect(prompt.memoryContext[2]).toContain('<tool_result tool_use_id="tool-1">');
        });

        it('should display prompt with multiple tools', async () => {
            const tools: ChatCompletionTool[] = [
                {
                    type: 'function',
                    function: {
                        name: 'search_files',
                        description: 'Search for files in the workspace',
                        parameters: {
                            type: 'object',
                            properties: {
                                query: { type: 'string', description: 'Search query' },
                                path: { type: 'string', description: 'Path to search in' },
                            },
                            required: ['query'],
                        },
                    },
                },
                {
                    type: 'function',
                    function: {
                        name: 'read_file',
                        description: 'Read contents of a file',
                        parameters: {
                            type: 'object',
                            properties: {
                                path: { type: 'string', description: 'File path' },
                            },
                            required: ['path'],
                        },
                    },
                },
                {
                    type: 'function',
                    function: {
                        name: 'write_file',
                        description: 'Write content to a file',
                        parameters: {
                            type: 'object',
                            properties: {
                                path: { type: 'string', description: 'File path' },
                                content: { type: 'string', description: 'File content' },
                            },
                            required: ['path', 'content'],
                        },
                    },
                },
            ];

            await actionModule.performActionPhase(
                'Workspace with multiple files',
                'You are a file system assistant.',
                [],
                tools,
                () => false
            );

            const prompt = capturedPrompts[0];

            console.log('\n========== PROMPT WITH MULTIPLE TOOLS ==========');
            console.log('\n--- SYSTEM PROMPT ---');
            console.log(prompt.systemPrompt);
            console.log('\n--- WORKSPACE CONTEXT ---');
            console.log(prompt.workspaceContext);
            console.log('\n--- TOOLS ---');
            prompt.tools?.forEach((tool, index) => {
                if (tool.type === 'function') {
                    console.log(`\n[${index + 1}] Tool: ${tool.function.name}`);
                    console.log(`    Description: ${tool.function.description}`);
                    console.log(`    Parameters: ${JSON.stringify(tool.function.parameters, null, 8)}`);
                }
            });
            console.log('\n================================================\n');

            expect(prompt.tools).toHaveLength(3);
        });

        it('should display prompt with complex workspace context', async () => {
            const complexWorkspaceContext = `
╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                             VIRTUAL WORKSPACE: Medical Bibliography Searching workspace                              ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝
Description: Workspace for viewing and searching through Pubmed

┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                                      │
│                                                        SKILLS                                                        │
│┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐│
││                                                                                                                    ││
││                                                  AVAILABLE SKILLS                                                  ││
││### Meta-Analysis Article Retrieval                                                                                 ││
││**ID:** \`meta-analysis-article-retrieval\`                                                                          ││
││**Description:** Systematic literature retrieval for meta-analysis, producing standardized search strategies         ││
││**When to use:** Use this skill when you need to conduct systematic literature searches for meta-analysis            ││
││**Triggers:** meta analysis retrieval, literature search, systematic search, pubmed search strategy               ││
││                                                                                                                    ││
│└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                        COMPONENTS                                                   │
│┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐│
││                                                                                                                    ││
││                                                   ACTIVE COMPONENTS                                               ││
││### PubMed Search Component                                                                                        ││
││**State:**                                                                                                           ││
││  - searchQuery: "diabetes treatment"                                                                               ││
││  - resultsCount: 25                                                                                                ││
││  - currentPage: 1                                                                                                  ││
││                                                                                                                    ││
│└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
            `;

            await actionModule.performActionPhase(
                complexWorkspaceContext,
                'You are a medical research assistant.',
                [],
                [],
                () => false
            );

            const prompt = capturedPrompts[0];

            console.log('\n========== PROMPT WITH COMPLEX WORKSPACE CONTEXT ==========');
            console.log('\n--- SYSTEM PROMPT ---');
            console.log(prompt.systemPrompt);
            console.log('\n--- WORKSPACE CONTEXT ---');
            console.log(prompt.workspaceContext);
            console.log('\n===========================================================\n');

            expect(prompt.workspaceContext).toContain('VIRTUAL WORKSPACE');
            expect(prompt.workspaceContext).toContain('Meta-Analysis Article Retrieval');
            expect(prompt.workspaceContext).toContain('PubMed Search Component');
        });

        it('should display prompt with attempt_completion tool', async () => {
            const tools: ChatCompletionTool[] = [
                {
                    type: 'function',
                    function: {
                        name: 'attempt_completion',
                        description: 'Call this function when you have completed the task',
                        parameters: {
                            type: 'object',
                            properties: {
                                result: {
                                    type: 'string',
                                    description: 'The final result of the task',
                                },
                            },
                            required: ['result'],
                        },
                    },
                },
            ];

            await actionModule.performActionPhase(
                'Simple workspace',
                'Complete the task.',
                [],
                tools,
                () => false
            );

            const prompt = capturedPrompts[0];

            console.log('\n========== PROMPT WITH ATTEMPT_COMPLETION TOOL ==========');
            console.log('\n--- SYSTEM PROMPT ---');
            console.log(prompt.systemPrompt);
            console.log('\n--- WORKSPACE CONTEXT ---');
            console.log(prompt.workspaceContext);
            console.log('\n--- TOOLS ---');
            console.log(JSON.stringify(prompt.tools, null, 2));
            console.log('\n========================================================\n');

            expect(prompt.tools).toHaveLength(1);
            if (prompt.tools?.[0]?.type === 'function') {
                expect(prompt.tools[0].function.name).toBe('attempt_completion');
            }
        });
    });
});
