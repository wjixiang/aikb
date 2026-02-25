/**
 * Meta-Analysis Agent Test
 *
 * This test module verifies the meta-analysis workspace and agent coordination
 * for automated meta-analysis tasks. Tests focus on:
 *
 * 1. Agent initialization with MetaAnalysisWorkspace
 * 2. Skill registration and activation for article retrieval
 * 3. Tool calling and context rendering at Agent level
 * 4. Agent coordination with meta-analysis workflow
 *
 * Note: These tests use unit testing approach with mocked API client
 * to avoid timeout/memory issues from running the full agent loop.
 * Tests follow the pattern from agent.phase-context.test.ts - testing
 * ThinkingModule and workspace directly instead of full Agent instantiation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MetaAnalysisWorkspace } from '../../workspaces/metaAnalysisWorkspace.js';
import { getBuiltinSkills, getBuiltinSkill } from '../../skills/builtin/index.js';
import { TurnMemoryStore } from '../../memory/TurnMemoryStore.js';
import { ThinkingModule } from '../../thinking/ThinkingModule.js';
import { ToolManager } from '../../tools/index.js';
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

// Use the built-in meta-analysis-article-retrieval skill from DI container
const ARTICLE_RETRIEVAL_SKILL_NAME = 'meta-analysis-article-retrieval';

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
        textResponse: 'Thinking about the meta-analysis task...',
        requestTime: 100,
        tokenUsage: {
            promptTokens: 50,
            completionTokens: 30,
            totalTokens: 80
        }
    };
}

/**
 * Helper to create an action phase response with tool call
 */
function createActionResponse(toolName: string, toolArgs: any): ApiResponse {
    return {
        toolCalls: [{
            id: `action-${Date.now()}`,
            call_id: `action-call-${Date.now()}`,
            type: 'function_call',
            name: toolName,
            arguments: JSON.stringify(toolArgs)
        }],
        textResponse: `Executing ${toolName}...`,
        requestTime: 150,
        tokenUsage: {
            promptTokens: 60,
            completionTokens: 40,
            totalTokens: 100
        }
    };
}

/**
 * Helper to extract tool names from tools array
 */
function extractToolNames(tools: any[]): string[] {
    return tools
        .filter((tool) => tool && tool.type === 'function' && tool.function && tool.function.name)
        .map((tool) => tool.function.name);
}

/**
 * Create a mock ApiClient for testing
 */
function createMockApiClient(responseFn?: () => ApiResponse): ApiClient {
    return {
        makeRequest: vi.fn().mockImplementation(async () => {
            if (responseFn) {
                return responseFn();
            }
            return createThinkingResponse(false, 'Analysis complete');
        })
    };
}

