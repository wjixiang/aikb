import { describe, it, expect, beforeEach } from 'vitest';
import { VirtualWorkspace } from '../virtualWorkspace.js';
import { ToolManager } from '../../tools/index.js';
import { TestToolComponentA, TestToolComponentB, TestToolComponentC } from './testComponents.js';
import { testSkillA, testSkillB, testSkillC, testSkillMulti } from './testSkills.js';
import { defineSkill, createComponentDefinition } from '../../skills/SkillDefinition.js';

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
        const toolManager = new ToolManager();
        workspace = new VirtualWorkspace(config, toolManager);
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

        it('should start with no active components', () => {
            expect(workspace.getComponentKeys()).toEqual([]);
            expect(workspace.getStats().componentCount).toBe(0);
        });
    });

    describe('Skill Registration', () => {
        it('should register a skill', () => {
            workspace.registerSkill(testSkillA);

            const skillManager = workspace.getSkillManager();
            expect(skillManager.has('test-skill-a')).toBe(true);
        });

        it('should register multiple skills', () => {
            workspace.registerSkill(testSkillA);
            workspace.registerSkill(testSkillB);

            const skillManager = workspace.getSkillManager();
            expect(skillManager.has('test-skill-a')).toBe(true);
            expect(skillManager.has('test-skill-b')).toBe(true);
        });
    });

    describe('Workspace Statistics', () => {
        it('should return correct stats for empty workspace', () => {
            const stats = workspace.getStats();
            expect(stats.componentCount).toBe(0);
            expect(stats.componentKeys).toEqual([]);
            expect(stats.totalTools).toBe(0);
        });

        it('should return correct stats with active skill components', async () => {
            workspace.registerSkill(testSkillMulti);
            const skillManager = workspace.getSkillManager();
            await skillManager.activateSkill('test-skill-multi');

            const stats = workspace.getStats();
            expect(stats.componentCount).toBe(3);
            expect(stats.componentKeys).toContain('test-skill-multi:search-component');
            expect(stats.componentKeys).toContain('test-skill-multi:counter-component');
            expect(stats.componentKeys).toContain('test-skill-multi:toggle-component');
            expect(stats.totalTools).toBe(3); // Each component has 1 tool
        });
    });

    describe('Rendering', () => {
        it('should render workspace with active skill components', async () => {
            workspace.registerSkill(testSkillA);
            workspace.registerSkill(testSkillB);

            const skillManager = workspace.getSkillManager();
            await skillManager.activateSkill('test-skill-a');

            const context = await workspace.render();
            expect(context).toContain('Test Workspace');
            expect(context).toContain('Search Query');
        });

        it('should render components from active skill', async () => {
            workspace.registerSkill(testSkillMulti);
            const skillManager = workspace.getSkillManager();
            await skillManager.activateSkill('test-skill-multi');

            const context = await workspace.render();
            expect(context).toContain('Search Query');
            expect(context).toContain('Counter');
            expect(context).toContain('Flag');
        });
    });

    describe('Tool Calls', () => {
        it('should get all tools from active skill', async () => {
            workspace.registerSkill(testSkillMulti);
            const skillManager = workspace.getSkillManager();
            await skillManager.activateSkill('test-skill-multi');

            const tools = workspace.getAllTools();
            expect(tools.length).toBeGreaterThan(0);
        });

        it('should handle tool calls on skill components', async () => {
            workspace.registerSkill(testSkillA);
            const skillManager = workspace.getSkillManager();
            await skillManager.activateSkill('test-skill-a');

            const component = workspace.getComponent('test-skill-a:search-component') as TestToolComponentA;
            await component.handleToolCall('search', { query: 'test query' });

            expect(component.getSearchQuery()).toBe('test query');
            expect(component.getSearchResults()).toEqual(['result1 for test query', 'result2 for test query']);
        });

        it('should handle tool calls on multiple skill components', async () => {
            workspace.registerSkill(testSkillMulti);
            const skillManager = workspace.getSkillManager();
            await skillManager.activateSkill('test-skill-multi');

            const searchComponent = workspace.getComponent('test-skill-multi:search-component') as TestToolComponentA;
            const counterComponent = workspace.getComponent('test-skill-multi:counter-component') as TestToolComponentB;

            await searchComponent.handleToolCall('search', { query: 'test' });
            await counterComponent.handleToolCall('increment', { amount: 5 });

            expect(searchComponent.getSearchQuery()).toBe('test');
            expect(counterComponent.getCounter()).toBe(5);
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
            console.log(result)
            // Check that skill information is displayed
            const availableSkills = workspace.getAvailableSkills();
            expect(availableSkills.length).toBeGreaterThan(0);

            // Verify at least one skill is shown with ID prominently displayed
            const firstSkill = availableSkills[0];
            expect(result).toContain('Skill ID:');
            expect(result).toContain(firstSkill.name);
            expect(result).toContain('Display Name:');
            expect(result).toContain(firstSkill.displayName);
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

            // Check that active skill is shown with both ID and display name
            expect(result).toContain('Currently Active:');
            expect(result).toContain(availableSkills[0].name);
            expect(result).toContain(availableSkills[0].displayName);
        });

        it('should enable only skill tools when skill is activated', async () => {
            // Register a skill with components
            workspace.registerSkill(testSkillA);

            // Get the skill manager
            const skillManager = workspace.getSkillManager();

            // Activate test-skill-a which has search tool
            await skillManager.activateSkill('test-skill-a');

            // After activating a skill, only skill tools should be enabled
            const activeSkill = skillManager.getActiveSkill();
            const skillToolNames = activeSkill?.tools?.map(t => t.toolName) ?? [];

            // 'search' should be in the skill's tools
            expect(skillToolNames).toContain('search');

            // Therefore 'search' should be enabled
            expect(workspace.isToolAvailable('search')).toBe(true);

            // Deactivate skill - tool should still be available from global tools
            await skillManager.deactivateSkill();
        });
    });
});

