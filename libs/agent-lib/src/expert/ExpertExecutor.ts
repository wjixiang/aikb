/**
 * Expert Executor
 *
 * Responsible for creating, managing, and executing Expert instances
 */

import { Container } from 'inversify';
import type { IExpertExecutor, IExpertInstance, ExpertConfig, ExpertExecuteRequest, ExpertResult, ExpertArtifact, ExpertComponentDefinition } from './types.js';
import { ExpertRegistry } from './ExpertRegistry.js';
import { ExpertInstance } from './ExpertInstance.js';
import type { Agent, AgentConfig, AgentPrompt } from '../agent/agent.js';
import type { IVirtualWorkspace, VirtualWorkspaceConfig } from '../statefulContext/types.js';
import { AgentContainer, AgentCreationOptions } from '../di/container.js';
import { VirtualWorkspace } from '../statefulContext/virtualWorkspace.js';
import { ToolComponent } from 'agent-components';

export class ExpertExecutor implements IExpertExecutor {
    private expertInstances: Map<string, IExpertInstance> = new Map();
    private expertConfigs: Map<string, ExpertConfig> = new Map();
    private agentContainer: AgentContainer;

    constructor(
        private registry: ExpertRegistry,
        container?: Container, // Optional container (can be passed or undefined)
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

    /**
     * Get Expert instance
     */
    getExpert(expertId: string): IExpertInstance | undefined {
        return this.expertInstances.get(expertId);
    }

    /**
     * Release Expert instance
     */
    releaseExpert(expertId: string): void {
        const expert = this.expertInstances.get(expertId);
        if (expert) {
            expert.dispose();
            this.expertInstances.delete(expertId);
        }
    }

    /**
     * Execute Expert task directly
     */
    async execute(request: ExpertExecuteRequest): Promise<ExpertResult> {
        const expert = await this.createExpert(request.expertId);
        return expert.execute(request.task, request.context);
    }

    async createExpert(expertId: string): Promise<IExpertInstance> {
        const config = this.expertConfigs.get(expertId);
        if (!config) {
            throw new Error(`Expert "${expertId}" not found in registry`);
        }

        // Check if expert instance already exists
        if (this.expertInstances.has(expertId)) {
            return this.expertInstances.get(expertId)!;
        }

        // Create agent with Expert's prompt configuration
        const agentPrompt: AgentPrompt = {
            capability: config.prompt?.capability || config.responsibilities,
            direction: config.prompt?.direction || '',
        };

        // Configure workspace for this Expert
        const workspaceConfig: VirtualWorkspaceConfig = {
            id: `expert-${config.expertId}-workspace`,
            name: `${config.displayName} Workspace`,
            expertMode: true,
            alwaysRenderAllComponents: true,
        };

        // Create agent using AgentContainer
        const agent = this.agentContainer.createAgent({
            agentPrompt,
            virtualWorkspaceConfig: workspaceConfig,
            taskId: `expert-${config.expertId}`,
            // Pass API and agent configuration from ExpertConfig
            apiConfiguration: config.apiConfiguration,
            config: config.config,
        });

        // Register Expert's components to VirtualWorkspace (async, must await)
        await this.registerExpertComponents(agent, config.components);

        // Create ExpertInstance wrapping the Agent
        const expertInstance = new ExpertInstance(config, agent);
        this.expertInstances.set(expertId, expertInstance);

        console.log(`[ExpertExecutor] Created Expert instance for: ${config.expertId}`);
        return expertInstance;
    }

    /**
     * Register Expert's components to VirtualWorkspace
     *
     * Components are resolved from:
     * - Direct ToolComponent instances
     * - Factory functions: () => ToolComponent
     * - Async factory functions: () => Promise<ToolComponent>
     *
     * Note: DI tokens (Symbol) are no longer supported
     */
    private async registerExpertComponents(agent: Agent, components: ExpertComponentDefinition[]): Promise<void> {
        if (!components || components.length === 0) {
            console.log('[ExpertExecutor] No components to register for Expert');
            return;
        }

        // Get workspace from agent
        const workspace = (agent as any).workspace as VirtualWorkspace;
        if (!workspace) {
            console.warn('[ExpertExecutor] Could not get workspace from agent');
            return;
        }

        // Register components directly to the workspace's ComponentRegistry
        for (const comp of components) {
            const componentId = comp.componentId;
            let componentInstance: ToolComponent | undefined;

            // Resolve component instance based on its type
            const instance = comp.instance;

            if (instance instanceof ToolComponent) {
                // Already resolved - use directly
                componentInstance = instance;
            } else if (typeof instance === 'function') {
                // Factory function - call it to get instance
                const factory = instance as () => ToolComponent | Promise<ToolComponent>;
                const result = factory();
                if (result instanceof Promise) {
                    componentInstance = await result;
                } else {
                    componentInstance = result;
                }
            }

            if (componentInstance) {
                workspace.registerComponent(componentId, componentInstance, comp.priority);
                console.log(`[ExpertExecutor] Registered component: ${componentId}`);
            } else {
                console.warn(`[ExpertExecutor] Could not resolve component instance for: ${componentId}`);
            }
        }
    }
}
