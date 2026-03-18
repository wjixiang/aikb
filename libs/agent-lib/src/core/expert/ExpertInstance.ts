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
    ExpertTask,
    IExpertInstance,
    ExportResult,
} from './types.js';
import type { ToolComponent } from '../../components/index.js';

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

    constructor(
        config: ExpertConfig,
        agent: Agent,
        instanceId: string,
    ) {
        this.expertId = config.expertId;
        this.instanceId = instanceId;
        this.config = config;
        this.agent = agent;
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

        this._isRunning = false;
        this.logger.info(`Expert ${this.expertId} stopping message-driven mode`);

        // Abort any running agent task
        if (this.status === 'running') {
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

    private buildTaskPrompt(task: ExpertTask, context?: Record<string, any>): string {
        let prompt = '';

        // NOTE: Expert's capability and direction are already set in agentPrompt (systemPrompt)
        // Only add task-specific information here

        // Add task description
        prompt += `## Task\n${task.description}\n`;

        // Add context information
        if (context && Object.keys(context).length > 0) {
            prompt += `\n## Context\n${JSON.stringify(context, null, 2)}\n`;
        }

        // Add expected outputs description
        if (task.expectedOutputs && task.expectedOutputs.length > 0) {
            prompt += `\n## Expected Outputs\n${task.expectedOutputs.join(', ')}\n`;
        }

        // Add Expert-specific system prompt (additional guidance)
        if (this.config.systemPrompt) {
            prompt += `\n## Additional Guidance\n${this.config.systemPrompt}\n`;
        }

        return prompt;
    }

    private getOutput(): any {
        // Extract output from workspace or artifacts
        const workspace = this.agent.workspace;
        const componentKeys = workspace.getComponentKeys();

        const outputs: Record<string, any> = {};
        for (const key of componentKeys) {
            const component = workspace.getComponent(key);
            if (component) {
                outputs[key] = component.getState();
            }
        }

        return outputs;
    }

    /**
     * Perform auto-export after task completion
     */
    private async performAutoExport(task: ExpertTask, output: any): Promise<ExportResult> {
        const exportConfig = this.config.exportConfig;
        if (!exportConfig) {
            return { success: false, error: 'No export config' };
        }

        // Get export parameters
        const bucket = exportConfig.bucket || process.env['FS_BUCKET'] || 'agentfs';

        // Generate path with placeholders (no format placeholder)
        let path = exportConfig.defaultPath || '{expertId}/{timestamp}.json';
        path = path
            .replace('{expertId}', this.expertId)
            .replace('{taskId}', task.taskId || 'unknown')
            .replace('{timestamp}', new Date().toISOString().replace(/[:.]/g, '-'));

        // Use custom handler or default JSON export
        if (exportConfig.exportHandler) {
            return exportConfig.exportHandler(this.agent.workspace, { bucket, path });
        }

        // Default: export all component states as JSON
        const content = JSON.stringify({
            expertId: this.expertId,
            taskId: task.taskId,
            taskDescription: task.description,
            output: output,
            artifacts: this.artifacts,
            timestamp: new Date().toISOString(),
        }, null, 2);

        // Get VirtualFileSystemComponent and export
        const vfsComponent = this.getVirtualFileSystemComponent();
        if (!vfsComponent) {
            return { success: false, error: 'VirtualFileSystemComponent not found' };
        }

        // Default to JSON content type
        const contentType = 'application/json';
        return vfsComponent.exportContent(bucket, path, content, contentType);
    }

    /**
     * Get VirtualFileSystemComponent from workspace
     */
    private getVirtualFileSystemComponent(): any {
        const workspace = this.agent.workspace;
        const componentKeys = workspace.getComponentKeys();

        for (const key of componentKeys) {
            const component = workspace.getComponent(key);
            // Check by component name or type
            if (component && (component.constructor.name === 'VirtualFileSystemComponent' ||
                key.includes('virtualFileSystem') || key === 'virtualFileSystem')) {
                return component;
            }
        }

        return null;
    }
}
