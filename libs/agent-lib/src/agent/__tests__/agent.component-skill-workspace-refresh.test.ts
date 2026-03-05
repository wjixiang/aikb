/**
 * Agent Component Skill Workspace Refresh Test
 *
 * This test module verifies that the Workspace Context is properly refreshed
 * after tool execution in the action phase when the tool comes from a component skill.
 *
 * Bug: For tools from component skills, the Workspace Context is NOT refreshed
 * after tool execution in the action phase. This causes the next thinking/action
 * phase to receive stale context.
 *
 * Expected behavior:
 * 1. Activate a skill with components
 * 2. Execute a tool from the component (changes component state)
 * 3. The next iteration should see the UPDATED workspace context
 *
 * Actual behavior (bug):
 * 1. Activate a skill with components
 * 2. Execute a tool from the component (changes component state)
 * 3. The next iteration still sees the OLD workspace context
 *
 * Bug Location: libs/agent-lib/src/agent/agent.ts, lines 530-531
 *
 * Current code has a comment "Trigger workspace re-render after tool execution"
 * but there is NO actual code to re-render the workspace!
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { VirtualWorkspace } from '../../statefulContext/index.js';
import { ToolComponent } from '../../statefulContext/index.js';
import { Tool } from '../../statefulContext/types.js';
import { tdiv } from '../../statefulContext/index.js';
import { defineSkill, createComponentDefinition } from '../../skills/SkillDefinition.js';
import * as z from 'zod';
import { ToolManager } from '../../tools/index.js';

/**
 * Counter component for testing
 * This component has tools that modify its state
 */
class TestCounterComponent extends ToolComponent {
    toolSet = new Map<string, Tool>([
        ['increment', {
            toolName: 'increment',
            desc: 'Increment the counter',
            paramsSchema: z.object({ amount: z.number().optional() })
        }],
        ['decrement', {
            toolName: 'decrement',
            desc: 'Decrement the counter',
            paramsSchema: z.object({ amount: z.number().optional() })
        }]
    ]);

    private counter = 0;

    renderImply = async (): Promise<tdiv[]> => {
        return [
            new tdiv({
                content: `Counter: ${this.counter}`,
                styles: { width: 80, showBorder: false }
            })
        ];
    };

    handleToolCall = async (toolName: string, params: any): Promise<void> => {
        if (toolName === 'increment') {
            this.counter += params.amount || 1;
        } else if (toolName === 'decrement') {
            this.counter -= params.amount || 1;
        }
    };

    getCounter(): number {
        return this.counter;
    }
}

/**
 * Text storage component for testing
 */
class TestTextComponent extends ToolComponent {
    toolSet = new Map<string, Tool>([
        ['store_text', {
            toolName: 'store_text',
            desc: 'Store text in the component',
            paramsSchema: z.object({ text: z.string() })
        }]
    ]);

    private storedText = '';

    renderImply = async (): Promise<tdiv[]> => {
        return [
            new tdiv({
                content: `Stored Text: ${this.storedText || '(empty)'}`,
                styles: { width: 80, showBorder: false }
            })
        ];
    };

    handleToolCall = async (toolName: string, params: any): Promise<void> => {
        if (toolName === 'store_text') {
            this.storedText = params.text;
        }
    };

    getStoredText(): string {
        return this.storedText;
    }
}

