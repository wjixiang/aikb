import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentFactory } from '../../agent/AgentFactory.js';
import { VirtualWorkspace } from '../../statefulContext/index.js';
import { TYPES } from '../../di/types.js';
import { PicosComponent } from '../../components/PICOS/picosComponents.js';
import { getBuiltinSkills } from '../builtin/index.js';

/**
 * Test to verify DI token resolution in agent container
 * 
 * This test verifies that when an agent is created through the DI container,
 * the skill activation properly resolves DI tokens and loads tools from components.
 * 
 * The bug was that the agentContainer was not bound to TYPES.Container,
 * preventing VirtualWorkspace from injecting the container and passing it to SkillManager.
 * Without the container, SkillManager could not resolve DI tokens to extract tools from components.
 */

describe('Agent Container DI Token Resolution', () => {
    let workspace: VirtualWorkspace;
    let agentFactory: AgentFactory;

    beforeEach(() => {
        // Reset the container to ensure clean state for each test
        AgentFactory.resetContainer();
    });

    afterEach(() => {
        // Clean up after each test
        AgentFactory.resetContainer();
    });

    describe('Container binding in agent container', () => {
        it('should bind agentContainer to TYPES.Container', () => {
            // Create an agent through the factory
            const agent = AgentFactory.createWithContainer(
                {
                    capability: 'Test capability',
                    direction: 'Test direction'
                }
            );

            // Get the workspace from the agent
            workspace = agent.workspace as VirtualWorkspace;

            // Get the internal container from the workspace
            const internalContainer = (workspace as any).container;

            // Verify that the container is not undefined
            expect(internalContainer).toBeDefined();
            expect(internalContainer).not.toBeNull();

            // Verify that the container can resolve itself
            const resolvedContainer = internalContainer.get(TYPES.Container);
            expect(resolvedContainer).toBeDefined();
            expect(resolvedContainer).toBe(internalContainer);
        });

        it('should allow VirtualWorkspace to inject container', () => {
            // Create an agent through the factory
            const agent = AgentFactory.createWithContainer(
                {
                    capability: 'Test capability',
                    direction: 'Test direction'
                }
            );

            // Get the workspace from the agent
            workspace = agent.workspace as VirtualWorkspace;

            // Get the skill manager from the workspace
            const skillManager = workspace.getSkillManager();

            // Get the internal container from the skill manager
            const skillManagerContainer = (skillManager as any).container;

            // Verify that the skill manager has the container set
            expect(skillManagerContainer).toBeDefined();
            expect(skillManagerContainer).not.toBeNull();
        });
    });

    describe('DI token resolution during skill activation', () => {
        it('should resolve DI token when activating pico-extraction skill', async () => {
            // Create an agent through the factory
            const agent = AgentFactory.createWithContainer(
                {
                    capability: 'Test capability',
                    direction: 'Test direction'
                }
            );

            // Get the workspace from the agent
            workspace = agent.workspace as VirtualWorkspace;

            // Get the skill manager from the workspace
            const skillManager = workspace.getSkillManager();

            // Get the pico-extraction skill
            const skills = getBuiltinSkills();
            const picoSkill = skills.find(s => s.name === 'pico-extraction');
            expect(picoSkill).toBeDefined();

            // Activate the skill
            const result = await skillManager.activateSkill('pico-extraction');

            // Verify activation succeeded
            expect(result.success).toBe(true);

            // Verify that the skill has tools after activation
            expect(result.skill).toBeDefined();
            if (result.skill && result.skill.tools) {
                expect(result.skill.tools.length).toBeGreaterThan(0);

                // Verify that the tools are from PicosComponent
                const toolNames = result.skill.tools.map(t => t.toolName);
                expect(toolNames).toContain('set_picos_element');
                expect(toolNames).toContain('validate_picos');
                expect(toolNames).toContain('generate_clinical_question');
                expect(toolNames).toContain('export_picos');
            }

            // Verify that the component was resolved
            const component = skillManager.getComponent('pico-templater');
            expect(component).toBeDefined();
            expect(component).toBeInstanceOf(PicosComponent);
        });

        it('should make tools available through ToolManager after skill activation', async () => {
            // Create an agent through the factory
            const agent = AgentFactory.createWithContainer(
                {
                    capability: 'Test capability',
                    direction: 'Test direction'
                }
            );

            // Get the workspace from the agent
            workspace = agent.workspace as VirtualWorkspace;

            // Get the tool manager from the workspace
            const toolManager = workspace.getToolManager();

            // Activate the pico-extraction skill
            const skillManager = workspace.getSkillManager();
            await skillManager.activateSkill('pico-extraction');

            // Get all available tools from the tool manager
            const availableTools = toolManager.getAvailableTools();

            // Verify that PICO tools are available
            const toolNames = availableTools.map(t => t.toolName);
            expect(toolNames).toContain('set_picos_element');
            expect(toolNames).toContain('validate_picos');
            expect(toolNames).toContain('generate_clinical_question');
            expect(toolNames).toContain('export_picos');
        });

        it('should handle skill activation with multiple components', async () => {
            // Create an agent through the factory
            const agent = AgentFactory.createWithContainer(
                {
                    capability: 'Test capability',
                    direction: 'Test direction'
                }
            );

            // Get the workspace from the agent
            workspace = agent.workspace as VirtualWorkspace;

            // Get the skill manager from the workspace
            const skillManager = workspace.getSkillManager();

            // Get all built-in skills
            const skills = getBuiltinSkills();

            // Activate a skill with multiple components (meta-analysis-with-components)
            const metaAnalysisSkill = skills.find(s => s.name === 'meta-analysis-with-components');
            if (metaAnalysisSkill) {
                const result = await skillManager.activateSkill('meta-analysis-with-components');

                // Verify activation succeeded
                expect(result.success).toBe(true);

                // Verify that the skill has tools after activation
                if (result.skill && result.skill.tools) {
                    expect(result.skill.tools.length).toBeGreaterThan(0);

                    // Verify that components were resolved
                    if (result.addedComponents) {
                        expect(result.addedComponents.length).toBeGreaterThan(0);
                    }
                }
            }
        });
    });

    describe('Tool availability after skill activation', () => {
        it('should make tools available after skill activation', async () => {
            // Create an agent through the factory
            const agent = AgentFactory.createWithContainer(
                {
                    capability: 'Test capability',
                    direction: 'Test direction'
                }
            );

            // Get the workspace from the agent
            workspace = agent.workspace as VirtualWorkspace;

            // Get the tool manager from the workspace
            const toolManager = workspace.getToolManager();

            // Activate the pico-extraction skill
            const skillManager = workspace.getSkillManager();
            await skillManager.activateSkill('pico-extraction');

            // Verify that tools are available
            const availableTools = toolManager.getAvailableTools();
            const toolNames = availableTools.map(t => t.toolName);

            // Verify that PICO tools are available
            expect(toolNames).toContain('set_picos_element');
            expect(toolNames).toContain('validate_picos');
            expect(toolNames).toContain('generate_clinical_question');
            expect(toolNames).toContain('export_picos');
        });
    });

    describe('Error handling', () => {
        it('should handle missing DI token gracefully', async () => {
            // Create an agent through the factory
            const agent = AgentFactory.createWithContainer(
                {
                    capability: 'Test capability',
                    direction: 'Test direction'
                }
            );

            // Get the workspace from the agent
            workspace = agent.workspace as VirtualWorkspace;

            // Get the skill manager from the workspace
            const skillManager = workspace.getSkillManager();

            // Register a skill with an unbound DI token
            const { defineSkill, createComponentDefinition } = await import('../SkillDefinition.js');
            const skillWithMissingToken = defineSkill({
                name: 'test-missing-token',
                displayName: 'Test Missing Token',
                description: 'A test skill with missing DI token',
                version: '1.0.0',
                capabilities: ['Test capability'],
                workDirection: 'Test direction',
                components: [
                    createComponentDefinition(
                        'missing-component',
                        'Missing Component',
                        'A component that is not bound',
                        Symbol('MissingToken')
                    )
                ]
            });

            skillManager.register(skillWithMissingToken);

            // Activate the skill - should not throw
            const result = await skillManager.activateSkill('test-missing-token');

            // Activation should succeed even if component resolution fails
            expect(result.success).toBe(true);

            // Component should not be available
            const component = skillManager.getComponent('missing-component');
            expect(component).toBeUndefined();
        });
    });
});
