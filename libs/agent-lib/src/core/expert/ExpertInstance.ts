/**
 * Expert Implementation - Independent Expert Agent
 *
 * Each Expert has:
 * - Independent VirtualWorkspace (manages Components)
 * - Independent MemoryModule (manages conversation history)
 * - Independent execution loop
 */

import { injectable } from 'inversify';
import { Agent } from '../agent/agent.js';
import type { ILogger } from '../utils/logging/types.js';
import type {
    ExpertConfig,
    ExpertStatus,
    ExpertResult,
    ExpertArtifact,
    IExpertInstance,
} from './types.js';
import type { ToolComponent } from '../../components/index.js';
import type { IExpertPersistenceStore, ExpertInstanceState } from './persistence/index.js';

/**
 * Expert instance implementation
 */
@injectable()
export class ExpertInstance implements IExpertInstance {
    /** Expert class ID */
    public expertId: string;
    /** Instance ID - unique runtime identifier */
    public instanceId: string;
    public status: ExpertStatus = 'idle';

    private agent: Agent;
    private config: ExpertConfig;
    private artifacts: ExpertArtifact[] = [];

    // Message-driven mode state
    private _isRunning = false;

    // Polling state
    private _lastUnreadCount = 0;
    private _lastCheckTimestamp = 0;
    private _consecutiveErrors = 0;
    private _maxConsecutiveErrors = 5;
    private _currentPollInterval: number;

