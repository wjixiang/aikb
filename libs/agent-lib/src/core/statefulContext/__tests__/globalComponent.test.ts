/**
 * Global Component Tests
 *
 * Tests for the global component management functionality in VirtualWorkspace
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VirtualWorkspace } from '../virtualWorkspace.js';
import { TestComponent, TestComponent2 } from './testComponents.js';
import type { ToolComponent } from '../../../components/index.js';

describe('VirtualWorkspace Global Component Management', () => {
    let workspace: VirtualWorkspace;

    beforeEach(() => {
        workspace = new VirtualWorkspace({
            id: 'test-workspace',
            name: 'Test Workspace',
        });
    });

    describe('registerGlobalComponent', () => {
        it('should register a global component', () => {
            const component = new TestComponent();
            workspace.registerGlobalComponent('test-component', component);

            const retrieved = workspace.getGlobalComponent('test-component');
            expect(retrieved).toBe(component);
        });

        it('should register component with priority', () => {
            const component = new TestComponent();
            workspace.registerGlobalComponent('priority-component', component, -1);

            const retrieved = workspace.getGlobalComponent('priority-component');
            expect(retrieved).toBe(component);
        });

        it('should also register in component registry when using registerGlobalComponent', () => {
            const component = new TestComponent();
            workspace.registerGlobalComponent('dual-reg', component);

            // Should be accessible via both APIs
            expect(workspace.getGlobalComponent('dual-reg')).toBe(component);
            expect(workspace.getComponent('dual-reg')).toBe(component);
        });

        it('should also register tools in toolManager when using registerGlobalComponent', () => {
            const component = new TestComponent();
            workspace.registerGlobalComponent('tool-reg', component);

            // Tool should be available via workspace
            expect(workspace.isToolAvailable('test_tool')).toBe(true);
        });

        it('should log registration message', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            const component = new TestComponent();

            workspace.registerGlobalComponent('logged-component', component);

            expect(consoleSpy).toHaveBeenCalledWith(
                '[VirtualWorkspace] Registered global component: logged-component'
            );
            consoleSpy.mockRestore();
        });
    });

    describe('getGlobalComponent', () => {
        it('should retrieve registered global component', () => {
            const component = new TestComponent();
            workspace.registerGlobalComponent('retrieve-test', component);

            const retrieved = workspace.getGlobalComponent('retrieve-test');
            expect(retrieved).toBe(component);
        });

        it('should return undefined for non-existent component', () => {
            const retrieved = workspace.getGlobalComponent('non-existent');
            expect(retrieved).toBeUndefined();
        });
    });

    describe('hasGlobalComponent', () => {
        it('should return true for registered component', () => {
            const component = new TestComponent();
            workspace.registerGlobalComponent('exists-check', component);

            expect(workspace.hasGlobalComponent('exists-check')).toBe(true);
        });

        it('should return false for non-registered component', () => {
            expect(workspace.hasGlobalComponent('does-not-exist')).toBe(false);
        });
    });

    describe('getGlobalComponentIds', () => {
        it('should return empty array when no global components registered', () => {
            const ids = workspace.getGlobalComponentIds();
            expect(ids).toEqual([]);
        });

        it('should return all registered global component ids', () => {
            const component1 = new TestComponent();
            const component2 = new TestComponent2();

            workspace.registerGlobalComponent('global-1', component1);
            workspace.registerGlobalComponent('global-2', component2);

            const ids = workspace.getGlobalComponentIds();
            expect(ids).toContain('global-1');
            expect(ids).toContain('global-2');
            expect(ids.length).toBe(2);
        });
    });

    describe('globalComponents config initialization', () => {
        it('should initialize global components from config (sync factory)', () => {
            const component = new TestComponent();
            const ws = new VirtualWorkspace({
                id: 'config-init-workspace',
                name: 'Config Init Workspace',
                globalComponents: [
                    {
                        componentId: 'config-global',
                        factory: () => component,
                        priority: -1,
                    },
                ],
            });

            expect(ws.hasGlobalComponent('config-global')).toBe(true);
            expect(ws.getGlobalComponent('config-global')).toBe(component);
        });

        it('should handle async factory with warning (sync initialization)', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const asyncFactory = async () => new TestComponent();

            const ws = new VirtualWorkspace({
                id: 'async-factory-workspace',
                name: 'Async Factory Workspace',
                globalComponents: [
                    {
                        componentId: 'async-global',
                        factory: asyncFactory as () => ToolComponent,
                    },
                ],
            });

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Async global component factory')
            );
            consoleSpy.mockRestore();
        });
    });

    describe('interaction with regular components', () => {
        it('should maintain separate storage for global and regular components', () => {
            const globalComp = new TestComponent();
            const regularComp = new TestComponent2();

            workspace.registerGlobalComponent('global-only', globalComp);
            workspace.registerComponent('regular-only', regularComp);

            expect(workspace.getGlobalComponentIds()).toEqual(['global-only']);
            expect(workspace.getComponentKeys()).toContain('regular-only');
        });

        it('should allow same component registered via both APIs', () => {
            const component = new TestComponent();

            // Register via both methods
            workspace.registerGlobalComponent('shared', component);
            workspace.registerComponent('shared', component);

            // Both should return the same component
            expect(workspace.getGlobalComponent('shared')).toBe(component);
            expect(workspace.getComponent('shared')).toBe(component);
        });
    });

    describe('priority handling', () => {
        it('should respect priority when registering global components', () => {
            const component1 = new TestComponent();
            const component2 = new TestComponent2();

            workspace.registerGlobalComponent('low-priority', component1, 10);
            workspace.registerGlobalComponent('high-priority', component2, -1);

            // High priority should be accessible
            expect(workspace.getGlobalComponent('high-priority')).toBe(component2);
            expect(workspace.getGlobalComponent('low-priority')).toBe(component1);
        });
    });
});

describe('IVirtualWorkspace Interface - Global Component API', () => {
    it('should expose all required global component methods', () => {
        const workspace = new VirtualWorkspace({
            id: 'interface-test',
            name: 'Interface Test',
        });

        // Verify methods exist
        expect(typeof workspace.registerGlobalComponent).toBe('function');
        expect(typeof workspace.getGlobalComponent).toBe('function');
        expect(typeof workspace.hasGlobalComponent).toBe('function');
        expect(typeof workspace.getGlobalComponentIds).toBe('function');
    });
});
