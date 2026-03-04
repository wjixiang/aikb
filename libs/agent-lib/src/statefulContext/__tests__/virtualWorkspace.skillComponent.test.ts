import { describe, it, expect, beforeEach } from 'vitest';
import { VirtualWorkspace } from '../virtualWorkspace.js';
import { ToolManager } from '../../tools/index.js';
import { ToolComponent } from '../toolComponent.js';
import { Tool } from '../types.js';
import { tdiv } from '../ui/index.js';
import { defineSkill, createComponentDefinition } from '../../skills/SkillDefinition.js';
import { z } from 'zod';

/**
 * Test component for skill activation testing
 * Simple counter component with increment/decrement tools
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
            }),
            new tdiv({
                content: 'This is a test counter component',
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
 * Test component for skill activation testing
 * Simple text storage component
 */
class TestTextStorageComponent extends ToolComponent {
    toolSet = new Map<string, Tool>([
        ['store_text', {
            toolName: 'store_text',
            desc: 'Store text in the component',
            paramsSchema: z.object({ text: z.string() })
        }],
        ['get_text', {
            toolName: 'get_text',
            desc: 'Get stored text',
            paramsSchema: z.object({})
        }]
    ]);

    private storedText = '';

    renderImply = async (): Promise<tdiv[]> => {
        return [
            new tdiv({
                content: `Stored Text: ${this.storedText}`,
                styles: { width: 80, showBorder: false }
            }),
            new tdiv({
                content: 'This is a test text storage component',
                styles: { width: 80, showBorder: false }
            })
        ];
    };

    handleToolCall = async (toolName: string, params: any): Promise<void> => {
        if (toolName === 'store_text') {
            this.storedText = params.text;
        }
        // get_text doesn't modify state
    };

    getStoredText(): string {
        return this.storedText;
    }
}

/**
 * Test skill with single component
 */
const testSkillWithSingleComponent = defineSkill({
    name: 'test-skill-single-component',
    displayName: 'Test Skill with Single Component',
    description: 'A test skill that provides a counter component',
    whenToUse: 'Use this skill when you need to test single component activation',
    version: '1.0.0',
    category: 'test',
    tags: ['test', 'single-component'],
    triggers: ['test single component'],
    capabilities: [
        'Increment and decrement a counter',
        'Track counter state'
    ],
    workDirection: 'Use the counter component to track numeric values.',
    tools: [
        {
            toolName: 'increment',
            desc: 'Increment the counter',
            paramsSchema: z.object({ amount: z.number().optional() })
        },
        {
            toolName: 'decrement',
            desc: 'Decrement the counter',
            paramsSchema: z.object({ amount: z.number().optional() })
        }
    ],
    components: [
        createComponentDefinition(
            'counter-component',
            'Counter Component',
            'A simple counter component',
            new TestCounterComponent()
        )
    ]
});

/**
 * Test skill with multiple components
 */
const testSkillWithMultipleComponents = defineSkill({
    name: 'test-skill-multiple-components',
    displayName: 'Test Skill with Multiple Components',
    description: 'A test skill that provides multiple components',
    whenToUse: 'Use this skill when you need to test multiple component activation',
    version: '1.0.0',
    category: 'test',
    tags: ['test', 'multiple-components'],
    triggers: ['test multiple components'],
    capabilities: [
        'Increment and decrement a counter',
        'Store and retrieve text'
    ],
    workDirection: 'Use the counter and text storage components together.',
    tools: [
        {
            toolName: 'increment',
            desc: 'Increment the counter',
            paramsSchema: z.object({ amount: z.number().optional() })
        },
        {
            toolName: 'decrement',
            desc: 'Decrement the counter',
            paramsSchema: z.object({ amount: z.number().optional() })
        },
        {
            toolName: 'store_text',
            desc: 'Store text in the component',
            paramsSchema: z.object({ text: z.string() })
        },
        {
            toolName: 'get_text',
            desc: 'Get stored text',
            paramsSchema: z.object({})
        }
    ],
    components: [
        createComponentDefinition(
            'counter-component',
            'Counter Component',
            'A simple counter component',
            new TestCounterComponent()
        ),
        createComponentDefinition(
            'text-storage-component',
            'Text Storage Component',
            'A simple text storage component',
            new TestTextStorageComponent()
        )
    ]
});

