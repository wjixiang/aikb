import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolManager } from '../ToolManager.js';
import { ComponentToolProvider } from '../providers/ComponentToolProvider.js';
import { GlobalToolProvider } from '../providers/GlobalToolProvider.js';
import { SkillManager } from '../../skills/SkillManager.js';
import type { Skill, Tool } from '../../skills/types.js';
import { TestToolComponentA, TestToolComponentB, TestToolComponentC } from '../../statefulContext/__tests__/testComponents.js';
import * as z from 'zod';

/**
 * Unit tests for skill-based component tool activation
 * 
 * Simplified tests - ToolManager now directly checks SkillManager for tool availability:
 * 1. Component tools are enabled/disabled based on active skill (dynamic check)
 * 2. Global tools remain always enabled
 * 3. No strategy pattern - direct SkillManager integration
 */
describe('Skill-based Component Tool Activation', () => {
    let toolManager: ToolManager;
    let skillManager: SkillManager;
    let componentProviderA: ComponentToolProvider;
    let componentProviderB: ComponentToolProvider;
    let componentProviderC: ComponentToolProvider;
    let globalProvider: GlobalToolProvider;

    // Component instances for use in skill definitions
    let componentA: TestToolComponentA;
    let componentB: TestToolComponentB;
    let componentC: TestToolComponentC;

    // Mock skill with specific tools
    let mockSkill: Skill;
    let mockSkillWithMultipleTools: Skill;

    beforeEach(() => {
        // Create component instances
        componentA = new TestToolComponentA();
        componentB = new TestToolComponentB();
        componentC = new TestToolComponentC();

        // Create ToolManager
        toolManager = new ToolManager();

        // Create SkillManager with callback
        skillManager = new SkillManager({
            onSkillChange: (skill) => {
                // Simplified: Just notify availability change when skill changes
                // ToolManager now dynamically checks SkillManager for tool availability
                toolManager.notifyAvailabilityChange();
            }
        });

        // Pass SkillManager to ToolManager for dynamic skill-based filtering
        toolManager.setSkillManager(skillManager);

        // Create GlobalToolProvider with skillManager
        globalProvider = new GlobalToolProvider(skillManager);
        toolManager.registerProvider(globalProvider);

        // Create component providers using the same instances

        componentProviderA = new ComponentToolProvider('componentA', componentA);
        componentProviderB = new ComponentToolProvider('componentB', componentB);
        componentProviderC = new ComponentToolProvider('componentC', componentC);

        // Register component providers
        toolManager.registerProvider(componentProviderA);
        toolManager.registerProvider(componentProviderB);
        toolManager.registerProvider(componentProviderC);

        // Create mock skills that reference components (not direct tools)
        // Note: Tools now come exclusively from components, not from skill.tools
        // Reuse the same component instances from lines 51-53
        // componentA = TestToolComponentA, componentB = TestToolComponentB, componentC = TestToolComponentC

        mockSkill = {
            name: 'test-skill',
            displayName: 'Test Skill',
            description: 'A test skill',
            whenToUse: 'Use for testing',
            triggers: ['test'],
            prompt: {
                capability: 'Test capability',
                direction: 'Test direction'
            },
            // Tools are now derived from components, not directly defined
            components: [
                {
                    componentId: 'componentA',
                    displayName: 'Component A',
                    description: 'Test component A',
                    instance: componentA
                }
            ]
        };

        mockSkillWithMultipleTools = {
            name: 'multi-tool-skill',
            displayName: 'Multi Tool Skill',
            description: 'A skill with multiple tools',
            whenToUse: 'Use for multiple tool testing',
            triggers: ['multi'],
            prompt: {
                capability: 'Multi tool capability',
                direction: 'Multi tool direction'
            },
            // Tools are now derived from components, not directly defined
            components: [
                {
                    componentId: 'componentA',
                    displayName: 'Component A',
                    description: 'Test component A',
                    instance: componentA
                },
                {
                    componentId: 'componentB',
                    displayName: 'Component B',
                    description: 'Test component B',
                    instance: componentB
                }
            ]
        };
    });

    describe('Initial State (No Skill Active)', () => {
        it('should have all component tools disabled when no skill is active', () => {
            const allTools = toolManager.getAllTools();
            const availableTools = toolManager.getAvailableTools();

            // All 3 component tools should be registered
            expect(allTools.length).toBeGreaterThanOrEqual(3);

            // Component tools should be disabled when no skill is active
            expect(availableTools).not.toContainEqual(expect.objectContaining({ toolName: 'search' }));
            expect(availableTools).not.toContainEqual(expect.objectContaining({ toolName: 'increment' }));
            expect(availableTools).not.toContainEqual(expect.objectContaining({ toolName: 'toggle' }));
        });

        it('should have global tools enabled regardless of skill state', () => {
            const availableTools = toolManager.getAvailableTools();

            // Global tools like get_skill should always be available
            expect(availableTools).toContainEqual(expect.objectContaining({ toolName: 'get_skill' }));
        });
    });

    describe('Single Tool Skill Activation', () => {
        it('should enable only skill tools and disable other component tools', async () => {
            skillManager.register(mockSkill);
            await skillManager.activateSkill('test-skill');

            // search is in the skill, should be enabled
            expect(toolManager.isToolEnabled('search')).toBe(true);

            // increment and toggle are not in the skill, should be disabled
            expect(toolManager.isToolEnabled('increment')).toBe(false);
            expect(toolManager.isToolEnabled('toggle')).toBe(false);
        });

        it('should only return skill tools in getAvailableTools()', async () => {
            skillManager.register(mockSkill);
            await skillManager.activateSkill('test-skill');

            const availableTools = toolManager.getAvailableTools();
            const toolNames = availableTools.map(t => t.toolName);

            // Should contain search (skill tool) and global tools
            expect(toolNames).toContain('search');
            expect(toolNames).toContain('get_skill');

            // Should NOT contain increment or toggle (not in skill)
            expect(toolNames).not.toContain('increment');
            expect(toolNames).not.toContain('toggle');
        });
    });

    describe('Multiple Tool Skill Activation', () => {
        it('should enable all tools defined in the skill', async () => {
            skillManager.register(mockSkillWithMultipleTools);
            await skillManager.activateSkill('multi-tool-skill');

            // Both search and increment are in the skill, should be enabled
            expect(toolManager.isToolEnabled('search')).toBe(true);
            expect(toolManager.isToolEnabled('increment')).toBe(true);

            // toggle is not in the skill, should be disabled
            expect(toolManager.isToolEnabled('toggle')).toBe(false);
        });

        it('should disable all component tools when skill is deactivated', async () => {
            skillManager.register(mockSkill);
            await skillManager.activateSkill('test-skill');

            // search should be enabled during skill activation
            expect(toolManager.isToolEnabled('search')).toBe(true);

            // Deactivate skill
            await skillManager.deactivateSkill();

            // All component tools should be disabled
            expect(toolManager.isToolEnabled('search')).toBe(false);
            expect(toolManager.isToolEnabled('increment')).toBe(false);
            expect(toolManager.isToolEnabled('toggle')).toBe(false);
        });
    });

    describe('Skill Switching', () => {
        it('should correctly switch tool enablement when changing skills', async () => {
            // Create another skill with different components (Component C has 'toggle')
            const componentC = new TestToolComponentC();
            const anotherSkill: Skill = {
                name: 'another-skill',
                displayName: 'Another Skill',
                description: 'Another test skill',
                prompt: {
                    capability: 'Another capability',
                    direction: 'Another direction'
                },
                components: [
                    {
                        componentId: 'componentC',
                        displayName: 'Component C',
                        description: 'Test component C',
                        instance: componentC
                    }
                ]
            };

            skillManager.register(mockSkill);
            skillManager.register(anotherSkill);

            // Activate first skill
            await skillManager.activateSkill('test-skill');
            expect(toolManager.isToolEnabled('search')).toBe(true);
            expect(toolManager.isToolEnabled('toggle')).toBe(false);

            // Switch to second skill
            await skillManager.activateSkill('another-skill');
            expect(toolManager.isToolEnabled('search')).toBe(false);
            expect(toolManager.isToolEnabled('toggle')).toBe(true);
        });
    });

    describe('Tool Execution with Active Skill', () => {
        it('should execute enabled tools successfully', async () => {
            skillManager.register(mockSkill);
            await skillManager.activateSkill('test-skill');

            // search is enabled, should execute without throwing
            // Note: The actual execution returns void (updates component state)
            await expect(toolManager.executeTool('search', { query: 'test' })).resolves.toBeUndefined();
        });

        it('should throw error when trying to execute disabled tool', async () => {
            skillManager.register(mockSkill);
            await skillManager.activateSkill('test-skill');

            // increment is disabled, should throw
            await expect(toolManager.executeTool('increment', { amount: 1 })).rejects.toThrow();
        });
    });

    describe('Tool Source Information', () => {
        it('should correctly identify component tool source', () => {
            const searchSource = toolManager.getToolSource('search');
            expect(searchSource?.source).toBe('component');
            expect(searchSource?.providerId).toBe('component:componentA');
        });

        it('should correctly identify global tool source', () => {
            const getSkillSource = toolManager.getToolSource('get_skill');
            expect(getSkillSource?.source).toBe('global');
        });
    });

    describe('Skill-based Tool Availability Edge Cases', () => {
        it('should handle skill with no components (all component tools disabled)', async () => {
            const skillWithNoComponents: Skill = {
                name: 'empty-skill',
                displayName: 'Empty Skill',
                description: 'A skill with no components',
                prompt: {
                    capability: 'Empty capability',
                    direction: 'Empty direction'
                },
                components: []
            };

            skillManager.register(skillWithNoComponents);
            await skillManager.activateSkill('empty-skill');

            // All component tools should be disabled
            expect(toolManager.isToolEnabled('search')).toBe(false);
            expect(toolManager.isToolEnabled('increment')).toBe(false);
            expect(toolManager.isToolEnabled('toggle')).toBe(false);

            // Global tools should still work
            expect(toolManager.isToolEnabled('get_skill')).toBe(true);
        });

        it('should handle activating same skill twice', async () => {
            skillManager.register(mockSkill);

            await skillManager.activateSkill('test-skill');
            const firstState = toolManager.isToolEnabled('search');

            await skillManager.activateSkill('test-skill');
            const secondState = toolManager.isToolEnabled('search');

            // State should be consistent
            expect(firstState).toBe(true);
            expect(secondState).toBe(true);
        });
    });

    describe('Tool Availability Callbacks', () => {
        it('should notify subscribers when tool availability changes', async () => {
            let callCount = 0;
            const unsubscribe = toolManager.onAvailabilityChange(() => {
                callCount++;
            });

            // Register providers triggers initial calls
            // Now activate a skill which should trigger more calls
            skillManager.register(mockSkill);
            const beforeActivationCount = callCount;

            await skillManager.activateSkill('test-skill');

            // Should be called after skill activation
            expect(callCount).toBeGreaterThan(beforeActivationCount);

            unsubscribe();
        });
    });
});