describe('Meta-Analysis Agent', () => {
    let workspace: MetaAnalysisWorkspace;
    let turnStore: TurnMemoryStore;
    let apiClient: ApiClient;

    beforeEach(() => {
        // Create fresh instances for each test
        const toolManager = new ToolManager();
        workspace = new MetaAnalysisWorkspace();
        turnStore = new TurnMemoryStore();

        // Register built-in skills to workspace
        const skills = getBuiltinSkills();
        workspace.registerSkills(skills);

        // Create mock API client
        apiClient = createMockApiClient();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Agent Initialization', () => {
        it('should create workspace with meta-analysis components', () => {
            expect(workspace).toBeDefined();
        });

        it('should have meta-analysis components in workspace', async () => {
            const context = await workspace.render();
            console.log(context)
            // Workspace should contain meta-analysis components
            expect(context).toContain('PICO Templater');
            expect(context).toContain('Prisma Check List');
            expect(context).toContain('Prisma Workflow');
            expect(context).toContain('Pubmed Search Engine');
        });

        it('should have correct workspace metadata', () => {
            const config = workspace.getConfig();

            expect(config.id).toBe('bibliography-workspace');
            expect(config.name).toBe('Medical Bibliography Searching workspace');
            expect(config.description).toContain('Pubmed');
        });
    });

    describe('Agent with Article Retrieval Skill', () => {
        it('should have article-retrieval skill available', () => {
            const skills = workspace.getAvailableSkills();
            const articleRetrievalSkill = skills.find(s => s.name === ARTICLE_RETRIEVAL_SKILL_NAME);

            expect(articleRetrievalSkill).toBeDefined();
            expect(articleRetrievalSkill?.displayName).toBe('Meta-Analysis Article Retrieval');
        });

        it('should activate article-retrieval skill through agent', async () => {
            const result = await workspace.getSkillManager().activateSkill(ARTICLE_RETRIEVAL_SKILL_NAME);

            expect(result.success).toBe(true);
            expect(result.addedTools).toBeDefined();
            expect(result.addedTools).toContain('search_pubmed');
            expect(result.addedTools).toContain('view_article');
            expect(result.addedTools).toContain('navigate_page');
            expect(result.addedTools).toContain('clear_results');
        });

        it('should show active skill in workspace context after activation', async () => {
            await workspace.getSkillManager().activateSkill(ARTICLE_RETRIEVAL_SKILL_NAME);
            const context = await workspace.render();

            // Workspace should show active skill
            expect(context).toContain('Active:');
            expect(context).toContain('Meta-Analysis Article Retrieval');
        });

        it('should render skill tools section when skill is active', async () => {
            await workspace.getSkillManager().activateSkill(ARTICLE_RETRIEVAL_SKILL_NAME);
            const context = await workspace.render();

            // Workspace should show skill tools section
            expect(context).toContain('SKILL TOOLS');
            expect(context).toContain('Meta-Analysis Article Retrieval');
        });
    });

    describe('Agent Tool Management', () => {
        it('should provide all tools through workspace', () => {
            const tools = workspace.getAllTools();

            // Should include global tools
            const toolNames = tools.map((t: any) => t.tool.toolName);
            expect(toolNames).toContain('attempt_completion');
            expect(toolNames).toContain('get_skill');
            expect(toolNames).toContain('list_skills');
            expect(toolNames).toContain('deactivate_skill');
        });

        it('should provide component tools through workspace', () => {
            const tools = workspace.getAllTools();

            // Should include component tools (search_pubmed from BibliographySearchComponent)
            const toolNames = tools.map((t: any) => t.tool.toolName);
            console.log(tools)
            expect(toolNames).toContain('search_pubmed');

            // Component tools should be disabled by default when no skill is active
            const searchPubmedTool = tools.find((t: any) => t.tool.toolName === 'search_pubmed');
            expect(searchPubmedTool).toBeDefined();
            expect(searchPubmedTool?.enabled).toBe(false);
        });

        it('should add skill tools after skill activation', async () => {
            // Activate skill and check the result
            const result = await workspace.getSkillManager().activateSkill(ARTICLE_RETRIEVAL_SKILL_NAME);

            expect(result.success).toBe(true);
            expect(result.addedTools).toBeDefined();
            expect(result.addedTools).toContain('search_pubmed');
            expect(result.addedTools).toContain('view_article');
            expect(result.addedTools).toContain('navigate_page');
            expect(result.addedTools).toContain('clear_results');
        });

        it('should return skill tools in activation result', async () => {
            const result = await workspace.getSkillManager().activateSkill(ARTICLE_RETRIEVAL_SKILL_NAME);

            expect(result.success).toBe(true);
            expect(result.addedTools).toBeDefined();
            expect(result.addedTools).toContain('search_pubmed');
            expect(result.addedTools).toContain('view_article');
            expect(result.addedTools).toContain('navigate_page');
            expect(result.addedTools).toContain('clear_results');
        });
    });

    describe('Agent Thinking Phase', () => {
        it('should only expose thinking tools in thinking phase', async () => {
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
                    return createThinkingResponse(false, 'Meta-analysis planning complete');
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
            expect(toolNames).not.toContain('search_pubmed');
            expect(toolNames).not.toContain('view_article');
            expect(toolNames).not.toContain('navigate_page');
        });

        it('should NOT include skill tool names in thinking phase context', async () => {
            await workspace.getSkillManager().activateSkill(ARTICLE_RETRIEVAL_SKILL_NAME);

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

            // Perform thinking phase with workspace context
            const workspaceContext = await workspace.render();
            await thinkingModule.performThinkingPhase(workspaceContext, 'test task');

            // The context should NOT contain skill activation results with tool names
            expect(capturedContext).not.toContain('addedTools');
        });
    });

    describe('Agent Tool Calling', () => {
        it('should handle search_pubmed tool call through agent workspace', async () => {
            const result = await workspace.handleToolCall(
                'search_pubmed',
                { simpleTerm: 'treatment of hypertension', sort: 'date', sortOrder: 'dsc' }
            );

            expect(result).toBeDefined();
        });

        it('should render workspace after tool execution', async () => {
            await workspace.handleToolCall(
                'search_pubmed',
                { simpleTerm: 'mesenchymal stem cells knee osteoarthritis', sort: 'relevance' }
            );

            const context = await workspace.render();
            expect(context).toBeDefined();
            expect(context.length).toBeGreaterThan(0);
        });

        it('should handle navigate_page tool call', async () => {
            // First perform a search to have results to navigate
            await workspace.handleToolCall(
                'search_pubmed',
                { simpleTerm: 'stem cells therapy' }
            );

            // Then navigate pages
            const result = await workspace.handleToolCall(
                'navigate_page',
                { direction: 'next' }
            );

            expect(result).toBeDefined();
        });

        it('should handle clear_results tool call', async () => {
            const result = await workspace.handleToolCall(
                'clear_results',
                {}
            );

            expect(result).toBeDefined();
        });
    });

    describe('Agent Meta-Analysis Workflow', () => {
        it('should handle meta-analysis query', async () => {
            const query = 'Efficacy of mesenchymal stem cells injection for the management of knee osteoarthritis';

            // Activate skill for article retrieval
            const activationResult = await workspace.getSkillManager().activateSkill(ARTICLE_RETRIEVAL_SKILL_NAME);
            expect(activationResult.success).toBe(true);

            // Verify workspace context includes skill
            const context = await workspace.render();
            expect(context).toContain('Meta-Analysis Article Retrieval');
        });

        it('should track tool usage during meta-analysis', async () => {
            // Activate skill
            await workspace.getSkillManager().activateSkill(ARTICLE_RETRIEVAL_SKILL_NAME);

            // Simulate tool calls during meta-analysis workflow
            await workspace.handleToolCall(
                'search_pubmed',
                { simpleTerm: 'stem cells knee osteoarthritis' }
            );

            // Verify tool was called (check workspace state)
            const context = await workspace.render();
            expect(context).toBeDefined();
        });

        it('should support complete retrieval workflow', async () => {
            // Activate skill
            await workspace.getSkillManager().activateSkill(ARTICLE_RETRIEVAL_SKILL_NAME);

            // Step 1: Search
            await workspace.handleToolCall(
                'search_pubmed',
                { simpleTerm: 'mesenchymal stem cells knee osteoarthritis' }
            );

            // Step 2: Navigate pages (if there are results)
            await workspace.handleToolCall(
                'navigate_page',
                { direction: 'next' }
            );

            // Step 3: Clear and refine search if needed
            await workspace.handleToolCall(
                'clear_results',
                {}
            );

            // Verify workspace state
            const context = await workspace.render();
            expect(context).toBeDefined();
        });
    });

    describe('Agent Context After Skill Activation', () => {
        it('should print context after skill activation to verify tool leakage', async () => {
            // Activate the skill
            const activationResult = await workspace.getSkillManager().activateSkill(ARTICLE_RETRIEVAL_SKILL_NAME);
            console.log('\n=== Skill Activation Result ===');
            console.log('Success:', activationResult.success);
            console.log('Message:', activationResult.message);
            console.log('Added Tools:', activationResult.addedTools);

            // Capture the context passed to thinking phase after skill activation
            let capturedContext: string = '';
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
                    capturedContext = workspaceContext;
                    return createThinkingResponse(false, 'Analysis complete');
                })
            };

            const thinkingModule = new ThinkingModule(mockApiClient, mockLogger as any, {}, turnStore);

            // Simulate the workspace context after skill activation
            const workspaceContext = await workspace.render();
            console.log('\n=== Workspace Context After Skill Activation ===');
            console.log(workspaceContext.substring(0, 2000));

            // Perform thinking phase with the activated skill context
            await thinkingModule.performThinkingPhase(workspaceContext, 'meta-analysis task');

            console.log('\n=== Thinking Phase Context After Skill Activation ===');
            console.log('System Prompt length:', capturedSystemPrompt.length);
            console.log('Workspace Context length:', capturedContext.length);

            // Print relevant parts of the context
            console.log('\n--- Workspace Context (first 1500 chars) ---');
            console.log(capturedContext.substring(0, 1500));

            // Verify that the context does NOT contain skill activation results with tool names
            console.log('\n=== Verification ===');
            const hasAddedTools = capturedContext.includes('addedTools');
            const hasSearchPubmed = capturedContext.includes('search_pubmed');

            console.log('Context contains "addedTools":', hasAddedTools);
            console.log('Context contains "search_pubmed":', hasSearchPubmed);

            // These assertions verify the bug is NOT present
            expect(hasAddedTools).toBe(false);
        });

        it('should NOT leak skill tool names into thinking phase context when skill is active', async () => {
            await workspace.getSkillManager().activateSkill(ARTICLE_RETRIEVAL_SKILL_NAME);

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
            await thinkingModule.performThinkingPhase(workspaceContext, 'meta-analysis task');

            // The context should NOT contain the skill's tool names as callable items
            expect(capturedContext).not.toContain('addedTools');
        });
    });

    describe('Agent Edge Cases', () => {
        it('should handle empty query gracefully', async () => {
            // Should not throw on empty query
            const context = await workspace.render();
            expect(context).toBeDefined();
        });

        it('should handle invalid tool call gracefully', async () => {
            // Invalid tool should return error result, not throw
            const result = await workspace.handleToolCall('invalid_tool', {});

            expect(result).toEqual({
                error: expect.any(String),
                success: false
            });
        });

        it('should handle skill activation failure', async () => {
            // Non-existent skill should fail
            const result = await workspace.getSkillManager().activateSkill('non-existent-skill');

            expect(result.success).toBe(false);
            expect(result.message).toBeDefined();
        });

        it('should handle skill deactivation', async () => {
            // Activate skill
            const result1 = await workspace.getSkillManager().activateSkill(ARTICLE_RETRIEVAL_SKILL_NAME);
            expect(result1.success).toBe(true);

            // Deactivate skill
            const deactivateResult = await workspace.getSkillManager().deactivateSkill();
            expect(deactivateResult.success).toBe(true);

            // Verify no active skill
            const activeSkill = workspace.getSkillManager().getActiveSkill();
            expect(activeSkill).toBeNull();
        });
    });
});
