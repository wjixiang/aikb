/**
 * Expert Implementation - Thin Wrapper around Agent
 *
 * ExpertInstance is a lightweight proxy that delegates all lifecycle
 * management to the underlying Agent. It provides Expert-specific
 * identity (expertId, instanceId) but no independent state.
 */

import { injectable } from 'inversify';
import { Agent } from '../agent/agent.js';
import type { ILogger } from '../utils/logging/types.js';
import type {
    ExpertConfig,
    ExpertResult,
    ExpertArtifact,
    IExpertInstance,
} from './types.js';
import type { IExpertPersistenceStore, ExpertInstanceState } from './persistence/index.js';
import type { AgentStatus } from '../common/types.js';

/**
 * Expert instance implementation - thin wrapper around Agent
 */
@injectable()
export class ExpertInstance implements IExpertInstance {
    /** Expert class ID */
    public expertId: string;
    /** Instance ID - unique runtime identifier */
    public instanceId: string;

    private agent: Agent;
    private config: ExpertConfig;
    private artifacts: ExpertArtifact[] = [];

    // Persistence
    private persistenceStore?: IExpertPersistenceStore;

    constructor(
        config: ExpertConfig,
        agent: Agent,
        instanceId: string,
        persistenceStore?: IExpertPersistenceStore,
    ) {
        this.expertId = config.expertId;
        this.instanceId = instanceId;
        this.config = config;
        this.agent = agent;
        this.persistenceStore = persistenceStore;
    }

    /**
     * Status delegated to Agent's status
     */
    get status(): AgentStatus {
        return this.agent.status;
    }

    /**
     * Start Expert in message-driven mode
     * Delegates to Agent's startMailDrivenMode
     */
    async start(): Promise<void> {
        const pollInterval = this.config.mailConfig?.pollInterval || 30000;
        await this.agent.startMailDrivenMode(pollInterval);
    }

    /**
     * Check if running
     */
    isRunning(): boolean {
        return this.agent.status === 'running' || this.agent.isMailDrivenRunning();
    }

    /**
     * Stop Expert - delegates to Agent.abort()
     */
    async stop(): Promise<void> {
        this.agent.abort('Expert stopped by user', 'manual');
        this.agent.stopMailDrivenMode();
        await this.persistState();
    }

    async getStateSummary(): Promise<string> {
        // Get component state summary from workspace
        const workspace = this.agent.workspace;
        const stats = workspace.getStats();

        // Extract state from components
        const componentSummaries: string[] = [];
        const componentKeys = workspace.getComponentKeys();

        for (const key of componentKeys) {
            const component = workspace.getComponent(key);
            if (component) {
                const state = component.getState();
                componentSummaries.push(`- ${key}: ${JSON.stringify(state)}`);
            }
        }

        return `
Expert: ${this.config.displayName}
Status: ${this.status}
Components: ${stats.componentCount}
Component States:
${componentSummaries.join('\n') || 'No components'}
`.trim();
    }

    getArtifacts(): ExpertArtifact[] {
        return this.artifacts;
    }

    async dispose(): Promise<void> {
        if (this.status === 'running') {
            this.agent.abort('Expert disposed', 'manual');
        }
        this.agent.stopMailDrivenMode();
        await this.persistState();
        this.artifacts = [];
        this.logger.info(`Expert ${this.expertId} disposed`);
    }

    /**
     * Add artifact
     */
    addArtifact(artifact: ExpertArtifact): void {
        this.artifacts.push(artifact);
    }

    /**
     * Get Agent instance (for Controller use)
     */
    getAgent(): Agent {
        return this.agent;
    }

    /**
     * Persist current state to persistence store
     */
    private async persistState(): Promise<void> {
        if (!this.persistenceStore) {
            return;
        }

        const state: ExpertInstanceState = {
            expertClassId: this.expertId,
            instanceId: this.instanceId,
            status: this.agent.status,
        };

        try {
            await this.persistenceStore.saveInstance(state);
        } catch (err) {
            this.logger.error(`Expert ${this.expertId}: Failed to persist state: ${err}`);
        }
    }

    private get logger(): ILogger {
        return (this.agent as any).logger || console;
    }
}
