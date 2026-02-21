import { describe, it, expect, beforeEach } from 'vitest';
import { VirtualWorkspace, ComponentRegistration } from '../virtualWorkspace.js';
import { ToolComponent } from '../toolComponent.js';
import { Tool } from '../types.js';
import { tdiv } from '../ui/index.js';
import * as z from 'zod';

// Test component implementations using ToolComponent
class TestToolComponentA extends ToolComponent {
    toolSet = new Map<string, Tool>([
        ['search', {
            toolName: 'search',
            desc: 'Search for something',
            paramsSchema: z.object({ query: z.string() })
        }]
    ]);

    private searchQuery = '';
    private searchResults: string[] = [];

    renderImply = async (): Promise<tdiv[]> => {
        return [
            new tdiv({
                content: `Search Query: ${this.searchQuery}`,
                styles: { width: 80, showBorder: false }
            }),
            new tdiv({
                content: `Results: ${this.searchResults.join(', ')}`,
                styles: { width: 80, showBorder: false }
            })
        ];
    };

    handleToolCall = async (toolName: string, params: any): Promise<void> => {
        if (toolName === 'search') {
            this.searchQuery = params.query;
            this.searchResults = [`result1 for ${params.query}`, `result2 for ${params.query}`];
        }
    };

    getSearchQuery(): string {
        return this.searchQuery;
    }

    getSearchResults(): string[] {
        return this.searchResults;
    }
}

