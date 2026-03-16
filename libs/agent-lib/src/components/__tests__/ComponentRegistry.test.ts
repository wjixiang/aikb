/**
 * ComponentRegistry Tests
 *
 * Tests for the ComponentRegistry class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentRegistry } from '../ComponentRegistry.js';
import { TestComponent, AnotherComponent } from '../../core/statefulContext/__tests__/testComponents.js';

describe('ComponentRegistry', () => {
    let registry: ComponentRegistry;

    beforeEach(() => {
        registry = new ComponentRegistry();
    });

    describe('Registration', () => {
        it('should register a component', () => {
            const component = new TestComponent();
            registry.register('test-comp', component);

            expect(registry.get('test-comp')).toBe(component);
        });

        it('should register multiple components from record', () => {
            const comp1 = new TestComponent();
            const comp2 = new AnotherComponent();

            registry.registerAll({
                'comp1': comp1,
                'comp2': comp2,
            });

            expect(registry.get('comp1')).toBe(comp1);
            expect(registry.get('comp2')).toBe(comp2);
        });

        it('should register components with priority', () => {
            const comp1 = new TestComponent();
            const comp2 = new AnotherComponent();

            registry.registerWithPriority([
                { id: 'comp1', component: comp1, priority: 10 },
                { id: 'comp2', component: comp2, priority: 5 },
            ]);

            const all = registry.getAll();
            expect(all[0]).toBe(comp2); // lower priority first
            expect(all[1]).toBe(comp1);
        });

        it('should check if component exists', () => {
            const component = new TestComponent();
            registry.register('test-comp', component);

            expect(registry.has('test-comp')).toBe(true);
            expect(registry.has('nonexistent')).toBe(false);
        });

        it('should unregister a component', () => {
            const component = new TestComponent();
            registry.register('test-comp', component);

            const result = registry.unregister('test-comp');
            expect(result).toBe(true);
            expect(registry.get('test-comp')).toBeUndefined();
        });
    });

    describe('Retrieval', () => {
        it('should get registration info', () => {
            const component = new TestComponent();
            registry.register('test-comp', component, 5);

            const reg = registry.getRegistration('test-comp');
            expect(reg).toBeDefined();
            expect(reg?.id).toBe('test-comp');
            expect(reg?.priority).toBe(5);
        });

        it('should get all component IDs', () => {
            registry.register('comp1', new TestComponent());
            registry.register('comp2', new AnotherComponent());

            const ids = registry.getIds();
            expect(ids).toContain('comp1');
            expect(ids).toContain('comp2');
        });

        it('should get all components sorted by priority', () => {
            const comp1 = new TestComponent();
            const comp2 = new AnotherComponent();

            registry.register('comp1', comp1, 10);
            registry.register('comp2', comp2, 5);

            const all = registry.getAll();
            expect(all[0]).toBe(comp2); // priority 5 first
            expect(all[1]).toBe(comp1);
        });

        it('should return size', () => {
            expect(registry.size).toBe(0);

            registry.register('comp1', new TestComponent());
            registry.register('comp2', new AnotherComponent());

            expect(registry.size).toBe(2);
        });
    });

    describe('Tool Management', () => {
        it('should get all tools from all components', () => {
            const comp1 = new TestComponent();
            const comp2 = new AnotherComponent();

            registry.register('comp1', comp1);
            registry.register('comp2', comp2);

            const tools = registry.getAllTools();
            expect(tools.length).toBe(2);
            expect(tools.find(t => t.tool.toolName === 'test_tool')).toBeDefined();
            expect(tools.find(t => t.tool.toolName === 'another_tool')).toBeDefined();
        });

        it('should get tool count', () => {
            const comp1 = new TestComponent();
            const comp2 = new AnotherComponent();

            registry.register('comp1', comp1); // 1 tool
            registry.register('comp2', comp2);  // 1 tool

            expect(registry.getToolCount()).toBe(2);
        });
    });

    describe('Clear', () => {
        it('should clear all components', () => {
            registry.register('comp1', new TestComponent());
            registry.register('comp2', new AnotherComponent());

            registry.clear();

            expect(registry.size).toBe(0);
            expect(registry.getAllTools().length).toBe(0);
        });
    });
});
