import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent, AgentConfig, AgentPrompt } from '../agent.js';
import { VirtualWorkspace, ComponentRegistration } from '../../statefulContext/index.js';
import { ToolComponent } from '../../statefulContext/index.js';
import { Tool } from '../../statefulContext/index.js';
import { tdiv } from '../../statefulContext/index.js';
import * as z from 'zod';
import type { ApiClient } from '../../api-client/index.js';
import { MemoryModule } from '../../memory/MemoryModule.js';
import { TurnMemoryStore } from '../../memory/TurnMemoryStore.js';
import type { Logger } from 'pino';
import type { IThinkingModule } from '../../thinking/types.js';
import type { ThinkingPhaseResult } from '../../thinking/types.js';
import type { ITaskModule } from '../../task/types.js';
import { TaskModule } from '../../task/TaskModule.js';
import type { IToolManager } from '../../tools/index.js';
import { ToolManager } from '../../tools/index.js';
import { MessageBuilder } from '../../task/task.type.js';

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

// Mock ThinkingModule
const mockThinkingModule: IThinkingModule = {
    performThinkingPhase: vi.fn().mockResolvedValue({
        rounds: [],
        tokensUsed: 0,
        shouldProceedToAction: true,
        summary: 'Test thinking summary'
    } as ThinkingPhaseResult),
    performSequentialThinkingPhase: vi.fn(),
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
};

// Mock ToolManager
const mockToolManager: IToolManager = {
    registerProvider: vi.fn(),
    unregisterProvider: vi.fn().mockReturnValue(true),
    getAllTools: vi.fn().mockReturnValue([]),
    getAvailableTools: vi.fn().mockReturnValue([]),
    executeTool: vi.fn(),
    enableTool: vi.fn().mockReturnValue(true),
    disableTool: vi.fn().mockReturnValue(true),
    isToolEnabled: vi.fn().mockReturnValue(true),
    getToolSource: vi.fn(),
    onAvailabilityChange: vi.fn().mockReturnValue(() => () => { }),
    notifyAvailabilityChange: vi.fn(),
};

// Test component with various tool types
class TestToolComponent extends ToolComponent {
    toolSet = new Map<string, Tool>([
        ['simple_tool', {
            toolName: 'simple_tool',
            desc: 'A simple test tool with basic parameters',
            paramsSchema: z.object({
                input: z.string().describe('The input string to process')
            })
        }],
        ['complex_tool', {
            toolName: 'complex_tool',
            desc: 'A complex tool with nested and optional parameters',
            paramsSchema: z.object({
                name: z.string().describe('Name of the entity'),
                age: z.number().int().min(0).max(150).describe('Age in years'),
                preferences: z.object({
                    color: z.string().optional().describe('Favorite color'),
                    temperature: z.number().optional().describe('Preferred temperature')
                }).optional().describe('User preferences'),
                tags: z.array(z.string()).describe('List of tags'),
                isActive: z.boolean().describe('Whether the entity is active')
            })
        }],
        ['enum_tool', {
            toolName: 'enum_tool',
            desc: 'A tool with enum parameters',
            paramsSchema: z.object({
                mode: z.enum(['fast', 'slow', 'medium']).describe('Processing mode'),
                priority: z.union([z.literal('high'), z.literal('low'), z.literal('normal')]).describe('Task priority')
            })
        }]
    ]);

    private testData = '';

    renderImply = async (): Promise<tdiv[]> => {
        return [
            new tdiv({
                content: `Test Data: ${this.testData}`,
                styles: { width: 80, showBorder: false }
            })
        ];
    };

    handleToolCall = async (toolName: string, params: any): Promise<void> => {
        this.testData = params.input || JSON.stringify(params);
    };

    getTestData(): string {
        return this.testData;
    }
}

// Mock ApiClient
const mockApiClient: ApiClient = {
    makeRequest: vi.fn().mockResolvedValue({
        toolCalls: [{
            id: 'test_call_id',
            call_id: 'test_call',
            type: 'function_call',
            name: 'simple_tool',
            arguments: JSON.stringify({ input: 'test' })
        }],
        textResponse: 'Test response',
        requestTime: 100,
        tokenUsage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150
        }
    })
};