class TestToolComponentB extends ToolComponent {
    toolSet = new Map<string, Tool>([
        ['increment', {
            toolName: 'increment',
            desc: 'Increment counter',
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
        }
    };

    getCounter(): number {
        return this.counter;
    }
}

class TestToolComponentC extends ToolComponent {
    toolSet = new Map<string, Tool>([
        ['toggle', {
            toolName: 'toggle',
            desc: 'Toggle flag',
            paramsSchema: z.object({})
        }]
    ]);

    private flag = false;

    renderImply = async (): Promise<tdiv[]> => {
        return [
            new tdiv({
                content: `Flag: ${this.flag}`,
                styles: { width: 80, showBorder: false }
            })
        ];
    };

    handleToolCall = async (toolName: string, params: any): Promise<void> => {
        if (toolName === 'toggle') {
            this.flag = !this.flag;
        }
    };

    getFlag(): boolean {
        return this.flag;
    }
}

describe('VirtualWorkspace', () => {
    let workspace: VirtualWorkspace;
    let componentA: TestToolComponentA;
    let componentB: TestToolComponentB;

    beforeEach(() => {
        const config = {
            id: 'test-workspace',
            name: 'Test Workspace',
            description: 'A test workspace for unit testing'
        };
        workspace = new VirtualWorkspace(config);
        componentA = new TestToolComponentA();
        componentB = new TestToolComponentB();
    });

    describe('Initialization', () => {
        it('should initialize with given config', () => {
            const config = workspace.getConfig();
            expect(config.id).toBe('test-workspace');
            expect(config.name).toBe('Test Workspace');
            expect(config.description).toBe('A test workspace for unit testing');
        });

        it('should start with no components', () => {
            expect(workspace.getComponentKeys()).toEqual([]);
            expect(workspace.getStats().componentCount).toBe(0);
        });
    });

    describe('Component Registration', () => {
        it('should register a component', () => {
            workspace.registerComponent({
                key: 'componentA',
                component: componentA,
                priority: 1
            });

            expect(workspace.getComponentKeys()).toContain('componentA');
            expect(workspace.getComponent('componentA')).toBe(componentA);
        });

        it('should register multiple components', () => {
            workspace.registerComponent({ key: 'componentA', component: componentA, priority: 1 });
            workspace.registerComponent({ key: 'componentB', component: componentB, priority: 2 });

            expect(workspace.getComponentKeys()).toHaveLength(2);
            expect(workspace.getComponent('componentA')).toBe(componentA);
            expect(workspace.getComponent('componentB')).toBe(componentB);
        });

        it('should unregister a component', () => {
            workspace.registerComponent({ key: 'componentA', component: componentA });
            const removed = workspace.unregisterComponent('componentA');

            expect(removed).toBe(true);
            expect(workspace.getComponentKeys()).not.toContain('componentA');
            expect(workspace.getComponent('componentA')).toBeUndefined();
        });

        it('should return false when unregistering non-existent component', () => {
            const removed = workspace.unregisterComponent('non-existent');
            expect(removed).toBe(false);
        });
    });

    describe('Workspace Statistics', () => {
        it('should return correct stats for empty workspace', () => {
            const stats = workspace.getStats();
            expect(stats.componentCount).toBe(0);
            expect(stats.componentKeys).toEqual([]);
            expect(stats.totalTools).toBe(0);
        });

        it('should return correct stats with components', () => {
            workspace.registerComponent({ key: 'componentA', component: componentA });
            workspace.registerComponent({ key: 'componentB', component: componentB });

            const stats = workspace.getStats();
            expect(stats.componentCount).toBe(2);
            expect(stats.componentKeys).toContain('componentA');
            expect(stats.componentKeys).toContain('componentB');
            expect(stats.totalTools).toBe(2); // Each component has 1 tool
        });
    });

    describe('Rendering', () => {
        it('should render workspace with components', async () => {
            workspace.registerComponent({ key: 'componentA', component: componentA });
            workspace.registerComponent({ key: 'componentB', component: componentB });

            const context = await workspace.render();
            // console.log(context)
            expect(context).toContain('Test Workspace');
            expect(context).toContain('Search Query');
            expect(context).toContain('Counter');
        });

        it('should render components in priority order', async () => {
            const componentC = new TestToolComponentC();
            workspace.registerComponent({ key: 'componentC', component: componentC, priority: 3 });
            workspace.registerComponent({ key: 'componentA', component: componentA, priority: 1 });
            workspace.registerComponent({ key: 'componentB', component: componentB, priority: 2 });

            const context = await workspace.render();
            const componentAPos = context.indexOf('componentA');
            const componentBPos = context.indexOf('componentB');
            const componentCPos = context.indexOf('componentC');

            expect(componentAPos).toBeLessThan(componentBPos);
            expect(componentBPos).toBeLessThan(componentCPos);
        });
    });

    describe('Tool Calls', () => {
        it('should get all tools', async () => {
            workspace.registerComponent({ key: 'componentA', component: componentA })
            const toolset = workspace.getAllTools()
            console.log(toolset)
        })

        it('should handle tool calls on components', async () => {
            workspace.registerComponent({ key: 'componentA', component: componentA });

            await componentA.handleToolCall('search', { query: 'test query' });

            expect(componentA.getSearchQuery()).toBe('test query');
            expect(componentA.getSearchResults()).toEqual(['result1 for test query', 'result2 for test query']);
        });

        it('should handle tool calls on multiple components', async () => {
            workspace.registerComponent({ key: 'componentA', component: componentA });
            workspace.registerComponent({ key: 'componentB', component: componentB });

            await componentA.handleToolCall('search', { query: 'test' });
            await componentB.handleToolCall('increment', { amount: 5 });

            expect(componentA.getSearchQuery()).toBe('test');
            expect(componentB.getCounter()).toBe(5);
        });
    });

    describe('Skills', () => {
        it('should display skills section in workspace render', async () => {
            // Built-in skills are already loaded by VirtualWorkspace constructor
            const result = await workspace.render();

            // Check that skills section is included
            expect(result).toContain('AVAILABLE SKILLS');
        });

        it('should display available skills with their descriptions', async () => {
            // Built-in skills are already loaded by VirtualWorkspace constructor
            const result = await workspace.render();

            // Check that skill information is displayed
            const availableSkills = workspace.getAvailableSkills();
            expect(availableSkills.length).toBeGreaterThan(0);

            // Verify at least one skill is shown
            const firstSkill = availableSkills[0];
            expect(result).toContain(firstSkill.name);
            // Description might be truncated in output, so just check it exists
            expect(firstSkill.description).toBeDefined();
            expect(firstSkill.description.length).toBeGreaterThan(0);
        });

        it('should get available skills summary', async () => {
            // Built-in skills are already loaded by VirtualWorkspace constructor
            const availableSkills = workspace.getAvailableSkills();

            expect(Array.isArray(availableSkills)).toBe(true);
            expect(availableSkills.length).toBeGreaterThan(0);

            // Verify skill structure
            const firstSkill = availableSkills[0];
            expect(firstSkill).toHaveProperty('name');
            expect(firstSkill).toHaveProperty('displayName');
            expect(firstSkill).toHaveProperty('description');
        });

        it('should show active skill indicator in render', async () => {
            // Built-in skills are already loaded by VirtualWorkspace constructor
            const availableSkills = workspace.getAvailableSkills();
            expect(availableSkills.length).toBeGreaterThan(0);

            // Activate a skill
            const skillManager = workspace.getSkillManager();
            await skillManager.activateSkill(availableSkills[0].name);

            const result = await workspace.render();

            // Check that active skill is shown
            expect(result).toContain('Active:');
            expect(result).toContain(availableSkills[0].displayName);
        });

        it('should enable only skill tools when skill is activated', async () => {
            // Register a component with tools
            workspace.registerComponent({ key: 'componentA', component: componentA });

            // Initially, component tools should be enabled
            expect(workspace.isToolAvailable('search')).toBe(true);

            // Get the skill manager
            const skillManager = workspace.getSkillManager();

            // Activate pico-extraction skill which has PICOS tools
            await skillManager.activateSkill('pico-extraction');

            // After activating a skill, only skill tools should be enabled
            // The 'search' tool is not in pico-extraction skill, so it should be disabled
            const activeSkill = skillManager.getActiveSkill();
            const skillToolNames = activeSkill?.tools?.map(t => t.toolName) ?? [];

            // 'search' should not be in the skill's tools
            expect(skillToolNames).not.toContain('search');

            // Therefore 'search' should be disabled
            expect(workspace.isToolAvailable('search')).toBe(false);

            // Deactivate skill - all tools should be enabled again
            await skillManager.deactivateSkill();
            expect(workspace.isToolAvailable('search')).toBe(true);
        });
    })
});

describe('Integration Tests', () => {
    it('should demonstrate complete workflow with multiple components', async () => {
        const workspace = new VirtualWorkspace({
            id: 'integration-test',
            name: 'Integration Test Workspace',
            description: 'Testing complete workflow'
        });

        const componentA = new TestToolComponentA();
        const componentB = new TestToolComponentB();
        const componentC = new TestToolComponentC();

        workspace.registerComponent({ key: 'search', component: componentA, priority: 1 });
        workspace.registerComponent({ key: 'counter', component: componentB, priority: 2 });
        workspace.registerComponent({ key: 'toggle', component: componentC, priority: 3 });

        // Render initial context
        const context = await workspace.render();
        expect(context).toContain('Integration Test Workspace');
        expect(context).toContain('search');
        expect(context).toContain('counter');
        expect(context).toContain('toggle');

        // Execute tool calls
        await componentA.handleToolCall('search', { query: 'search query' });
        await componentB.handleToolCall('increment', { amount: 42 });
        await componentC.handleToolCall('toggle', {});

        expect(componentA.getSearchQuery()).toBe('search query');
        expect(componentB.getCounter()).toBe(42);
        expect(componentC.getFlag()).toBe(true);

        // Verify stats
        const stats = workspace.getStats();
        expect(stats.componentCount).toBe(3);
        expect(stats.totalTools).toBe(3);
    });

    it('should handle component replacement', async () => {
        const workspace = new VirtualWorkspace({
            id: 'replacement-test',
            name: 'Replacement Test Workspace'
        });

        const componentA1 = new TestToolComponentA();
        const componentA2 = new TestToolComponentA();

        workspace.registerComponent({ key: 'componentA', component: componentA1 });
        expect(workspace.getComponent('componentA')).toBe(componentA1);

        // Unregister and register new component
        workspace.unregisterComponent('componentA');
        workspace.registerComponent({ key: 'componentA', component: componentA2 });

        expect(workspace.getComponent('componentA')).toBe(componentA2);
        expect(workspace.getComponent('componentA')).not.toBe(componentA1);
    });

    it('should render updated component state after tool calls', async () => {
        const workspace = new VirtualWorkspace({
            id: 'render-test',
            name: 'Render Test Workspace'
        });

        const componentA = new TestToolComponentA();
        workspace.registerComponent({ key: 'componentA', component: componentA });

        // Render initial state
        let context = await workspace.render();
        expect(context).toContain('componentA');

        // Make tool call
        await componentA.handleToolCall('search', { query: 'test query' });

        // Verify state was updated
        expect(componentA.getSearchQuery()).toBe('test query');
        expect(componentA.getSearchResults()).toEqual(['result1 for test query', 'result2 for test query']);

        // Render updated state
        context = await workspace.render();
        expect(context).toContain('componentA');
    });
});