    // Persistence
    private persistenceStore?: IExpertPersistenceStore;
    private _lastSaveTimestamp = 0;
    private readonly _saveThrottleMs = 5000; // Save at most every 5 seconds

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
        // Initialize poll interval from config, default to 30000ms (30 seconds)
        this._currentPollInterval = config.mailConfig?.pollInterval || 30000;
    }

    /**
     * Start Expert in message-driven mode
     * ExpertInstance manages Agent lifecycle - wakes Agent when new mail arrives
     */
    async start(): Promise<void> {
        if (this._isRunning) {
            this.logger.warn(`Expert ${this.expertId} is already running`);
            return;
        }

        // Check if mail-driven mode is enabled
        if (!this.config.mailConfig?.enabled) {
            this.logger.warn(`Expert ${this.expertId} mail-driven mode is not enabled`);
            return;
        }

        this._isRunning = true;
        this.status = 'running';
        this._consecutiveErrors = 0;
        this._lastUnreadCount = 0;
        await this.persistState();
        this.logger.info(
            `Expert ${this.expertId} started message-driven mode (pollInterval: ${this._currentPollInterval}ms)`,
        );

        try {
            while (this._isRunning) {
                // Check if Agent is idle/ready and there are pending tasks
                const agentStatus = this.agent.status;
                const isAgentIdle = agentStatus === 'idle' || agentStatus === 'completed';

                if (isAgentIdle && this._isRunning) {
                    // Check for new task emails
                    const hasNewTasks = await this.checkForNewTasks();

                    if (hasNewTasks) {
                        this.logger.info(`New task detected, waking up Agent`);
                        await this.wakeUpAgent();
                    }
                }

                // Wait before next check with exponential backoff on errors
                await this.sleep(this._currentPollInterval);
            }
        } catch (error) {
            this.logger.error(`Expert ${this.expertId} polling error: ${error}`);
        } finally {
            this._isRunning = false;
            this.status = 'ready';
            this.logger.info(`Expert ${this.expertId} stopped message-driven mode`);
        }
    }

    /**
     * Check for new tasks by querying the mail component
     * Returns true if there are new unread messages
     */
    private async checkForNewTasks(): Promise<boolean> {
        const mailComponent = this.getMailComponent();

        if (!mailComponent) {
            this.logger.debug(`Expert ${this.expertId}: No mail component found in workspace`);
            return false;
        }

        try {
            // Get unread count from mail component
            const result = await (mailComponent as any).handleToolCall('getUnreadCount', {});

            if (result?.error) {
                this._handlePollingError(new Error(result.error));
                return false;
            }

            const currentUnreadCount = result?.data?.count ?? 0;
            this._lastCheckTimestamp = Date.now();
            this._consecutiveErrors = 0; // Reset error count on success
            this._currentPollInterval = this.config.mailConfig?.pollInterval || 30000; // Reset interval

            // Throttled persist during polling
            await this.persistState();

            // Check if there are new unread messages
            if (currentUnreadCount > this._lastUnreadCount) {
                const newMessageCount = currentUnreadCount - this._lastUnreadCount;
                this.logger.info(
                    `Expert ${this.expertId}: Detected ${newMessageCount} new unread message(s) (total: ${currentUnreadCount})`,
                );
                this._lastUnreadCount = currentUnreadCount;
                return true;
            }

            // Update last count even if no new messages
            this._lastUnreadCount = currentUnreadCount;
            this.logger.debug(
                `Expert ${this.expertId}: No new messages (unread: ${currentUnreadCount})`,
            );

            return false;
        } catch (error) {
            this._handlePollingError(error as Error);
            return false;
        }
    }

    /**
     * Handle polling errors with exponential backoff
     */
    private _handlePollingError(error: Error): void {
        this._consecutiveErrors++;

        if (this._consecutiveErrors >= this._maxConsecutiveErrors) {
            // Apply exponential backoff: double the interval up to 5 minutes max
            const maxInterval = 300000; // 5 minutes
            const newInterval = Math.min(
                this._currentPollInterval * 2,
                maxInterval,
            );

            if (newInterval !== this._currentPollInterval) {
                this.logger.warn(
                    `Expert ${this.expertId}: Too many consecutive errors (${this._consecutiveErrors}), backing off to ${newInterval}ms`,
                );
                this._currentPollInterval = newInterval;
            }
        }

        this.logger.error(
            `Expert ${this.expertId}: Error checking for new tasks: ${error.message}`,
        );
    }

    /**
     * Check if running
     */
    isRunning(): boolean {
        return this._isRunning;
    }

    /**
     * Wake up Agent to process pending tasks
     */
    private async wakeUpAgent(): Promise<void> {
        await (this.agent as any).wakeUpForMailTask?.();
    }

    /**
     * Stop message-driven mode
     */
    async stop(): Promise<void> {
        if (!this._isRunning) {
            return;
        }

        const wasRunning = this.status === 'running';
        this._isRunning = false;
        this.status = 'ready';
        await this.persistState();
        this.logger.info(`Expert ${this.expertId} stopping message-driven mode`);

        // Abort any running agent task
        if (wasRunning) {
            this.agent.abort('Expert stopped by user', 'manual');
        }
    }

    /**
     * Get MailComponent from workspace
     */
    private getMailComponent(): ToolComponent | undefined {
        const workspace = this.agent.workspace;
        return workspace.getComponent('mail');
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Throttled persist state to persistence store
     * Saves at most once every _saveThrottleMs milliseconds
     */
    private async persistState(): Promise<void> {
        if (!this.persistenceStore) {
            return;
        }

        const now = Date.now();
        if (now - this._lastSaveTimestamp < this._saveThrottleMs) {
            return;
        }

        this._lastSaveTimestamp = now;
        const state: ExpertInstanceState = {
            expertClassId: this.expertId,
            instanceId: this.instanceId,
            status: this.status,
            lastUnreadCount: this._lastUnreadCount,
            lastCheckTimestamp: new Date(this._lastCheckTimestamp),
            pollInterval: this._currentPollInterval,
            consecutiveErrors: this._consecutiveErrors,
        };

        try {
            await this.persistenceStore.saveInstance(state);
        } catch (err) {
            this.logger.error(`Expert ${this.expertId}: Failed to persist state: ${err}`);
        }
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
        this.status = 'idle';
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

    private get logger(): ILogger {
        return (this.agent as any).logger || console;
    }
}
