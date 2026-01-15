import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VirtualWorkspace, ScriptRuntime, ComponentRegistration, VirtualWorkspaceConfig } from './virtualWorkspace';
import { StatefulComponent, State, Permission } from './statefulComponent';
import { proxy } from 'valtio';
import * as z from 'zod';

// Test component implementations
class TestComponentA extends StatefulComponent {
    protected override states: Record<string, State> = {
        state_a: {
            permission: Permission.rw,
            schema: z.object({ value: z.string() }),
            state: proxy({ value: 'initial-a' })
        }
    };

    getValue(): string {
        return (this.states['state_a'].state as any).value;
    }
}

class TestComponentB extends StatefulComponent {
    protected override states: Record<string, State> = {
        state_b: {
            permission: Permission.rw,
            schema: z.object({ count: z.number() }),
            state: proxy({ count: 0 })
        }
    };

    getCount(): number {
        return (this.states['state_b'].state as any).count;
    }
}

class TestComponentC extends StatefulComponent {
    protected override states: Record<string, State> = {
        state_c: {
            permission: Permission.rw,
            schema: z.object({ flag: z.boolean() }),
            state: proxy({ flag: false })
        }
    };

    getFlag(): boolean {
        return (this.states['state_c'].state as any).flag;
    }
}

describe('VirtualWorkspace', () => {
    let workspace: VirtualWorkspace;
    let componentA: TestComponentA;
    let componentB: TestComponentB;

    beforeEach(() => {
        const config: VirtualWorkspaceConfig = {
            id: 'test-workspace',
            name: 'Test Workspace',
            description: 'A test workspace for unit testing'
        };
        workspace = new VirtualWorkspace(config);
        componentA = new TestComponentA();
        componentB = new TestComponentB();
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

        it('should update script runtime when component is registered', () => {
            workspace.registerComponent({ key: 'componentA', component: componentA });
            const runtime = workspace.getScriptRuntime();
            expect(runtime.getComponentKeys()).toContain('componentA');
        });

        it('should update script runtime when component is unregistered', () => {
            workspace.registerComponent({ key: 'componentA', component: componentA });
            workspace.unregisterComponent('componentA');
            const runtime = workspace.getScriptRuntime();
            expect(runtime.getComponentKeys()).not.toContain('componentA');
        });
    });

    describe('Workspace Rendering', () => {
        it('should render empty workspace', async () => {
            const rendered = await workspace.render();
            expect(rendered).toContain('VIRTUAL WORKSPACE: Test Workspace');
            expect(rendered).toContain('Workspace ID: test-workspace');
            expect(rendered).toContain('Components: 0');
        });

        it('should render workspace with components', async () => {
            workspace.registerComponent({ key: 'componentA', component: componentA });
            workspace.registerComponent({ key: 'componentB', component: componentB });

            const rendered = await workspace.render();
            expect(rendered).toContain('VIRTUAL WORKSPACE: Test Workspace');
            expect(rendered).toContain('Components: 2');
            expect(rendered).toContain('Component: componentA');
            expect(rendered).toContain('Component: componentB');
        });

        it('should render components in priority order', async () => {
            const componentC = new TestComponentC();

            workspace.registerComponent({ key: 'componentC', component: componentC, priority: 3 });
            workspace.registerComponent({ key: 'componentA', component: componentA, priority: 1 });
            workspace.registerComponent({ key: 'componentB', component: componentB, priority: 2 });

            const rendered = await workspace.render();
            const indexA = rendered.indexOf('Component: componentA');
            const indexB = rendered.indexOf('Component: componentB');
            const indexC = rendered.indexOf('Component: componentC');

            expect(indexA).toBeLessThan(indexB);
            expect(indexB).toBeLessThan(indexC);
        });

        it('should render with script section', async () => {
            workspace.registerComponent({ key: 'componentA', component: componentA });

            const rendered = await workspace.renderWithScriptSection();
            expect(rendered).toContain('VIRTUAL WORKSPACE: Test Workspace');
            expect(rendered).toContain('SCRIPT EXECUTION GUIDE');
            expect(rendered).toContain('AVAILABLE TOOLS');
            expect(rendered).toContain('execute_script');
            expect(rendered).toContain('attempt_completion');
            expect(rendered).toContain('AVAILABLE STATES (MERGED FROM ALL COMPONENTS)');
            expect(rendered).toContain('componentA');
            expect(rendered).toContain('EXAMPLES');
        });
    });

    describe('Workspace Statistics', () => {
        it('should return correct stats for empty workspace', () => {
            const stats = workspace.getStats();
            expect(stats.componentCount).toBe(0);
            expect(stats.componentKeys).toEqual([]);
            expect(stats.totalStates).toBe(0);
        });

        it('should return correct stats with components', () => {
            workspace.registerComponent({ key: 'componentA', component: componentA });
            workspace.registerComponent({ key: 'componentB', component: componentB });

            const stats = workspace.getStats();
            expect(stats.componentCount).toBe(2);
            expect(stats.componentKeys).toContain('componentA');
            expect(stats.componentKeys).toContain('componentB');
            expect(stats.totalStates).toBe(2); // Each component has 1 state
        });
    });

    describe('Common Tools', () => {
        it('should provide execute_script tool', () => {
            const tools = workspace.getCommonTools();
            expect(tools.execute_script).toBeDefined();
            expect(typeof tools.execute_script).toBe('function');
        });

        it('should provide attempt_completion tool', () => {
            const tools = workspace.getCommonTools();
            expect(tools.attempt_completion).toBeDefined();
            expect(typeof tools.attempt_completion).toBe('function');
        });

        it('should execute script with merged states', async () => {
            workspace.registerComponent({ key: 'componentA', component: componentA });
            workspace.registerComponent({ key: 'componentB', component: componentB });
            const tools = workspace.getCommonTools();

            const result = await tools.execute_script('state_a.value = "updated";');

            expect(result.success).toBe(true);
            expect(componentA.getValue()).toBe('updated');
            // componentB should remain unchanged
            expect(componentB.getCount()).toBe(0);
        });

        it('should handle completion callback', async () => {
            const completionCallback = vi.fn().mockResolvedValue(undefined);
            workspace.setCompletionCallback(completionCallback);
            const tools = workspace.getCommonTools();

            await tools.attempt_completion('Task completed');

            expect(completionCallback).toHaveBeenCalledWith('Task completed');
        });
    });
});

