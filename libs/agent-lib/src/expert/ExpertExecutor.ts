/**
 * Expert Executor
 *
 * Responsible for creating, managing, and executing Expert instances
 */

import { injectable, inject, optional, Container } from 'inversify';
import type { IExpertExecutor, IExpertInstance, ExpertConfig, ExpertExecuteRequest, ExpertResult, ExpertArtifact, ExpertComponentDefinition } from './types.js';
import { ExpertRegistry } from './ExpertRegistry.js';
import { ExpertInstance } from './ExpertInstance.js';
import type { Agent, AgentConfig, AgentPrompt } from '../agent/agent.js';
import type { IVirtualWorkspace, VirtualWorkspaceConfig } from '../statefulContext/types.js';
import { TYPES } from '../di/types.js';
import type { ILogger } from '../utils/logging/types.js';
import { AgentContainer, AgentCreationOptions } from '../di/container.js';
import { SkillManager } from '../skills/SkillManager.js';
import type { Skill } from '../skills/types.js';
import { VirtualWorkspace } from '../statefulContext/virtualWorkspace.js';

@injectable()
export class ExpertExecutor implements IExpertExecutor {
    @inject(TYPES.Logger) private logger!: ILogger;

    private expertInstances: Map<string, IExpertInstance> = new Map();
    private expertConfigs: Map<string, ExpertConfig> = new Map();
    private agentContainer: AgentContainer;

    constructor(
        private registry: ExpertRegistry,
        @inject(TYPES.Container) @optional() container?: Container,
    ) {
        // Use provided container or create a new AgentContainer
        // If container is provided, we can use it to get the global AgentContainer
        this.agentContainer = container
            ? (container as any).agentContainer || new AgentContainer()
            : new AgentContainer();
    }

    /**
     * Register Expert configuration
     */
    registerExpert(config: ExpertConfig): void {
        this.expertConfigs.set(config.expertId, config);
        this.registry.register(config);
    }

    async createExpert(expertId: string): Promise<IExpertInstance> {
        const config = this.expertConfigs.get(expertId);
        if (!config) {
            throw new Error(`Expert "${expertId}" not found in registry`);
        }

        // Create Agent instance
        const agent = await this.createAgent(config);

        // Create Expert instance
        const expertInstance = new ExpertInstance(config, agent);

        // Activate Expert
        await expertInstance.activate();

        this.expertInstances.set(expertId, expertInstance);
        return expertInstance;
    }

    getExpert(expertId: string): IExpertInstance | undefined {
        return this.expertInstances.get(expertId);
    }

    releaseExpert(expertId: string): void {
        const expert = this.expertInstances.get(expertId);
        if (expert) {
            expert.dispose();
            this.expertInstances.delete(expertId);
        }
    }

    async execute(request: ExpertExecuteRequest): Promise<ExpertResult> {
        let expert = this.expertInstances.get(request.expertId);

        // If Expert doesn't exist, create it
        if (!expert) {
            expert = await this.createExpert(request.expertId);
        }

        // Execute task
        return await expert.execute(request.task, request.context);
    }

    /**
     * Collect all Expert artifacts
     */
    collectAllArtifacts(): ExpertArtifact[] {
        const allArtifacts: ExpertArtifact[] = [];
        for (const expert of this.expertInstances.values()) {
            allArtifacts.push(...expert.getArtifacts());
        }
        return allArtifacts;
    }

    /**
     * Create Agent instance for Expert
     *
     * Reuses AgentContainer logic to create an Agent with Expert-specific configuration:
     * - Expert's capability and direction as agentPrompt
     * - Expert's components registered to VirtualWorkspace
     * - Unique workspace for each Expert
     */
    private async createAgent(config: ExpertConfig): Promise<Agent> {
        // Create agent with Expert's prompt configuration
        const agentPrompt: AgentPrompt = {
            capability: config.prompt?.capability || config.responsibilities,
            direction: config.prompt?.direction || '',
        };

        // Configure workspace for this Expert
        // IMPORTANT:
        // 1. Expert mode - disables all skill-related features
        // 2. Disable builtin skills to prevent Agent from switching to other skills
        // 3. Always render all registered components (Expert's components should always be visible)
        const workspaceConfig: VirtualWorkspaceConfig = {
            id: `expert-${config.expertId}-workspace`,
            name: `${config.displayName} Workspace`,
            expertMode: true, // Disable all skill-related context rendering
            disableBuiltinSkills: true, // Expert should NOT switch to other skills
            alwaysRenderAllComponents: true, // Always render all Expert's components
        };

        // Create agent using AgentContainer
        const agent = this.agentContainer.createAgent({
            agentPrompt,
            virtualWorkspaceConfig: workspaceConfig,
            taskId: `expert-${config.expertId}`,
        });

        // Register Expert's components to VirtualWorkspace (async, must await)
        await this.registerExpertComponents(agent, config.components);

        this.logger.info(`Created Agent for Expert: ${config.expertId}`);
        return agent;
    }

    /**
     * Register Expert's components to VirtualWorkspace
     *
     * Components are registered through SkillManager mechanism:
     * - Create a virtual Skill that wraps Expert's components
     * - Activate this Skill in the workspace
     */
    private async registerExpertComponents(agent: Agent, components: ExpertComponentDefinition[]): Promise<void> {
        if (!components || components.length === 0) {
            return;
        }

        // Get workspace from agent
        const workspace = (agent as any).workspace as VirtualWorkspace;
        if (!workspace) {
            this.logger.warn('Could not get workspace from agent');
            return;
        }

        // Create a virtual skill to wrap Expert's components
        const expertSkill: Skill = {
            name: `expert-${components[0]?.componentId?.split('-')[0] || 'skill'}`,
            displayName: 'Expert Skill',
            description: 'Virtual skill for expert components',
            prompt: {
                capability: '',
                direction: '',
            },
            components: components.map(comp => ({
                componentId: comp.componentId,
                displayName: comp.displayName,
                description: comp.description,
                // Use the instance if it's already resolved, otherwise pass the DI token for resolution
                instance: comp.instance,
            })),
            triggers: [],
            whenToUse: '',
        };

        // Register and activate the skill
        workspace.registerSkill(expertSkill);

        // Activate the skill to enable its components (async, must await)
        const result = await workspace.getSkillManager().activateSkill(expertSkill.name);
        if (!result.success) {
            this.logger.warn(`Failed to activate expert skill: ${result.message}`);
        } else {
            this.logger.info(`Activated expert skill with ${components.length} components`);
        }
    }
}
