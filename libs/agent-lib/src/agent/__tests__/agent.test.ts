import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent, AgentConfig, AgentPrompt } from '../agent.js';
import { VirtualWorkspace, ComponentRegistration } from 'stateful-context';
import { ToolComponent } from 'stateful-context';
import { Tool } from 'stateful-context';
import { tdiv } from 'stateful-context';
import * as z from 'zod';
import type { ApiClient } from '../../api-client/index.js';

// Define Skill interface locally since agent-lib doesn't directly depend on skills
interface Skill {
    name: string;
    displayName: string;
    description: string;
    triggers?: string[];
    prompt: {
        capability: string;
        direction: string;
    };
    tools?: Tool[];
    onActivate?: () => Promise<void>;
    onDeactivate?: () => Promise<void>;
}

// Mock ApiClient
const mockApiClient: ApiClient = {
    makeRequest: vi.fn().mockResolvedValue({
        toolCalls: [],
        textResponse: 'Test response',
        requestTime: 100,
        tokenUsage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150
        }
    })
};

// Test component implementation
class TestToolComponent extends ToolComponent {
    toolSet = new Map<string, Tool>([
        ['test_tool', {
            toolName: 'test_tool',
            desc: 'A test tool',
            paramsSchema: z.object({ input: z.string() })
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
        if (toolName === 'test_tool') {
            this.testData = params.input;
        }
    };

    getTestData(): string {
        return this.testData;
    }
}

// Test skill
const testSkill: Skill = {
    name: 'test-skill',
    displayName: 'Test Skill',
    description: 'A test skill for unit testing',
    triggers: ['test', 'testing'],
    prompt: {
        capability: 'Test skill capability - enhances agent with test-specific abilities',
        direction: 'Test skill direction - follow these guidelines when testing'
    }
};

describe('Agent Context Rendering', () => {
    let agent: Agent;
    let workspace: VirtualWorkspace;
    let testComponent: TestToolComponent;
    const agentPrompt: AgentPrompt = {
        capability: 'Base agent capability - can perform general tasks',
        direction: 'Base agent direction - follow standard operating procedures'
    };
    const agentConfig: AgentConfig = {
        apiRequestTimeout: 40000,
        maxRetryAttempts: 3,
        consecutiveMistakeLimit: 5
    };

    beforeEach(() => {
        // Create a new workspace for each test
        workspace = new VirtualWorkspace({
            id: 'test-workspace',
            name: 'Test Workspace',
            description: 'A workspace for testing'
        });

        // Create and register test component
        testComponent = new TestToolComponent();
        workspace.registerComponent({
            key: 'test-component',
            component: testComponent,
            priority: 0
        });

        // Register test skill
        workspace.registerSkill(testSkill);

        // Create agent
        agent = new Agent(
            agentConfig,
            workspace,
            agentPrompt,
            mockApiClient,
            'test-task-id'
        );
    });

    describe('renderAgentPrompt', () => {
        it('should render base agent prompt without active skill', () => {
            const prompt = agent.renderAgentPrompt();

            expect(prompt).toContain('Base agent capability - can perform general tasks');
            expect(prompt).toContain('Base agent direction - follow standard operating procedures');
            expect(prompt).not.toContain('--- Skill Enhancement ---');
            expect(prompt).not.toContain('--- Skill Guidance ---');
        });

        it('should include skill enhancement when skill is active', async () => {
            // Activate the test skill
            await workspace.getSkillManager().activateSkill('test-skill');

            const prompt = agent.renderAgentPrompt();

            expect(prompt).toContain('Base agent capability - can perform general tasks');
            expect(prompt).toContain('--- Skill Enhancement ---');
            expect(prompt).toContain('Test skill capability - enhances agent with test-specific abilities');

            expect(prompt).toContain('Base agent direction - follow standard operating procedures');
            expect(prompt).toContain('--- Skill Guidance ---');
            expect(prompt).toContain('Test skill direction - follow these guidelines when testing');
        });

        it('should have proper section headers', async () => {
            await workspace.getSkillManager().activateSkill('test-skill');

            const prompt = agent.renderAgentPrompt();

            expect(prompt).toContain('------------');
            expect(prompt).toContain('Capabilities');
            expect(prompt).toContain('--------------');
            expect(prompt).toContain('Work Direction');
        });
    });

    describe('getSystemPrompt', () => {
        it('should include workspace guide', async () => {
            const systemPrompt = await agent.getSystemPrompt();

            expect(systemPrompt).toBeDefined();
            expect(typeof systemPrompt).toBe('string');
            expect(systemPrompt.length).toBeGreaterThan(0);
        });

        it('should include agent prompt', async () => {
            const systemPrompt = await agent.getSystemPrompt();

            expect(systemPrompt).toContain('Base agent capability');
            expect(systemPrompt).toContain('Base agent direction');
        });

        it('should include tool box with registered tools', async () => {
            const systemPrompt = await agent.getSystemPrompt();

            expect(systemPrompt).toContain('TOOL BOX');
            expect(systemPrompt).toContain('test_tool');
            expect(systemPrompt).toContain('A test tool');
        });

        it('should include skills section when skills are registered', async () => {
            const systemPrompt = await agent.getSystemPrompt();

            expect(systemPrompt).toContain('SKILLS');
            expect(systemPrompt).toContain('AVAILABLE SKILLS');
            expect(systemPrompt).toContain('test-skill');
            expect(systemPrompt).toContain('A test skill for unit testing');
        });

        it('should show active skill indicator when skill is activated', async () => {
            await workspace.getSkillManager().activateSkill('test-skill');

            const systemPrompt = await agent.getSystemPrompt();

            expect(systemPrompt).toContain('Active: Test Skill');
        });

        it('should include skill prompt in system prompt when skill is active', async () => {
            await workspace.getSkillManager().activateSkill('test-skill');

            const systemPrompt = await agent.getSystemPrompt();

            expect(systemPrompt).toContain('--- Skill Enhancement ---');
            expect(systemPrompt).toContain('Test skill capability - enhances agent with test-specific abilities');
            expect(systemPrompt).toContain('--- Skill Guidance ---');
            expect(systemPrompt).toContain('Test skill direction - follow these guidelines when testing');
        });

        it('should maintain proper structure with all sections', async () => {
            await workspace.getSkillManager().activateSkill('test-skill');

            const systemPrompt = await agent.getSystemPrompt();

            // Check that all major sections are present
            expect(systemPrompt).toContain('Capabilities');
            expect(systemPrompt).toContain('Work Direction');
            expect(systemPrompt).toContain('TOOL BOX');
            expect(systemPrompt).toContain('SKILLS');

            // Check order: workspace guide -> agent prompt -> tool box -> skills
            const workspaceGuidePos = systemPrompt.indexOf('WORKSPACE GUIDE');
            const capabilitiesPos = systemPrompt.indexOf('Capabilities');
            const toolBoxPos = systemPrompt.indexOf('TOOL BOX');
            const skillsPos = systemPrompt.indexOf('SKILLS');

            expect(workspaceGuidePos).toBeLessThan(capabilitiesPos);
            expect(capabilitiesPos).toBeLessThan(toolBoxPos);
            expect(toolBoxPos).toBeLessThan(skillsPos);
        });
    });

    describe('Skill Integration', () => {
        it('should get skill prompt enhancement from workspace', async () => {
            await workspace.getSkillManager().activateSkill('test-skill');

            const skillPrompt = workspace.getSkillPrompt();

            expect(skillPrompt).not.toBeNull();
            expect(skillPrompt?.capability).toBe('Test skill capability - enhances agent with test-specific abilities');
            expect(skillPrompt?.direction).toBe('Test skill direction - follow these guidelines when testing');
        });

        it('should return null when no skill is active', () => {
            const skillPrompt = workspace.getSkillPrompt();

            expect(skillPrompt).toBeNull();
        });

        it('should merge skill prompt with base prompt correctly', async () => {
            await workspace.getSkillManager().activateSkill('test-skill');

            const prompt = agent.renderAgentPrompt();
            const lines = prompt.split('\n');

            // Find the capability section
            const capabilityStart = lines.findIndex(line => line.includes('Capabilities'));
            const capabilityEnd = lines.findIndex(line => line.includes('Work Direction'));
            const capabilitySection = lines.slice(capabilityStart, capabilityEnd).join('\n');

            // Verify base capability comes first
            expect(capabilitySection.indexOf('Base agent capability')).toBeLessThan(
                capabilitySection.indexOf('--- Skill Enhancement ---')
            );

            // Verify skill enhancement is present
            expect(capabilitySection).toContain('--- Skill Enhancement ---');
            expect(capabilitySection).toContain('Test skill capability');
        });
    });

    describe('Workspace Context', () => {
        it('should render workspace with registered components', async () => {
            const workspaceRender = await workspace.render();

            expect(workspaceRender).toContain('VIRTUAL WORKSPACE: Test Workspace');
            expect(workspaceRender).toContain('test-component');
            expect(workspaceRender).toContain('Test Data:');
        });

        it('should render tool box with global tools', async () => {
            const toolBoxRender = workspace.renderToolBox().render();

            expect(toolBoxRender).toContain('TOOL BOX');
            expect(toolBoxRender).toContain('GLOBAL TOOLS');
            expect(toolBoxRender).toContain('attempt_completion');
            expect(toolBoxRender).toContain('get_skill');
            expect(toolBoxRender).toContain('list_skills');
            expect(toolBoxRender).toContain('deactivate_skill');
        });

        it('should render skills section', () => {
            const skillsSection = workspace.renderSkillsSection().render();

            expect(skillsSection).toContain('SKILLS');
            expect(skillsSection).toContain('AVAILABLE SKILLS');
            expect(skillsSection).toContain('test-skill: A test skill for unit testing');
        });
    });

    describe('Context Integration', () => {
        it('should provide complete context for LLM', async () => {
            await workspace.getSkillManager().activateSkill('test-skill');

            const systemPrompt = await agent.getSystemPrompt();

            // Verify all context elements are present
            expect(systemPrompt).toContain('Tool-Based Workspace Interface Guide'); // From generateWorkspaceGuide()
            expect(systemPrompt).toContain('Capabilities'); // From renderAgentPrompt()
            expect(systemPrompt).toContain('Base agent capability'); // Base capability
            expect(systemPrompt).toContain('Test skill capability'); // Skill capability
            expect(systemPrompt).toContain('Work Direction'); // From renderAgentPrompt()
            expect(systemPrompt).toContain('Base agent direction'); // Base direction
            expect(systemPrompt).toContain('Test skill direction'); // Skill direction
            expect(systemPrompt).toContain('TOOL BOX'); // From renderToolBox()
            expect(systemPrompt).toContain('test_tool'); // Component tool
            expect(systemPrompt).toContain('SKILLS'); // From renderSkillsSection()
            expect(systemPrompt).toContain('Active: Test Skill'); // Active skill indicator
        });

        it('should handle skill activation and deactivation', async () => {
            // Get prompt without skill
            let systemPrompt = await agent.getSystemPrompt();
            expect(systemPrompt).not.toContain('Test skill capability');
            expect(systemPrompt).not.toContain('Active: Test Skill');

            // Activate skill
            await workspace.getSkillManager().activateSkill('test-skill');
            systemPrompt = await agent.getSystemPrompt();
            expect(systemPrompt).toContain('Test skill capability');
            expect(systemPrompt).toContain('Active: Test Skill');

            // Deactivate skill
            await workspace.getSkillManager().deactivateSkill();
            systemPrompt = await agent.getSystemPrompt();
            expect(systemPrompt).not.toContain('Test skill capability');
            expect(systemPrompt).not.toContain('Active: Test Skill');
        });
    });
});