describe('ScriptRuntime', () => {
    let runtime: ScriptRuntime;
    let componentA: TestComponentA;
    let componentB: TestComponentB;

    beforeEach(() => {
        componentA = new TestComponentA();
        componentB = new TestComponentB();
        const components = new Map<string, StatefulComponent>();
        components.set('componentA', componentA);
        components.set('componentB', componentB);
        runtime = new ScriptRuntime(components);
    });

    describe('Component Access', () => {
        it('should get all component keys', () => {
            const keys = runtime.getComponentKeys();
            expect(keys).toContain('componentA');
            expect(keys).toContain('componentB');
        });

        it('should get specific component', () => {
            const component = runtime.getComponent('componentA');
            expect(component).toBe(componentA);
        });

        it('should return undefined for non-existent component', () => {
            const component = runtime.getComponent('non-existent');
            expect(component).toBeUndefined();
        });
    });

    describe('Script Execution with Merged States', () => {
        it('should execute script with merged states from all components', async () => {
            const result = await runtime.execute('state_a.value = "test";');

            expect(result.success).toBe(true);
            expect(componentA.getValue()).toBe('test');
        });

        it('should include execution metadata', async () => {
            const result = await runtime.execute('state_a.value = "test";');

            expect(result.metadata).toBeDefined();
            expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0);
            expect(result.metadata?.componentCount).toBe(2);
            expect(result.metadata?.stateCount).toBe(2);
        });

        it('should modify multiple states in single script', async () => {
            const result = await runtime.execute(`
                state_a.value = "multi-a";
                state_b.count = 42;
            `);

            expect(result.success).toBe(true);
            expect(componentA.getValue()).toBe('multi-a');
            expect(componentB.getCount()).toBe(42);
        });

        it('should handle script errors gracefully', async () => {
            const result = await runtime.execute('throw new Error("Intentional error");');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Intentional error');
        });

        it('should support async operations in scripts', async () => {
            const result = await runtime.execute(`
                await new Promise(resolve => setTimeout(resolve, 5));
                state_a.value = "async update";
            `);

            expect(result.success).toBe(true);
            expect(componentA.getValue()).toBe('async update');
        });
    });

    describe('Completion Callback', () => {
        it('should set completion callback', () => {
            const callback = vi.fn();
            runtime.setCompletionCallback(callback);
            // Callback is set, no assertion needed
        });

        it('should call completion callback', async () => {
            const callback = vi.fn().mockResolvedValue(undefined);
            runtime.setCompletionCallback(callback);

            await runtime.attemptCompletion('done');

            expect(callback).toHaveBeenCalledWith('done');
        });

        it('should throw error when no callback is set', async () => {
            await expect(runtime.attemptCompletion('done')).rejects.toThrow('No completion callback registered');
        });
    });

    describe('Common Tools', () => {
        it('should provide execute_script tool', () => {
            const tools = runtime.getCommonTools();
            expect(tools.execute_script).toBeDefined();
        });

        it('should provide attempt_completion tool', () => {
            const tools = runtime.getCommonTools();
            expect(tools.attempt_completion).toBeDefined();
        });

        it('should handle script execution via tools', async () => {
            const tools = runtime.getCommonTools();
            const result = await tools.execute_script('state_a.value = "via-tools";');

            expect(result.success).toBe(true);
            expect(componentA.getValue()).toBe('via-tools');
        });

        it('should handle completion via tools', async () => {
            const callback = vi.fn().mockResolvedValue(undefined);
            runtime.setCompletionCallback(callback);
            const tools = runtime.getCommonTools();

            await tools.attempt_completion('completed');

            expect(callback).toHaveBeenCalledWith('completed');
        });
    });
});

