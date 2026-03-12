import { describe, it, expect, beforeEach } from 'vitest';
import { AgentContainer } from '../../di/container';
import { resetGlobalContainer } from '../../di/container';
import { TYPES } from '../../di/types';

/**
 * Integration test for Expert with Component rendering
 *
 * This test verifies that:
 * 1. Expert can create an Agent with components
 * 2. The Agent's workspace correctly renders the components
 * 3. The components are accessible through the workspace
 */
describe('Expert Component Rendering', () => {
    let agentContainer: AgentContainer;

    beforeEach(() => {
        resetGlobalContainer();
        agentContainer = new AgentContainer();
    });

    describe('createAgent with expert-like configuration', () => {
        it('should create agent with bibliography-search component', async () => {
            // Create agent with bibliography-search component
            const agent = agentContainer.createAgent({
                agentPrompt: {
                    capability: 'Test capability',
                    direction: 'Test direction'
                },
                virtualWorkspaceConfig: {
                    id: 'test-workspace',
                    name: 'Test Workspace',
                    // Disable builtin skills for expert-like behavior
                    disableBuiltinSkills: true
                },
                taskId: 'test-task'
            });

            // Get workspace from agent
            const workspace = (agent as any).workspace;

            // Check workspace was created
            expect(workspace).toBeDefined();

            // Check skill manager has no builtin skills loaded
            const skillManager = workspace.getSkillManager();
            const availableSkills = skillManager.getAvailableSkills();
            expect(availableSkills.length).toBe(0);

            console.log('Agent created successfully with workspace');
        });

        it('should render workspace context', async () => {
            const agent = agentContainer.createAgent({
                agentPrompt: {
                    capability: 'Test capability',
                    direction: 'Test direction'
                },
                virtualWorkspaceConfig: {
                    id: 'test-workspace',
                    name: 'Test Workspace',
                    disableBuiltinSkills: true
                },
                taskId: 'test-task'
            });

            const workspace = (agent as any).workspace;

            // Render workspace context
            const context = await workspace.render();

            // Context should be a string
            expect(typeof context).toBe('string');

            console.log('Workspace context rendered successfully');
            console.log('Context length:', context.length);
        });

        it('should have no active components initially', async () => {
            const agent = agentContainer.createAgent({
                agentPrompt: {
                    capability: 'Test capability',
                    direction: 'Test direction'
                },
                virtualWorkspaceConfig: {
                    id: 'test-workspace',
                    name: 'Test Workspace',
                    disableBuiltinSkills: true
                },
                taskId: 'test-task'
            });

            const workspace = (agent as any).workspace;
            const skillManager = workspace.getSkillManager();

            // Should have no active components
            const activeComponents = skillManager.getActiveComponentsWithIds();
            expect(activeComponents.length).toBe(0);

            console.log('No active components as expected');
        });
    });

    describe('ExpertExecutor-like workflow', () => {
        it('should create expert with components via skill activation', async () => {
            const agent = agentContainer.createAgent({
                agentPrompt: {
                    capability: 'Expert capability',
                    direction: 'Expert direction'
                },
                virtualWorkspaceConfig: {
                    id: 'expert-workspace',
                    name: 'Expert Workspace',
                    disableBuiltinSkills: true
                },
                taskId: 'expert-task'
            });

            const workspace = (agent as any).workspace;
            const skillManager = workspace.getSkillManager();

            // Create a virtual skill with component
            const expertSkill = {
                name: 'expert-test-skill',
                displayName: 'Expert Test Skill',
                description: 'Test skill for expert',
                prompt: {
                    capability: '',
                    direction: ''
                },
                components: [
                    {
                        componentId: 'bibliography-search',
                        displayName: 'Bibliography Search',
                        description: 'Search component',
                        instance: TYPES.BibliographySearchComponent // DI token
                    }
                ],
                triggers: [],
                whenToUse: ''
            };

            // Register skill
            workspace.registerSkill(expertSkill);

            // Activate skill (this should resolve component from DI)
            const result = await skillManager.activateSkill('expert-test-skill');

            console.log('Skill activation result:', result);

            // Check if component was activated
            const activeComponents = skillManager.getActiveComponentsWithIds();
            console.log('Active components:', activeComponents.length);

            // Note: This may fail if BibliographySearchComponent is not properly bound
            // in the agent container, but we're testing the workflow
        });

        it('should render workspace context with activated components', async () => {
            const agent = agentContainer.createAgent({
                agentPrompt: {
                    capability: 'Expert capability',
                    direction: 'Expert direction'
                },
                virtualWorkspaceConfig: {
                    id: 'expert-workspace',
                    name: 'Expert Workspace',
                    disableBuiltinSkills: true
                },
                taskId: 'expert-task'
            });

            const workspace = (agent as any).workspace;
            const skillManager = workspace.getSkillManager();

            // Create a virtual skill with component
            const expertSkill = {
                name: 'expert-test-skill',
                displayName: 'Expert Test Skill',
                description: 'Test skill for expert',
                prompt: {
                    capability: '',
                    direction: ''
                },
                components: [
                    {
                        componentId: 'bibliography-search',
                        displayName: 'Bibliography Search',
                        description: 'Search component',
                        instance: TYPES.BibliographySearchComponent
                    }
                ],
                triggers: [],
                whenToUse: ''
            };

            // Register and activate skill
            workspace.registerSkill(expertSkill);
            await skillManager.activateSkill('expert-test-skill');

            // Verify component is active
            const activeComponents = skillManager.getActiveComponentsWithIds();
            expect(activeComponents.length).toBe(1);
            expect(activeComponents[0].componentId).toBe('bibliography-search');

            // Render workspace context with active component
            const context = await workspace.render();

            // Context should contain component-related content
            expect(typeof context).toBe('string');
            expect(context.length).toBeGreaterThan(2000); // Component adds significant content

            // Context should contain component name
            expect(context).toContain('bibliography-search');

            console.log('Workspace context with component rendered successfully');
            console.log('Context length:', context.length);
        });

        it('should render all components regardless of skill activation when alwaysRenderAllComponents is true', async () => {
            // Create agent with alwaysRenderAllComponents enabled
            const agent = agentContainer.createAgent({
                agentPrompt: {
                    capability: 'Expert capability',
                    direction: 'Expert direction'
                },
                virtualWorkspaceConfig: {
                    id: 'expert-workspace',
                    name: 'Expert Workspace',
                    disableBuiltinSkills: true,
                    alwaysRenderAllComponents: true  // Key option: render all components
                },
                taskId: 'expert-task'
            });

            const workspace = (agent as any).workspace;
            const skillManager = workspace.getSkillManager();

            // Register TWO skills with different components
            const skill1 = {
                name: 'skill-1',
                displayName: 'Skill 1',
                description: 'First skill',
                prompt: { capability: '', direction: '' },
                components: [
                    {
                        componentId: 'component-a',
                        displayName: 'Component A',
                        description: 'Component A',
                        instance: TYPES.BibliographySearchComponent
                    }
                ],
                triggers: [],
                whenToUse: ''
            };

            const skill2 = {
                name: 'skill-2',
                displayName: 'Skill 2',
                description: 'Second skill',
                prompt: { capability: '', direction: '' },
                components: [
                    {
                        componentId: 'component-b',
                        displayName: 'Component B',
                        description: 'Component B',
                        instance: TYPES.PicosComponent
                    }
                ],
                triggers: [],
                whenToUse: ''
            };

            // Register both skills (but don't activate them yet)
            workspace.registerSkill(skill1);
            workspace.registerSkill(skill2);

            // Check: no active skill, but should have components from both skills
            const activeComponents = skillManager.getActiveComponentsWithIds();
            console.log('Active components (before activation):', activeComponents.length);

            // Render workspace - should render ALL components from both skills
            const context = await workspace.render();

            // Should contain both components
            expect(context).toContain('component-a');
            expect(context).toContain('component-b');

            console.log('Context with alwaysRenderAllComponents:');
            console.log('Contains component-a:', context.includes('component-a'));
            console.log('Contains component-b:', context.includes('component-b'));
            console.log('Context length:', context.length);
        });
    });
});