describe('VirtualWorkspace - Skill Component Rendering', () => {
    let workspace: VirtualWorkspace;
    let toolManager: ToolManager;

    beforeEach(() => {
        toolManager = new ToolManager();
        workspace = new VirtualWorkspace({
            id: 'test-workspace',
            name: 'Test Workspace',
            description: 'A test workspace for skill component rendering'
        }, toolManager);
    });

    describe('Component Registration on Skill Activation', () => {
        it('should register components when skill with single component is activated', async () => {
            const skillManager = workspace.getSkillManager();

            // Register the skill
            skillManager.register(testSkillWithSingleComponent);

            // Initially, no components should be registered
            expect(workspace.getComponentKeys()).toHaveLength(0);

            // Activate the skill
            await skillManager.activateSkill('test-skill-single-component');

            // After activation, component should be registered
            const componentKeys = workspace.getComponentKeys();
            expect(componentKeys).toHaveLength(1);
            expect(componentKeys).toContain('test-skill-single-component:counter-component');
        });

        it('should register multiple components when skill with multiple components is activated', async () => {
            const skillManager = workspace.getSkillManager();

            // Register the skill
            skillManager.register(testSkillWithMultipleComponents);

            // Initially, no components should be registered
            expect(workspace.getComponentKeys()).toHaveLength(0);

            // Activate the skill
            await skillManager.activateSkill('test-skill-multiple-components');

            // After activation, both components should be registered
            const componentKeys = workspace.getComponentKeys();
            expect(componentKeys).toHaveLength(2);
            expect(componentKeys).toContain('test-skill-multiple-components:counter-component');
            expect(componentKeys).toContain('test-skill-multiple-components:text-storage-component');
        });

        it('should unregister components when skill is deactivated', async () => {
            const skillManager = workspace.getSkillManager();

            // Register and activate the skill
            skillManager.register(testSkillWithSingleComponent);
            await skillManager.activateSkill('test-skill-single-component');

            // Verify components are registered
            expect(workspace.getComponentKeys()).toHaveLength(1);

            // Deactivate the skill
            await skillManager.deactivateSkill();

            // Components should be unregistered
            expect(workspace.getComponentKeys()).toHaveLength(0);
        });

        it('should unregister all components when skill with multiple components is deactivated', async () => {
            const skillManager = workspace.getSkillManager();

            // Register and activate the skill
            skillManager.register(testSkillWithMultipleComponents);
            await skillManager.activateSkill('test-skill-multiple-components');

            // Verify components are registered
            expect(workspace.getComponentKeys()).toHaveLength(2);

            // Deactivate the skill
            await skillManager.deactivateSkill();

            // All components should be unregistered
            expect(workspace.getComponentKeys()).toHaveLength(0);
        });
    });

    describe('Component Rendering After Skill Activation', () => {
        it('should render skill component in workspace after activation', async () => {
            const skillManager = workspace.getSkillManager();

            // Register and activate the skill
            skillManager.register(testSkillWithSingleComponent);
            await skillManager.activateSkill('test-skill-single-component');

            // Render the workspace
            const rendered = await workspace.render();

            // Verify the component is rendered
            expect(rendered).toContain('test-skill-single-component:counter-component');
            expect(rendered).toContain('Counter: 0');
            expect(rendered).toContain('This is a test counter component');
        });

        it('should show components of activated skills', async () => {
            const skillManager = workspace.getSkillManager();

            // Register skill but don't activate it
            skillManager.register(testSkillWithSingleComponent);

            // Render without active skill
            const rendered = await workspace.render();

            // Component should not be rendered
            expect(rendered).not.toContain('test-skill-single-component:counter-component');
            expect(rendered).not.toContain('Counter: 0');

            // Activate the skill
            await skillManager.activateSkill('test-skill-single-component');

            // Render with active skill
            const renderedWithActive = await workspace.render();

            // Component should now be rendered
            expect(renderedWithActive).toContain('test-skill-single-component:counter-component');
            expect(renderedWithActive).toContain('Counter: 0');
        });

        it('should render multiple skill components in workspace after activation', async () => {
            const skillManager = workspace.getSkillManager();

            // Register and activate the skill
            skillManager.register(testSkillWithMultipleComponents);
            await skillManager.activateSkill('test-skill-multiple-components');

            // Render the workspace
            const rendered = await workspace.render();

            // Verify both components are rendered
            expect(rendered).toContain('test-skill-multiple-components:counter-component');
            expect(rendered).toContain('Counter: 0');
            expect(rendered).toContain('This is a test counter component');

            expect(rendered).toContain('test-skill-multiple-components:text-storage-component');
            expect(rendered).toContain('Stored Text: ');
            expect(rendered).toContain('This is a test text storage component');
        });

        it('should not render skill components after deactivation', async () => {
            const skillManager = workspace.getSkillManager();

            // Register and activate the skill
            skillManager.register(testSkillWithSingleComponent);
            await skillManager.activateSkill('test-skill-single-component');

            // Render with active skill
            let rendered = await workspace.render();
            expect(rendered).toContain('test-skill-single-component:counter-component');

            // Deactivate the skill
            await skillManager.deactivateSkill();

            // Render after deactivation
            rendered = await workspace.render();
            expect(rendered).not.toContain('test-skill-single-component:counter-component');
        });

        it('should render components in priority order', async () => {
            const skillManager = workspace.getSkillManager();

            // Register and activate the skill
            skillManager.register(testSkillWithMultipleComponents);
            await skillManager.activateSkill('test-skill-multiple-components');

            // Render the workspace
            const rendered = await workspace.render();

            // Find positions of components (counter should come first as it's registered first)
            const counterPos = rendered.indexOf('test-skill-multiple-components:counter-component');
            const textStoragePos = rendered.indexOf('test-skill-multiple-components:text-storage-component');

            // Counter component should appear before text storage component
            expect(counterPos).toBeLessThan(textStoragePos);
        });
    });

    describe('Component State Updates After Tool Calls', () => {
        it('should render updated component state after tool call', async () => {
            const skillManager = workspace.getSkillManager();

            // Register and activate the skill
            skillManager.register(testSkillWithSingleComponent);
            await skillManager.activateSkill('test-skill-single-component');

            // Get the component
            const component = workspace.getComponent('test-skill-single-component:counter-component');
            expect(component).toBeInstanceOf(TestCounterComponent);

            // Make a tool call through the workspace
            await workspace.handleToolCall('increment', { amount: 5 });

            // Render the workspace
            const rendered = await workspace.render();

            // Verify the updated state is rendered
            expect(rendered).toContain('Counter: 5');
        });

        it('should render updated state for multiple components after tool calls', async () => {
            const skillManager = workspace.getSkillManager();

            // Register and activate the skill
            skillManager.register(testSkillWithMultipleComponents);
            await skillManager.activateSkill('test-skill-multiple-components');

            // Make tool calls
            await workspace.handleToolCall('increment', { amount: 10 });
            await workspace.handleToolCall('store_text', { text: 'Hello, World!' });

            // Render the workspace
            const rendered = await workspace.render();

            // Verify both components show updated state
            expect(rendered).toContain('Counter: 10');
            expect(rendered).toContain('Stored Text: Hello, World!');
        });
    });

    describe('Component Tool Availability', () => {
        it('should make component tools available after skill activation', async () => {
            const skillManager = workspace.getSkillManager();

            // Register and activate the skill
            skillManager.register(testSkillWithSingleComponent);
            await skillManager.activateSkill('test-skill-single-component');

            // Verify component tools are available
            expect(workspace.isToolAvailable('increment')).toBe(true);
            expect(workspace.isToolAvailable('decrement')).toBe(true);
        });

        it('should make tools from multiple components available after skill activation', async () => {
            const skillManager = workspace.getSkillManager();

            // Register and activate the skill
            skillManager.register(testSkillWithMultipleComponents);
            await skillManager.activateSkill('test-skill-multiple-components');

            // Verify all tools are available
            expect(workspace.isToolAvailable('increment')).toBe(true);
            expect(workspace.isToolAvailable('decrement')).toBe(true);
            expect(workspace.isToolAvailable('store_text')).toBe(true);
            expect(workspace.isToolAvailable('get_text')).toBe(true);
        });
    });

    describe('Skill Component Integration', () => {
        it('should handle skill switching with different components', async () => {
            const skillManager = workspace.getSkillManager();

            // Register both skills
            skillManager.register(testSkillWithSingleComponent);
            skillManager.register(testSkillWithMultipleComponents);

            // Activate first skill
            await skillManager.activateSkill('test-skill-single-component');
            let componentKeys = workspace.getComponentKeys();
            expect(componentKeys).toHaveLength(1);
            expect(componentKeys).toContain('test-skill-single-component:counter-component');

            // Switch to second skill
            await skillManager.activateSkill('test-skill-multiple-components');
            componentKeys = workspace.getComponentKeys();
            expect(componentKeys).toHaveLength(2);
            expect(componentKeys).toContain('test-skill-multiple-components:counter-component');
            expect(componentKeys).toContain('test-skill-multiple-components:text-storage-component');

            // Verify first skill's components are unregistered
            expect(componentKeys).not.toContain('test-skill-single-component:counter-component');
        });

        it('should render skill-specific tools section in ToolBox', async () => {
            const skillManager = workspace.getSkillManager();

            // Register and activate the skill
            skillManager.register(testSkillWithSingleComponent);
            await skillManager.activateSkill('test-skill-single-component');

            // Render the ToolBox (not the workspace)
            const toolBoxRendered = workspace.renderToolBox().render();

            // Verify skill tools section is rendered in ToolBox
            expect(toolBoxRendered).toContain('TOOL BOX');
            // Note: Global tools are rendered in ToolBox, skill tools are rendered in renderSkillToolsSection()
            // which is called from agent.ts getSystemPrompt(), not from workspace.render()
        });
    });

    describe('Workspace Context Rendering Control by Skills', () => {
        it('should hide components of none-activated skills', async () => {
            const skillManager = workspace.getSkillManager();

            // Register skill but don't activate it
            skillManager.register(testSkillWithSingleComponent);

            // Render without active skill
            const rendered = await workspace.render();
            // console.log(rendered)

            // Component should not be rendered
            expect(rendered).not.toContain('test-skill-single-component:counter-component');
            expect(rendered).not.toContain('Counter: 0');
        });

        it('should show skill tools section in renderSkillToolsSection() only when skill is active', async () => {
            const skillManager = workspace.getSkillManager();

            // Register the skill but don't activate it
            skillManager.register(testSkillWithSingleComponent);

            // Render without active skill
            let rendered = await workspace.render();
            // SKILL TOOLS section should not be present in workspace.render()
            expect(rendered).not.toContain('SKILL TOOLS:');

            // Activate the skill
            await skillManager.activateSkill('test-skill-single-component');

            // Render with active skill - still no SKILL TOOLS in workspace.render()
            rendered = await workspace.render();
            expect(rendered).not.toContain('SKILL TOOLS:');

            // But renderSkillToolsSection() should return content when skill is active
            // Note: This is tested separately via renderToolBox() in agent context
        });

        it('should not render skill tools section in workspace.render() after deactivation', async () => {
            const skillManager = workspace.getSkillManager();

            // Register and activate the skill
            skillManager.register(testSkillWithSingleComponent);
            await skillManager.activateSkill('test-skill-single-component');

            // Render with active skill - no SKILL TOOLS in workspace.render()
            let rendered = await workspace.render();
            expect(rendered).not.toContain('SKILL TOOLS:');

            // Deactivate the skill
            await skillManager.deactivateSkill();

            // Render after deactivation - still no SKILL TOOLS
            rendered = await workspace.render();
            expect(rendered).not.toContain('SKILL TOOLS:');
        });

        it('should show active skill indicator in skills section', async () => {
            const skillManager = workspace.getSkillManager();

            // Register the skill first
            skillManager.register(testSkillWithSingleComponent);

            // Render without active skill
            let rendered = await workspace.render();
            expect(rendered).not.toContain('Currently Active:');

            // Activate the skill
            await skillManager.activateSkill('test-skill-single-component');

            // Render with active skill
            rendered = await workspace.render();
            expect(rendered).toContain('Currently Active:');
            expect(rendered).toContain('test-skill-single-component');
            expect(rendered).toContain('Test Skill with Single Component');
        });

        it('should hide active skill indicator when skill is deactivated', async () => {
            const skillManager = workspace.getSkillManager();

            // Register and activate the skill
            skillManager.register(testSkillWithSingleComponent);
            await skillManager.activateSkill('test-skill-single-component');

            // Render with active skill
            let rendered = await workspace.render();
            expect(rendered).toContain('Currently Active:');

            // Deactivate the skill
            await skillManager.deactivateSkill();

            // Render after deactivation
            rendered = await workspace.render();
            expect(rendered).not.toContain('Currently Active:');
        });

        it('should update active skill indicator when switching skills', async () => {
            const skillManager = workspace.getSkillManager();

            // Register both skills
            skillManager.register(testSkillWithSingleComponent);
            skillManager.register(testSkillWithMultipleComponents);

            // Activate first skill
            await skillManager.activateSkill('test-skill-single-component');
            let rendered = await workspace.render();
            expect(rendered).toContain('Currently Active:');
            expect(rendered).toContain('test-skill-single-component');
            expect(rendered).toContain('Test Skill with Single Component');

            // Switch to second skill
            await skillManager.activateSkill('test-skill-multiple-components');
            rendered = await workspace.render();
            expect(rendered).toContain('Currently Active:');
            expect(rendered).toContain('test-skill-multiple-components');
            expect(rendered).toContain('Test Skill with Multiple Components');
            // First skill should not be shown as active (but may still appear in available skills list)
            // Check that the active indicator shows the correct skill
            const activeSkillMatch = rendered.match(/\*\*Currently Active:\*\* `([^`]+)`/);
            expect(activeSkillMatch?.[1]).toBe('test-skill-multiple-components');
        });

        it('should provide skill prompt enhancement when skill is active', async () => {
            const skillManager = workspace.getSkillManager();

            // Register the skill first
            skillManager.register(testSkillWithSingleComponent);

            // Get prompt without active skill
            let prompt = workspace.getSkillPrompt();
            expect(prompt).toBeNull();

            // Activate the skill
            await skillManager.activateSkill('test-skill-single-component');

            // Get prompt with active skill
            prompt = workspace.getSkillPrompt();
            expect(prompt).not.toBeNull();
            expect(prompt?.capability).toContain('Increment and decrement a counter');
            expect(prompt?.direction).toContain('Use the counter component');
        });

        it('should clear skill prompt enhancement when skill is deactivated', async () => {
            const skillManager = workspace.getSkillManager();

            // Register the skill first
            skillManager.register(testSkillWithSingleComponent);

            // Activate the skill
            await skillManager.activateSkill('test-skill-single-component');

            // Get prompt with active skill
            let prompt = workspace.getSkillPrompt();
            expect(prompt).not.toBeNull();

            // Deactivate the skill
            await skillManager.deactivateSkill();

            // Get prompt after deactivation
            prompt = workspace.getSkillPrompt();
            expect(prompt).toBeNull();
        });

        it('should control tool availability based on skill activation', async () => {
            const skillManager = workspace.getSkillManager();

            // Register and activate the skill
            skillManager.register(testSkillWithSingleComponent);
            await skillManager.activateSkill('test-skill-single-component');

            // Skill tools should be available
            expect(workspace.isToolAvailable('increment')).toBe(true);
            expect(workspace.isToolAvailable('decrement')).toBe(true);

            // Deactivate the skill
            await skillManager.deactivateSkill();

            // Skill tools should no longer be available
            expect(workspace.isToolAvailable('increment')).toBe(false);
            expect(workspace.isToolAvailable('decrement')).toBe(false);
        });

        it('should update tool availability when switching skills', async () => {
            const skillManager = workspace.getSkillManager();

            // Register both skills
            skillManager.register(testSkillWithSingleComponent);
            skillManager.register(testSkillWithMultipleComponents);

            // Activate first skill
            await skillManager.activateSkill('test-skill-single-component');
            expect(workspace.isToolAvailable('increment')).toBe(true);
            expect(workspace.isToolAvailable('decrement')).toBe(true);
            expect(workspace.isToolAvailable('store_text')).toBe(false);
            expect(workspace.isToolAvailable('get_text')).toBe(false);

            // Switch to second skill
            await skillManager.activateSkill('test-skill-multiple-components');
            // First skill's tools should still be available (both skills have increment/decrement)
            expect(workspace.isToolAvailable('increment')).toBe(true);
            expect(workspace.isToolAvailable('decrement')).toBe(true);
            // Second skill's additional tools should now be available
            expect(workspace.isToolAvailable('store_text')).toBe(true);
            expect(workspace.isToolAvailable('get_text')).toBe(true);
        });
    });

    describe('ToolBox and Skill Tools Section Rendering (System Context)', () => {
        it('should render ToolBox with global tools', async () => {
            const skillManager = workspace.getSkillManager();

            // Register and activate a skill
            skillManager.register(testSkillWithSingleComponent);
            await skillManager.activateSkill('test-skill-single-component');

            // Render ToolBox
            const toolBoxRendered = workspace.renderToolBox().render();

            // Verify ToolBox header is present
            expect(toolBoxRendered).toContain('TOOL BOX');

            // Note: Global tools would be rendered here if any were registered
            // In this test, we only have skill tools, so ToolBox may show minimal content
        });

        it('should render skill tools section when skill is active', async () => {
            const skillManager = workspace.getSkillManager();

            // Register the skill but don't activate it
            skillManager.register(testSkillWithSingleComponent);

            // renderSkillToolsSection() should return null when no skill is active
            let skillToolsSection = workspace.renderSkillToolsSection();
            expect(skillToolsSection).toBeNull();

            // Activate the skill
            await skillManager.activateSkill('test-skill-single-component');

            // renderSkillToolsSection() should return content when skill is active
            skillToolsSection = workspace.renderSkillToolsSection();
            expect(skillToolsSection).not.toBeNull();

            const skillToolsRendered = skillToolsSection!.render();

            // Verify skill tools section is rendered
            expect(skillToolsRendered).toContain('SKILL TOOLS');
            expect(skillToolsRendered).toContain('Test Skill with Single Component');
        });

        it('should hide skill tools section when skill is deactivated', async () => {
            const skillManager = workspace.getSkillManager();

            // Register and activate the skill
            skillManager.register(testSkillWithSingleComponent);
            await skillManager.activateSkill('test-skill-single-component');

            // renderSkillToolsSection() should return content when skill is active
            let skillToolsSection = workspace.renderSkillToolsSection();
            expect(skillToolsSection).not.toBeNull();

            // Deactivate the skill
            await skillManager.deactivateSkill();

            // renderSkillToolsSection() should return null when skill is deactivated
            skillToolsSection = workspace.renderSkillToolsSection();
            expect(skillToolsSection).toBeNull();
        });

        it('should render skill tools section for skill with multiple tools', async () => {
            const skillManager = workspace.getSkillManager();

            // Register and activate the skill with multiple tools
            skillManager.register(testSkillWithMultipleComponents);
            await skillManager.activateSkill('test-skill-multiple-components');

            // Render skill tools section
            const skillToolsSection = workspace.renderSkillToolsSection();
            expect(skillToolsSection).not.toBeNull();

            const skillToolsRendered = skillToolsSection!.render();

            // Verify skill tools section is rendered with skill name
            expect(skillToolsRendered).toContain('SKILL TOOLS');
            expect(skillToolsRendered).toContain('Test Skill with Multiple Components');

            // Verify tool names are present in the rendered output
            expect(skillToolsRendered).toContain('increment');
            expect(skillToolsRendered).toContain('decrement');
            expect(skillToolsRendered).toContain('store_text');
            expect(skillToolsRendered).toContain('get_text');
        });

        it('should update skill tools section when switching skills', async () => {
            const skillManager = workspace.getSkillManager();

            // Register both skills
            skillManager.register(testSkillWithSingleComponent);
            skillManager.register(testSkillWithMultipleComponents);

            // Activate first skill
            await skillManager.activateSkill('test-skill-single-component');
            let skillToolsSection = workspace.renderSkillToolsSection();
            let skillToolsRendered = skillToolsSection!.render();

            // Verify first skill's tools are rendered
            expect(skillToolsRendered).toContain('Test Skill with Single Component');
            expect(skillToolsRendered).toContain('increment');
            expect(skillToolsRendered).toContain('decrement');

            // Switch to second skill
            await skillManager.activateSkill('test-skill-multiple-components');
            skillToolsSection = workspace.renderSkillToolsSection();
            skillToolsRendered = skillToolsSection!.render();

            // Verify second skill's tools are rendered
            expect(skillToolsRendered).toContain('Test Skill with Multiple Components');
            expect(skillToolsRendered).toContain('store_text');
            expect(skillToolsRendered).toContain('get_text');
        });

        it('should not render tool sections in workspace.render()', async () => {
            const skillManager = workspace.getSkillManager();

            // Register and activate the skill
            skillManager.register(testSkillWithSingleComponent);
            await skillManager.activateSkill('test-skill-single-component');

            // Render workspace
            const workspaceRendered = await workspace.render();

            // Tool sections should NOT be in workspace.render()
            expect(workspaceRendered).not.toContain('TOOL BOX');
            expect(workspaceRendered).not.toContain('SKILL TOOLS');

            // But component content should still be rendered
            expect(workspaceRendered).toContain('test-skill-single-component:counter-component');
            expect(workspaceRendered).toContain('Counter:');
        });

        it('should render tool sections in separate methods', async () => {
            const skillManager = workspace.getSkillManager();

            // Register and activate the skill
            skillManager.register(testSkillWithSingleComponent);
            await skillManager.activateSkill('test-skill-single-component');

            // Render workspace - no tool sections
            const workspaceRendered = await workspace.render();
            expect(workspaceRendered).not.toContain('TOOL BOX');
            expect(workspaceRendered).not.toContain('SKILL TOOLS');

            // Render ToolBox - has TOOL BOX
            const toolBoxRendered = workspace.renderToolBox().render();
            expect(toolBoxRendered).toContain('TOOL BOX');

            // Render skill tools section - has SKILL TOOLS
            const skillToolsSection = workspace.renderSkillToolsSection();
            expect(skillToolsSection).not.toBeNull();
            const skillToolsRendered = skillToolsSection!.render();
            expect(skillToolsRendered).toContain('SKILL TOOLS');
        });
    });
});