describe('Integration Tests', () => {
    it('should demonstrate complete workflow with multiple components', async () => {
        const workspace = new VirtualWorkspace({
            id: 'integration-test',
            name: 'Integration Test Workspace',
            description: 'Testing complete workflow'
        });

        const componentA = new TestComponentA();
        const componentB = new TestComponentB();
        const componentC = new TestComponentC();

        workspace.registerComponent({ key: 'search', component: componentA, priority: 1 });
        workspace.registerComponent({ key: 'counter', component: componentB, priority: 2 });
        workspace.registerComponent({ key: 'toggle', component: componentC, priority: 3 });

        // Render initial context
        const context = await workspace.renderWithScriptSection();
        expect(context).toContain('Integration Test Workspace');
        expect(context).toContain('search');
        expect(context).toContain('counter');
        expect(context).toContain('toggle');
        expect(context).toContain('AVAILABLE STATES (MERGED FROM ALL COMPONENTS)');

        // Execute script that modifies multiple states
        const tools = workspace.getCommonTools();
        const result1 = await tools.execute_script(`
            state_a.value = "search query";
            state_b.count = 42;
            state_c.flag = true;
        `);
        expect(result1.success).toBe(true);
        expect(componentA.getValue()).toBe('search query');
        expect(componentB.getCount()).toBe(42);
        expect(componentC.getFlag()).toBe(true);

        // Verify stats
        const stats = workspace.getStats();
        expect(stats.componentCount).toBe(3);
        expect(stats.totalStates).toBe(3);
    });

    it('should handle completion callback in workspace', async () => {
        const workspace = new VirtualWorkspace({
            id: 'completion-test',
            name: 'Completion Test Workspace'
        });

        const componentA = new TestComponentA();
        workspace.registerComponent({ key: 'componentA', component: componentA });

        const completionCallback = vi.fn().mockResolvedValue(undefined);
        workspace.setCompletionCallback(completionCallback);

        const tools = workspace.getCommonTools();
        await tools.attempt_completion('Task completed successfully');

        expect(completionCallback).toHaveBeenCalledWith('Task completed successfully');
    });

    it('should demonstrate priority-based rendering', async () => {
        const workspace = new VirtualWorkspace({
            id: 'priority-test',
            name: 'Priority Test Workspace'
        });

        const componentA = new TestComponentA();
        const componentB = new TestComponentB();
        const componentC = new TestComponentC();

        // Register in random order
        workspace.registerComponent({ key: 'C', component: componentC, priority: 3 });
        workspace.registerComponent({ key: 'A', component: componentA, priority: 1 });
        workspace.registerComponent({ key: 'B', component: componentB, priority: 2 });

        const rendered = await workspace.render();
        const indexA = rendered.indexOf('Component: A');
        const indexB = rendered.indexOf('Component: B');
        const indexC = rendered.indexOf('Component: C');

        expect(indexA).toBeLessThan(indexB);
        expect(indexB).toBeLessThan(indexC);
    });

    it('should handle component replacement', async () => {
        const workspace = new VirtualWorkspace({
            id: 'replacement-test',
            name: 'Replacement Test Workspace'
        });

        const componentA1 = new TestComponentA();
        const componentA2 = new TestComponentA();

        workspace.registerComponent({ key: 'componentA', component: componentA1 });
        expect(workspace.getComponent('componentA')).toBe(componentA1);

        // Unregister and register new component
        workspace.unregisterComponent('componentA');
        workspace.registerComponent({ key: 'componentA', component: componentA2 });

        expect(workspace.getComponent('componentA')).toBe(componentA2);
        expect(workspace.getComponent('componentA')).not.toBe(componentA1);
    });

    it('should demonstrate state merging across components', async () => {
        const workspace = new VirtualWorkspace({
            id: 'merge-test',
            name: 'Merge Test Workspace'
        });

        const componentA = new TestComponentA();
        const componentB = new TestComponentB();

        workspace.registerComponent({ key: 'componentA', component: componentA });
        workspace.registerComponent({ key: 'componentB', component: componentB });

        const tools = workspace.getCommonTools();

        // Script can access both states
        const result = await tools.execute_script(`
            const combined = state_a.value + " - " + state_b.count;
            state_a.value = combined;
        `);

        expect(result.success).toBe(true);
        expect(componentA.getValue()).toBe('initial-a - 0');
        expect(componentB.getCount()).toBe(0);
    });
});
