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
 * Tests verify that:
 * 1. Component tools are enabled/disabled based on active skill
 * 2. Global tools remain always enabled
 * 3. Strategy pattern correctly applies skill-based tool filtering
 */
describe('Skill-based Component Tool Activation', () => {
    let toolManager: ToolManager;
    let skillManager: SkillManager;
    let componentProviderA: ComponentToolProvider;
    let componentProviderB: ComponentToolProvider;
    let componentProviderC: ComponentToolProvider;
    let globalProvider: GlobalToolProvider;

    // Mock skill with specific tools
    let mockSkill: Skill;
    let mockSkillWithMultipleTools: Skill;

    beforeEach(() => {
        // Create ToolManager
        toolManager = new ToolManager();

        // Create SkillManager with callback to handle skill changes
        skillManager = new SkillManager({
            onSkillChange: (skill) => {
                // This callback is called when a skill is activated/deactivated
                // It updates the tool manager's strategy
                toolManager.setStrategy(skill);
                toolManager.applyStrategy();
            }
        });

        // Create GlobalToolProvider with skillManager
        globalProvider = new GlobalToolProvider(skillManager);
        toolManager.registerProvider(globalProvider);

        // Create component providers
        const componentA = new TestToolComponentA();
        const componentB = new TestToolComponentB();
        const componentC = new TestToolComponentC();

        componentProviderA = new ComponentToolProvider('componentA', componentA);
        componentProviderB = new ComponentToolProvider('componentB', componentB);
        componentProviderC = new ComponentToolProvider('componentC', componentC);

        // Register component providers
        toolManager.registerProvider(componentProviderA);
        toolManager.registerProvider(componentProviderB);
        toolManager.registerProvider(componentProviderC);

        // Create mock skills
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
            tools: [
                {
                    toolName: 'search',
                    desc: 'Search tool from skill',
                    paramsSchema: z.object({ query: z.string() })
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
            tools: [
                {
                    toolName: 'search',
                    desc: 'Search tool from skill',
                    paramsSchema: z.object({ query: z.string() })
                },
                {
                    toolName: 'increment',
                    desc: 'Increment tool from skill',
                    paramsSchema: z.object({ amount: z.number().optional() })
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

            // Component tools should be disabled when no skill is active (NoSkillStrategy)
            expect(availableTools).not.toContainEqual(expect.objectContaining({ toolName: 'search' }));
            expect(availableTools).not.toContainEqual(expect.objectContaining({ toolName: 'increment' }));
            expect(availableTools).not.toContainEqual(expect.objectContaining({ toolName: 'toggle' }));
        });

        it('should have global tools enabled regardless of skill state', () => {
            const availableTools = toolManager.getAvailableTools();

            // Global tools like get_skill should always be available
            expect(availableTools).toContainEqual(expect.objectContaining({ toolName: 'get_skill' }));
        });

        it('should use NoSkillStrategy when no skill is active', () => {
            const strategy = toolManager.getCurrentStrategy();
            expect(strategy.strategyName).toBe('no-skill');
        });
    });

    describe('Single Tool Skill Activation', () => {
        it('should enable only skill tools and disable other component tools', async () => {
            // Register the mock skill
            skillManager.register(mockSkill);

            // Activate the skill
            await skillManager.activateSkill('test-skill');

            // Check strategy changed
            expect(toolManager.getCurrentStrategy().strategyName).toBe('test-skill');

            // 'search' should be enabled (it's in the skill)
            expect(toolManager.isToolEnabled('search')).toBe(true);

            // 'increment' and 'toggle' should be disabled (not in the skill)
            expect(toolManager.isToolEnabled('increment')).toBe(false);
            expect(toolManager.isToolEnabled('toggle')).toBe(false);

            // Global tools should still be enabled
            expect(toolManager.isToolEnabled('get_skill')).toBe(true);
        });

        it('should only return skill tools in getAvailableTools()', async () => {
            skillManager.register(mockSkill);
            await skillManager.activateSkill('test-skill');

            const availableTools = toolManager.getAvailableTools();
            const toolNames = availableTools.map(t => t.toolName);

            // Should contain search (from skill)
            expect(toolNames).toContain('search');

            // Should NOT contain increment and toggle (not in skill)
            expect(toolNames).not.toContain('increment');
            expect(toolNames).not.toContain('toggle');

            // Should contain global tools
            expect(toolNames).toContain('get_skill');
        });
    });

    describe('Multiple Tool Skill Activation', () => {
        it('should enable all tools defined in the skill', async () => {
            skillManager.register(mockSkillWithMultipleTools);
            await skillManager.activateSkill('multi-tool-skill');

            // Both search and increment should be enabled
            expect(toolManager.isToolEnabled('search')).toBe(true);
            expect(toolManager.isToolEnabled('increment')).toBe(true);

            // toggle should still be disabled
            expect(toolManager.isToolEnabled('toggle')).toBe(false);
        });
    });

    describe('Skill Deactivation', () => {
        it('should disable all component tools when skill is deactivated', async () => {
            skillManager.register(mockSkill);

            // Activate skill
            await skillManager.activateSkill('test-skill');
            expect(toolManager.isToolEnabled('search')).toBe(true);
            expect(toolManager.isToolEnabled('increment')).toBe(false);

            // Deactivate skill
            await skillManager.deactivateSkill();

            // Should revert to NoSkillStrategy
            expect(toolManager.getCurrentStrategy().strategyName).toBe('no-skill');

            // All component tools should be disabled again
            expect(toolManager.isToolEnabled('search')).toBe(false);
            expect(toolManager.isToolEnabled('increment')).toBe(false);
            expect(toolManager.isToolEnabled('toggle')).toBe(false);
        });
    });

    describe('Skill Switching', () => {
        it('should correctly switch tool enablement when changing skills', async () => {
            // Create another skill with different tools
            const anotherSkill: Skill = {
                name: 'another-skill',
                displayName: 'Another Skill',
                description: 'Another test skill',
                prompt: {
                    capability: 'Another capability',
                    direction: 'Another direction'
                },
                tools: [
                    {
                        toolName: 'toggle',
                        desc: 'Toggle tool from skill',
                        paramsSchema: z.object({})
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

    describe('Strategy Application Edge Cases', () => {
        it('should handle skill with no tools (all component tools disabled)', async () => {
            const skillWithNoTools: Skill = {
                name: 'empty-skill',
                displayName: 'Empty Skill',
                description: 'A skill with no tools',
                prompt: {
                    capability: 'Empty capability',
                    direction: 'Empty direction'
                },
                tools: []
            };

            skillManager.register(skillWithNoTools);
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
