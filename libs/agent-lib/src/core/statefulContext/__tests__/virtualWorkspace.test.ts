/**
 * VirtualWorkspace Tests
 *
 * Tests for the new component-based architecture (without Skill system)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VirtualWorkspace } from '../virtualWorkspace.js';
import { ToolComponent, type Tool } from '../../../components/index.js';
import { z } from 'zod';

describe('VirtualWorkspace (Component-based)', () => {
    let workspace: VirtualWorkspace;

    // Test component
    class TestComponent extends ToolComponent {
        readonly componentId = 'test-component';
        readonly displayName = 'Test Component';
        readonly description = 'A test component';

        toolSet = new Map<string, Tool>([
            ['test_tool', {
                toolName: 'test_tool',
                paramsSchema: z.object({}),
                desc: 'A test tool',
            }],
        ]);

        async renderImply() {
            return [];
        }

        async handleToolCall(toolName: string, params: any): Promise<void> {
            // Mock implementation
        }
    }

    beforeEach(() => {
        workspace = new VirtualWorkspace({
            id: 'test-workspace',
            name: 'Test Workspace',
        });
    });

    describe('Component Registration', () => {
        it('should register a component', () => {
            const component = new TestComponent();
            workspace.registerComponent('test-component', component);

            const retrieved = workspace.getComponent('test-component');
            expect(retrieved).toBe(component);
        });

        it('should register multiple components', () => {
            const component1 = new TestComponent();
            const component2 = new TestComponent();
            component2.componentId = 'test-component-2';

            workspace.registerComponents([
                { id: 'comp1', component: component1 },
                { id: 'comp2', component: component2 },
            ]);

            expect(workspace.getComponent('comp1')).toBe(component1);
            expect(workspace.getComponent('comp2')).toBe(component2);
        });

        it('should get all component keys', () => {
            const component1 = new TestComponent();
            const component2 = new TestComponent();
            component2.componentId = 'test-component-2';

            workspace.registerComponent('comp1', component1);
            workspace.registerComponent('comp2', component2);

            const keys = workspace.getComponentKeys();
            expect(keys).toContain('comp1');
            expect(keys).toContain('comp2');
        });
    });

    describe('Rendering', () => {
        it('should render workspace with registered components', async () => {
            const component = new TestComponent();
            workspace.registerComponent('test-component', component);

            const rendered = await workspace.render();
            expect(rendered).toContain('VIRTUAL WORKSPACE: Test Workspace');
            expect(rendered).toContain('test-component');
        });

        it('should render components section', () => {
            const component = new TestComponent();
            workspace.registerComponent('test-component', component);

            const rendered = workspace.renderComponentsSection();
            expect(rendered.render()).toContain('COMPONENTS');
            expect(rendered.render()).toContain('test-component');
        });
    });

    describe('Tool Management', () => {
        it('should get available tools from components', () => {
            const component = new TestComponent();
            workspace.registerComponent('test-component', component);

            const tools = workspace.getAvailableTools();
            expect(tools.length).toBeGreaterThan(0);
            expect(tools.find(t => t.toolName === 'test_tool')).toBeDefined();
        });

        it('should check if tool is available', () => {
            const component = new TestComponent();
            workspace.registerComponent('test-component', component);

            expect(workspace.isToolAvailable('test_tool')).toBe(true);
            expect(workspace.isToolAvailable('nonexistent_tool')).toBe(false);
        });

        it('should execute tool call', async () => {
            const component = new TestComponent();
            const handleToolCallSpy = vi.spyOn(component, 'handleToolCall');
            workspace.registerComponent('test-component', component);

            await workspace.handleToolCall('test_tool', {});

            expect(handleToolCallSpy).toHaveBeenCalledWith('test_tool', {});
        });
    });

    describe('Configuration', () => {
        it('should get workspace config', () => {
            const config = workspace.getConfig();
            expect(config.id).toBe('test-workspace');
            expect(config.name).toBe('Test Workspace');
        });

        it('should get workspace stats', () => {
            const component = new TestComponent();
            workspace.registerComponent('test-component', component);

            const stats = workspace.getStats();
            expect(stats.componentCount).toBe(1);
            expect(stats.componentKeys).toContain('test-component');
        });
    });

    describe('Constructor with components', () => {
        it('should accept components in config', () => {
            const component = new TestComponent();
            const ws = new VirtualWorkspace({
                id: 'constructor-test',
                name: 'Constructor Test',
                components: [component],
            });

            expect(ws.getComponent('test-component')).toBe(component);
        });
    });
});
