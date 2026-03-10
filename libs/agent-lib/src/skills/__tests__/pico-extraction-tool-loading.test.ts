import { describe, it, expect, beforeEach } from 'vitest';
import { SkillManager } from '../SkillManager.js';
import { defineSkill, createComponentDefinition } from '../SkillDefinition.js';
import type { Skill, ComponentDefinition, Tool } from '../types.js';

/**
 * Test to reproduce the issue: PICO Extraction skill doesn't load internal tools
 * 
 * The problem is that when a skill uses a factory function (either sync or async)
 * for component definition, the tools from the component are not properly extracted
 * and loaded into the skill's tools array.
 */

describe('Skill with Factory Function Components - Tool Loading', () => {
    let manager: SkillManager;

    // Mock component that has tools
    class MockToolComponent {
        toolSet = new Map<string, Tool>([
            ['mock_tool_1', { toolName: 'mock_tool_1', desc: 'Mock tool 1', paramsSchema: {} as any }],
            ['mock_tool_2', { toolName: 'mock_tool_2', desc: 'Mock tool 2', paramsSchema: {} as any }]
        ]);

        async onActivate() {
            console.log('[MockToolComponent] Activated');
        }

        async onDeactivate() {
            console.log('[MockToolComponent] Deactivated');
        }
    }

    describe('Sync factory function', () => {
        const skillWithSyncFactory: Skill = defineSkill({
            name: 'test-sync-factory',
            displayName: 'Test Sync Factory',
            description: 'A test skill with sync factory function component',
            version: '1.0.0',
            capabilities: ['Test capability'],
            workDirection: 'Test direction',
            components: [
                createComponentDefinition(
                    'mock-component',
                    'Mock Component',
                    'A mock component for testing',
                    () => new MockToolComponent()
                )
            ]
        });

        it('should have components defined after building with sync factory', () => {
            // At build time, the skill has components defined (but factory functions are not called)
            // Tools are extracted from components at activation time
            console.log('Sync factory skill components at build time:', skillWithSyncFactory.components);
            // Components should be defined
            expect(skillWithSyncFactory.components).toBeDefined();
            expect(skillWithSyncFactory.components?.length).toBe(1);
        });

        it('should load tools when activating skill with sync factory', async () => {
            manager = new SkillManager();
            manager.register(skillWithSyncFactory);

            const result = await manager.activateSkill('test-sync-factory');
            console.log('Activation result:', result);

            // Check that the skill has tools after activation
            const tools = manager.getActiveTools();
            console.log('Active tools after activation:', tools);

            expect(tools.length).toBeGreaterThan(0);
            expect(tools.map(t => t.toolName)).toContain('mock_tool_1');
            expect(tools.map(t => t.toolName)).toContain('mock_tool_2');
        });
    });

    describe('Async factory function (like pico-extraction)', () => {
        const skillWithAsyncFactory: Skill = defineSkill({
            name: 'test-async-factory',
            displayName: 'Test Async Factory',
            description: 'A test skill with async factory function component (like pico-extraction)',
            version: '1.0.0',
            capabilities: ['Test capability'],
            workDirection: 'Test direction',
            components: [
                createComponentDefinition(
                    'mock-component-async',
                    'Mock Component Async',
                    'A mock component with async factory',
                    async () => {
                        // Simulating dynamic import like in pico-extraction
                        return new MockToolComponent();
                    }
                )
            ]
        });

        it('should have components after building with async factory', () => {
            // With async factory, the component is defined but not resolved at build time
            console.log('Async factory skill components at build time:', skillWithAsyncFactory.components);
            // Components should be defined
            expect(skillWithAsyncFactory.components).toBeDefined();
        });

        it('should load tools when activating skill with async factory', async () => {
            manager = new SkillManager();
            manager.register(skillWithAsyncFactory);

            const result = await manager.activateSkill('test-async-factory');
            console.log('Async factory activation result:', result);

            // Check that the skill has tools after activation
            const tools = manager.getActiveTools();
            console.log('Active tools after async activation:', tools);

            // This test will likely fail, showing the bug
            // The tools should be extracted from the component after activation
            expect(tools.length).toBeGreaterThan(0);
            expect(tools.map(t => t.toolName)).toContain('mock_tool_1');
            expect(tools.map(t => t.toolName)).toContain('mock_tool_2');
        });

        it('should have correct component instance after activation', async () => {
            manager = new SkillManager();
            manager.register(skillWithAsyncFactory);

            await manager.activateSkill('test-async-factory');

            const component = manager.getComponent('mock-component-async');
            console.log('Component after activation:', component);
            console.log('Is it a function?', typeof component);

            // The component should be an instance, not a factory function
            // This test will likely fail, showing the bug
            expect(component).toBeInstanceOf(MockToolComponent);
        });
    });
});
