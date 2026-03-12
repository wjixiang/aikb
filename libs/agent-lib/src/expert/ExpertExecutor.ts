/**
 * Expert Executor
 *
 * Responsible for creating, managing, and executing Expert instances
 */

import { injectable, inject, Container } from 'inversify';
import type { IExpertExecutor, IExpertInstance, ExpertConfig, ExpertExecuteRequest, ExpertResult, ExpertArtifact } from './types.js';
import { ExpertRegistry } from './ExpertRegistry.js';
import { ExpertInstance } from './ExpertInstance.js';
import type { Agent, AgentConfig, AgentPrompt } from '../agent/agent.js';
import type { IVirtualWorkspace } from '../statefulContext/types.js';
import { TYPES } from '../di/types.js';
import type { ILogger } from '../utils/logging/types.js';

@injectable()
export class ExpertExecutor implements IExpertExecutor {
    @inject(TYPES.Logger) private logger!: ILogger;

    private expertInstances: Map<string, IExpertInstance> = new Map();
    private expertConfigs: Map<string, ExpertConfig> = new Map();

    constructor(
        private registry: ExpertRegistry,
    ) {}

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
        const agent = this.createAgent(config);

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
     * Create Agent instance
     */
    private createAgent(config: ExpertConfig): Agent {
        // Here we need to create Agent based on AgentContainer logic
        // Simplified version: return a new Agent instance
        // Full implementation requires injecting Container and other dependencies

        // TODO: Implement full Agent creation logic
        // Needs:
        // 1. Create VirtualWorkspace and register config.components
        // 2. Create Agent and inject workspace
        // 3. Configure Agent's system prompt

        throw new Error('ExpertExecutor.createAgent() needs full implementation with DI container');
    }
}