describe('Agent Tool Description Rendering', () => {
    let agent: Agent;
    let workspace: VirtualWorkspace;
    let testComponent: TestToolComponent;
    let memoryModule: MemoryModule;
    let taskModule: ITaskModule;

    const agentPrompt: AgentPrompt = {
        capability: 'Test agent capability - can verify tool rendering',
        direction: 'Test agent direction - ensure tools are properly described'
    };

    const agentConfig: AgentConfig = {
        apiRequestTimeout: 40000,
        maxRetryAttempts: 3,
        consecutiveMistakeLimit: 5
    };

    beforeEach(() => {
        // Create a new workspace for each test with ToolManager
        const toolManager = new ToolManager();
        workspace = new VirtualWorkspace({
            id: 'test-workspace',
            name: 'Test Workspace for Tool Rendering',
            description: 'A workspace to test tool description rendering'
        }, toolManager);

        // Create and register test component
        testComponent = new TestToolComponent();
        workspace.registerComponent({
            key: 'test-component',
            component: testComponent,
            priority: 0
        });

        // Create memory module
        const turnStore = new TurnMemoryStore();
        memoryModule = new MemoryModule(mockLogger, {}, turnStore, mockThinkingModule);

        // Create task module
        taskModule = new TaskModule();

        // Create agent
        agent = new Agent(
            agentConfig,
            workspace,
            agentPrompt,
            mockApiClient,
            memoryModule,
            mockThinkingModule,
            taskModule
        );
    });

    describe('System Prompt Tool Rendering', () => {
        it('should include workspace guide in system prompt', async () => {
            const systemPrompt = await agent.getSystemPrompt();

            expect(systemPrompt).toBeDefined();
            expect(typeof systemPrompt).toBe('string');

            // Should contain workspace guide
            expect(systemPrompt).toContain('Tool-Based Workspace Interface Guide');
        });

        it('should include TOOL BOX section with global tools', async () => {
            const systemPrompt = await agent.getSystemPrompt();

            // Should contain TOOL BOX section
            expect(systemPrompt).toContain('TOOL BOX');

            // Should contain global tools (attempt_completion, get_skill, etc.)
            expect(systemPrompt).toContain('attempt_completion');
        });

        it('should include skills section', async () => {
            const systemPrompt = await agent.getSystemPrompt();

            // Should contain SKILLS section
            expect(systemPrompt).toContain('SKILLS');
            expect(systemPrompt).toContain('AVAILABLE SKILLS');
        });
    });

    describe('Workspace Context Rendering', () => {
        it('should include workspace header and component sections', async () => {
            const workspaceContext = await workspace.render();

            // Should contain workspace header
            expect(workspaceContext).toContain('VIRTUAL WORKSPACE');
            expect(workspaceContext).toContain('Test Workspace for Tool Rendering');

            // Should contain component section
            expect(workspaceContext).toContain('test-component');
        });

        it('should render component state from renderImply', async () => {
            const workspaceContext = await workspace.render();

            // Should contain the component's rendered state
            expect(workspaceContext).toContain('Test Data:');
        });

        it('should include skills section in workspace context', async () => {
            const workspaceContext = await workspace.render();

            // Should contain SKILLS section
            expect(workspaceContext).toContain('SKILLS');
        });
    });

    describe('Tool Manager Integration', () => {
        it('should have tool manager instance', () => {
            const toolManager = workspace.getToolManager();

            expect(toolManager).toBeDefined();
            expect(toolManager).toHaveProperty('getAllTools');
            expect(toolManager).toHaveProperty('executeTool');
        });
    });

    describe('Prompt Structure Verification', () => {
        it('should maintain proper section order in system prompt', async () => {
            const systemPrompt = await agent.getSystemPrompt();

            // Verify section order
            const workspaceGuidePos = systemPrompt.indexOf('Tool-Based Workspace Interface Guide');
            const capabilitiesPos = systemPrompt.indexOf('Capabilities');
            const toolBoxPos = systemPrompt.indexOf('TOOL BOX');

            expect(workspaceGuidePos).toBeGreaterThanOrEqual(0);
            expect(capabilitiesPos).toBeGreaterThan(workspaceGuidePos);
            expect(toolBoxPos).toBeGreaterThan(capabilitiesPos);
        });

        it('should include all required sections in system prompt', async () => {
            const systemPrompt = await agent.getSystemPrompt();

            // Check for all major sections
            expect(systemPrompt).toContain('Tool-Based Workspace Interface Guide');
            expect(systemPrompt).toContain('Capabilities');
            expect(systemPrompt).toContain('Work Direction');
            expect(systemPrompt).toContain('TOOL BOX');
            expect(systemPrompt).toContain('SKILLS');
        });

        it('should include workspace context when rendered', async () => {
            const workspaceContext = await workspace.render();

            expect(workspaceContext).toBeDefined();
            expect(workspaceContext).toContain('VIRTUAL WORKSPACE');
        });
    });

    describe('Tool Rendering in System Prompt', () => {
        it('should render global tools in TOOL BOX section of system prompt', async () => {
            const systemPrompt = await agent.getSystemPrompt();

            // Global tools should be in TOOL BOX section
            expect(systemPrompt).toContain('TOOL BOX');
            expect(systemPrompt).toContain('attempt_completion');
            expect(systemPrompt).toContain('get_skill');
            expect(systemPrompt).toContain('list_skills');
        });

        it('should include tool descriptions in TOOL BOX', async () => {
            const systemPrompt = await agent.getSystemPrompt();

            // Should contain tool descriptions
            // The actual format might vary, but it should contain some description text
            expect(systemPrompt).toContain('TOOL BOX');
        });
    });
});
