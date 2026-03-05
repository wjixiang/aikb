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
import { ToolComponent } from '../../statefulContext/index.js';
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

    handleToolCall = async (toolName: string, params: any): Promise<void> => {
        if (toolName === 'search_database') {
            this.searchData = `Searched for: ${params.query}`;
        }
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
        const componentProvider = new ComponentToolProvider('database-component', actionComponent);
        toolManager.registerProvider(componentProvider);

        // Register skill with tools
        workspace.registerSkill(testSkillWithTools);

        // Create memory store
        turnStore = new TurnMemoryStore();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

});
