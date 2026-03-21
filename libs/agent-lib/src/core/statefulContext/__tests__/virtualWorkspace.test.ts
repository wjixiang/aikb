/**
 * VirtualWorkspace Tests
 *
 * Tests for the new component-based architecture (without Skill system)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VirtualWorkspace } from '../virtualWorkspace.js';
import type { DIComponentRegistration } from '../virtualWorkspace.js';
import { TestComponent, TestComponent2 } from './testComponents.js';

describe('VirtualWorkspace (Component-based)', () => {
    let workspace: VirtualWorkspace;

    beforeEach(() => {
        workspace = new VirtualWorkspace({
            id: 'test-workspace',
            name: 'Test Workspace',
        });
    });

    describe('Component Registration', () => {
        it('should register a component via DI', () => {
            const component = new TestComponent();
            const diComponents: DIComponentRegistration[] = [
                { id: 'test-component', component }
            ];
            const ws = new VirtualWorkspace({
                id: 'di-test',
                name: 'DI Test',
            }, undefined, diComponents);

            const retrieved = ws.getComponent('test-component');
            expect(retrieved).toBe(component);
        });

        it('should register multiple components via DI', () => {
            const component1 = new TestComponent();
            const component2 = new TestComponent2();

            const diComponents: DIComponentRegistration[] = [
                { id: 'comp1', component: component1 },
                { id: 'comp2', component: component2 },
            ];
            const ws = new VirtualWorkspace({
                id: 'multi-test',
                name: 'Multi Test',
            }, undefined, diComponents);

            expect(ws.getComponent('comp1')).toBe(component1);
            expect(ws.getComponent('comp2')).toBe(component2);
        });

        it('should get all component keys', () => {
            const component1 = new TestComponent();
            const component2 = new TestComponent2();

            const diComponents: DIComponentRegistration[] = [
                { id: 'comp1', component: component1 },
                { id: 'comp2', component: component2 },
            ];
            const ws = new VirtualWorkspace({
                id: 'keys-test',
                name: 'Keys Test',
            }, undefined, diComponents);

            const keys = ws.getComponentKeys();
            expect(keys).toContain('comp1');
            expect(keys).toContain('comp2');
        });
    });

    describe('Rendering', () => {
        it('should render workspace with registered components', async () => {
            const component = new TestComponent();
            const diComponents: DIComponentRegistration[] = [
                { id: 'test-component', component }
            ];
            const ws = new VirtualWorkspace({
                id: 'render-test',
                name: 'Render Test',
            }, undefined, diComponents);

            const rendered = await ws.render();
            expect(rendered).toContain('VIRTUAL WORKSPACE: Render Test');
            expect(rendered).toContain('test-component');
        });

        it('should render components section', () => {
            const component = new TestComponent();
            const diComponents: DIComponentRegistration[] = [
                { id: 'test-component', component }
            ];
            const ws = new VirtualWorkspace({
                id: 'section-test',
                name: 'Section Test',
            }, undefined, diComponents);

            const rendered = ws.renderComponentsSection();
            expect(rendered.render()).toContain('COMPONENTS');
            expect(rendered.render()).toContain('test-component');
        });
    });

    describe('Tool Management', () => {
        it('should get available tools from components', () => {
            const component = new TestComponent();
            const diComponents: DIComponentRegistration[] = [
                { id: 'test-component', component }
            ];
            const ws = new VirtualWorkspace({
                id: 'tool-test',
                name: 'Tool Test',
            }, undefined, diComponents);

            const tools = ws.getAvailableTools();
            expect(tools.length).toBeGreaterThan(0);
            expect(tools.find(t => t.toolName === 'test_tool')).toBeDefined();
        });

        it('should check if tool is available', () => {
            const component = new TestComponent();
            const diComponents: DIComponentRegistration[] = [
                { id: 'test-component', component }
            ];
            const ws = new VirtualWorkspace({
                id: 'avail-test',
                name: 'Avail Test',
            }, undefined, diComponents);

            expect(ws.isToolAvailable('test_tool')).toBe(true);
            expect(ws.isToolAvailable('nonexistent_tool')).toBe(false);
        });

        it('should execute tool call', async () => {
            const component = new TestComponent();
            const handleToolCallSpy = vi.spyOn(component, 'handleToolCall');
            const diComponents: DIComponentRegistration[] = [
                { id: 'test-component', component }
            ];
            const ws = new VirtualWorkspace({
                id: 'exec-test',
                name: 'Exec Test',
            }, undefined, diComponents);

            await ws.handleToolCall('test_tool', {});

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
            const diComponents: DIComponentRegistration[] = [
                { id: 'test-component', component }
            ];
            const ws = new VirtualWorkspace({
                id: 'stats-test',
                name: 'Stats Test',
            }, undefined, diComponents);

            const stats = ws.getStats();
            expect(stats.componentCount).toBe(1);
            expect(stats.componentKeys).toContain('test-component');
        });
    });

    describe('Constructor with components', () => {
        it('should accept components in config (legacy)', () => {
            const component = new TestComponent();
            // Using config.components - component ID is derived from componentId property
            const ws = new VirtualWorkspace({
                id: 'constructor-test',
                name: 'Constructor Test',
                components: [component],
            });

            // Component ID comes from component.componentId property
            expect(ws.getComponent('test-component')).toBe(component);
        });
    });

    describe('render component according to render mode', () => {
        it('should render in markdown', async () => {
            // Placeholder for markdown render test
        })
    })
});