describe('Integration Tests', () => {
    it('should demonstrate complete workflow with multiple skills', async () => {
        const toolManager = new ToolManager();
        const workspace = new VirtualWorkspace({
            id: 'integration-test',
            name: 'Integration Test Workspace',
            description: 'Testing complete workflow'
        }, toolManager);

        // Register skills
        workspace.registerSkill(testSkillA);
        workspace.registerSkill(testSkillB);
        workspace.registerSkill(testSkillC);

        const skillManager = workspace.getSkillManager();

        // Activate first skill
        await skillManager.activateSkill('test-skill-a');
        let context = await workspace.render();
        expect(context).toContain('Integration Test Workspace');
        expect(context).toContain('Search Query');

        // Get component and execute tool call
        const componentA = workspace.getComponent('test-skill-a:search-component') as TestToolComponentA;
        await componentA.handleToolCall('search', { query: 'search query' });
        expect(componentA.getSearchQuery()).toBe('search query');

        // Switch to second skill
        await skillManager.activateSkill('test-skill-b');
        context = await workspace.render();
        expect(context).toContain('Counter');

        const componentB = workspace.getComponent('test-skill-b:counter-component') as TestToolComponentB;
        await componentB.handleToolCall('increment', { amount: 42 });
        expect(componentB.getCounter()).toBe(42);

        // Switch to third skill
        await skillManager.activateSkill('test-skill-c');
        context = await workspace.render();
        expect(context).toContain('Flag');

        const componentC = workspace.getComponent('test-skill-c:toggle-component') as TestToolComponentC;
        await componentC.handleToolCall('toggle', {});
        expect(componentC.getFlag()).toBe(true);
    });

    it('should handle skill switching', async () => {
        const toolManager = new ToolManager();
        const workspace = new VirtualWorkspace({
            id: 'switch-test',
            name: 'Switch Test Workspace'
        }, toolManager);

        // Register skills
        workspace.registerSkill(testSkillA);
        workspace.registerSkill(testSkillB);

        const skillManager = workspace.getSkillManager();

        // Activate skill A
        await skillManager.activateSkill('test-skill-a');
        expect(workspace.getComponentKeys()).toContain('test-skill-a:search-component');
        expect(workspace.getComponent('test-skill-a:search-component')).toBeInstanceOf(TestToolComponentA);

        // Switch to skill B
        await skillManager.activateSkill('test-skill-b');
        expect(workspace.getComponentKeys()).toContain('test-skill-b:counter-component');
        expect(workspace.getComponent('test-skill-b:counter-component')).toBeInstanceOf(TestToolComponentB);
        // Skill A's component should no longer be accessible
        expect(workspace.getComponent('test-skill-a:search-component')).toBeUndefined();
    });

    it('should render updated component state after tool calls', async () => {
        const toolManager = new ToolManager();
        const workspace = new VirtualWorkspace({
            id: 'render-test',
            name: 'Render Test Workspace'
        }, toolManager);

        workspace.registerSkill(testSkillA);
        const skillManager = workspace.getSkillManager();

        // Activate skill
        await skillManager.activateSkill('test-skill-a');

        // Render initial state
        let context = await workspace.render();
        expect(context).toContain('test-skill-a:search-component');

        // Get component and make tool call
        const componentA = workspace.getComponent('test-skill-a:search-component') as TestToolComponentA;
        await componentA.handleToolCall('search', { query: 'test query' });

        // Verify state was updated
        expect(componentA.getSearchQuery()).toBe('test query');
        expect(componentA.getSearchResults()).toEqual(['result1 for test query', 'result2 for test query']);

        // Render updated state
        context = await workspace.render();
        expect(context).toContain('test-skill-a:search-component');
        expect(context).toContain('test query');
    });

    it('should work with multi-component skill', async () => {
        const toolManager = new ToolManager();
        const workspace = new VirtualWorkspace({
            id: 'multi-test',
            name: 'Multi Component Test Workspace'
        }, toolManager);

        // Create a fresh multi skill to avoid state sharing
        const freshTestSkillMulti = defineSkill({
            name: 'test-skill-multi',
            displayName: 'Test Skill Multi',
            description: 'A test skill with multiple components',
            whenToUse: 'Use this skill when you need multiple functionalities',
            version: '1.0.0',
            triggers: ['multi', 'combined'],
            capabilities: ['Multiple functionalities'],
            workDirection: 'Multi direction',
            components: [
                createComponentDefinition(
                    'search-component',
                    'Search Component',
                    'Provides search functionality',
                    new TestToolComponentA()
                ),
                createComponentDefinition(
                    'counter-component',
                    'Counter Component',
                    'Provides counter functionality',
                    new TestToolComponentB()
                ),
                createComponentDefinition(
                    'toggle-component',
                    'Toggle Component',
                    'Provides toggle functionality',
                    new TestToolComponentC()
                )
            ]
        });

        workspace.registerSkill(freshTestSkillMulti);
        const skillManager = workspace.getSkillManager();

        // Activate multi-component skill
        await skillManager.activateSkill('test-skill-multi');

        // Verify all components are accessible
        expect(workspace.getComponentKeys()).toContain('test-skill-multi:search-component');
        expect(workspace.getComponentKeys()).toContain('test-skill-multi:counter-component');
        expect(workspace.getComponentKeys()).toContain('test-skill-multi:toggle-component');

        // Get components and execute tool calls
        const componentA = workspace.getComponent('test-skill-multi:search-component') as TestToolComponentA;
        const componentB = workspace.getComponent('test-skill-multi:counter-component') as TestToolComponentB;
        const componentC = workspace.getComponent('test-skill-multi:toggle-component') as TestToolComponentC;

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
});