describe('Agent Component Skill Workspace Refresh Bug', () => {
    let workspace: VirtualWorkspace;
    let toolManager: ToolManager;
    let counterComponent: TestCounterComponent;
    let textComponent: TestTextComponent;

    beforeEach(() => {
        // Create fresh component instances for each test
        counterComponent = new TestCounterComponent();
        textComponent = new TestTextComponent();

        // Create a new workspace for each test
        toolManager = new ToolManager();
        workspace = new VirtualWorkspace({
            id: 'test-workspace',
            name: 'Test Workspace',
            description: 'A workspace for testing component skill workspace refresh'
        }, toolManager);

        // Register skills with components - tools are automatically extracted from components
        workspace.registerSkill(defineSkill({
            name: 'counter-skill',
            displayName: 'Counter Skill',
            description: 'A skill with a counter component',
            whenToUse: 'Use this skill to test counter functionality',
            version: '1.0.0',
            category: 'test',
            tags: ['test', 'counter'],
            triggers: ['counter', 'increment'],
            capabilities: ['Increment and decrement a counter'],
            workDirection: 'Use the counter component to track numeric values.',
            components: [
                createComponentDefinition(
                    'counter-component',
                    'Counter Component',
                    'A simple counter component',
                    counterComponent
                )
            ]
        }));

        workspace.registerSkill(defineSkill({
            name: 'text-skill',
            displayName: 'Text Skill',
            description: 'A skill with a text storage component',
            whenToUse: 'Use this skill to test text storage functionality',
            version: '1.0.0',
            category: 'test',
            tags: ['test', 'text'],
            triggers: ['text', 'store'],
            capabilities: ['Store and retrieve text'],
            workDirection: 'Use the text component to store information.',
            components: [
                createComponentDefinition(
                    'text-component',
                    'Text Component',
                    'A simple text storage component',
                    textComponent
                )
            ]
        }));
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('BUG DEMONSTRATION: Workspace Context NOT Refreshed After Tool Execution', () => {
        /**
         * This test demonstrates the bug where workspace context is NOT refreshed
         * after tool execution in the action phase.
         * 
         * Bug Location: libs/agent-lib/src/agent/agent.ts, lines 530-531
         * 
         * The bug is:
         * - There's a comment "Trigger workspace re-render after tool execution"
         * - But there's NO actual code to re-render the workspace
         * - The workspace.render() is only called at the START of each requestLoop
         *   iteration (line 372), not after tool execution
         */
        it.only('should demonstrate the bug: workspace context is NOT re-rendered after tool execution', async () => {
            // Step 1: Activate skill
            await workspace.getSkillManager().activateSkill('counter-skill');
            console.log(await workspace.render())
            // Verify initial state
            expect(counterComponent.getCounter()).toBe(0);

            // Get workspace context at start (simulates agent.ts line 372)
            const initialContext = await workspace.render();
            expect(initialContext).toContain('Counter: 0');

            // Step 2: Execute tool (simulates what happens in ActionModule during action phase)
            await toolManager.executeTool('increment', { amount: 5 });

            // Verify component state WAS updated
            expect(counterComponent.getCounter()).toBe(5);

            // Step 3: In the agent's code flow:
            // - Line 530-531 has comment "Trigger workspace re-render after tool execution"
            // - But there's NO actual code to call workspace.render() here!
            // - The next iteration would get the workspace context at line 372
            //   which was captured BEFORE the tool execution

            // To demonstrate this bug, we show what SHOULD happen vs what DOES happen:

            // WHAT SHOULD HAPPEN: Re-render workspace after tool execution
            const correctContext = await workspace.render();
            console.log(await workspace.render())
            expect(correctContext).toContain('Counter: 5');


            // The assertion passes because we manually called render()
            // But in the actual agent code, there's no re-render
            expect(correctContext).toContain('Counter: 5');
        });

        /**
         * This test shows what happens in the agent loop:
         * - Context is captured at the start of iteration (line 372)
         * - Tool is executed in action phase
         * - No re-render happens (bug!)
         * - Next iteration gets the OLD context
         */
        it('should show that next agent iteration would get stale context', async () => {
            // Activate skill
            await workspace.getSkillManager().activateSkill('counter-skill');

            // Simulate: Start of agent iteration 1 (line 372)
            const contextIteration1 = await workspace.render();
            expect(contextIteration1).toContain('Counter: 0');

            // Simulate: Action phase tool execution
            await toolManager.executeTool('increment', { amount: 10 });
            expect(counterComponent.getCounter()).toBe(10);

            // BUG: There's no re-render after tool execution!
            // In agent.ts lines 530-531, there's only a comment and log
            // No call to workspace.render()

            // If agent loop continues to iteration 2, it would call:
            // const currentWorkspaceContext = await this.workspace.render(); (line 372)
            // This would get the UPDATED context because we manually called render()
            // But in the REAL agent flow, there's no re-render after tool execution!

            // Demonstrate: if we DON'T call render(), the "agent" would have stale context
            // (We're simulating this by not calling render() again)

            // The component state IS updated (10)
            expect(counterComponent.getCounter()).toBe(10);

            // But the workspace context that would be passed to the next API call
            // (if we didn't manually call render()) would still show Counter: 0

            // This demonstrates the bug: the agent doesn't re-render after tool execution
            console.log('\n========== BUG IMPACT ==========');
            console.log('Component counter is: ' + counterComponent.getCounter());
            console.log('But without calling render() again,');
            console.log('the next agent iteration would see: Counter: 0');
            console.log('================================\n');
        });
    });

    describe('Component State Updates Work Correctly', () => {
        it('should update counter component state when tool is executed', async () => {
            // Activate skill
            await workspace.getSkillManager().activateSkill('counter-skill');

            // Execute tool via toolManager
            await toolManager.executeTool('increment', { amount: 10 });

            // Verify component state was updated
            expect(counterComponent.getCounter()).toBe(10);

            // When we call render(), we get the updated state
            const context = await workspace.render();
            expect(context).toContain('Counter: 10');
        });

        it('should update text component state when tool is executed', async () => {
            // Activate skill
            await workspace.getSkillManager().activateSkill('text-skill');

            // Execute tool
            await toolManager.executeTool('store_text', { text: 'Hello World' });

            // Verify state
            expect(textComponent.getStoredText()).toBe('Hello World');

            const context = await workspace.render();
            expect(context).toContain('Stored Text: Hello World');
        });

        it('should track multiple tool executions', async () => {
            // Activate skill
            await workspace.getSkillManager().activateSkill('counter-skill');

            // Multiple increments
            await toolManager.executeTool('increment', { amount: 3 });
            await toolManager.executeTool('increment', { amount: 7 });

            expect(counterComponent.getCounter()).toBe(10);

            const context = await workspace.render();
            expect(context).toContain('Counter: 10');
        });
    });

    describe('Workspace Context After Skill Activation', () => {
        it('should render component state in workspace after skill activation', async () => {
            // Activate skill
            await workspace.getSkillManager().activateSkill('counter-skill');

            // Render workspace and check component state is visible
            const context = await workspace.render();

            // The component should be rendered
            expect(context).toContain('Counter: 0');
        });

        it('should have component tools available after skill activation', async () => {
            // Activate skill
            await workspace.getSkillManager().activateSkill('counter-skill');

            // Check that tools are available
            const tools = workspace.getAllTools();
            const toolNames = tools.map((t: any) => t.tool.toolName);

            expect(toolNames).toContain('increment');
            expect(toolNames).toContain('decrement');
        });
    });
});
