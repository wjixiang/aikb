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
import type { Container } from 'inversify';
import type { ToolComponent } from '../../components/index.js';
import type { MailMessage } from '../../multi-agent/types.js';

/**
 * Expert instance implementation
 */
@injectable()
export class ExpertInstance implements IExpertInstance {
    public expertId: string;
    public status: ExpertStatus = 'idle';

    private agent: Agent;
    private config: ExpertConfig;
    private artifacts: ExpertArtifact[] = [];
    private stateSummary = '';
    private container?: Container;

    // Message-driven mode state
    private _isRunning = false;
    private _runLoopPromise?: Promise<void>;

    constructor(
        config: ExpertConfig,
        agent: Agent,
        container?: Container, // Optional container (can be passed or undefined)
    ) {
        this.expertId = config.expertId;
        this.config = config;
        this.agent = agent;
        this.container = container;
    }

    async activate(): Promise<void> {
        this.status = 'ready';
        this.logger.info(`Expert ${this.expertId} activated`);
    }

    async suspend(): Promise<void> {
        if (this.status === 'running') {
            this.agent.abort('Expert suspended by controller', 'system');
            this.status = 'suspended';
            this.logger.info(`Expert ${this.expertId} suspended`);
        }
    }

    async resume(): Promise<void> {
        this.status = 'ready';
        this.logger.info(`Expert ${this.expertId} resumed`);
    }

    /**
     * Check if running in message-driven mode
     */
    isRunning(): boolean {
        return this._isRunning;
    }

    /**
     * Start message-driven mode
     * Expert will poll its inbox for tasks instead of receiving explicit task data
     */
    async run(): Promise<void> {
        if (this._isRunning) {
            this.logger.warn(`Expert ${this.expertId} is already running`);
            return;
        }

        this._isRunning = true;
        this.status = 'running';
        this.logger.info(`Expert ${this.expertId} started message-driven mode`);

        const pollInterval = this.config.mailConfig?.pollInterval || 5000;

        try {
            while (this._isRunning) {
                try {
                    // 1. Get pending task emails
                    const pendingTasks = await this.fetchPendingTasks();

                    if (pendingTasks.length === 0) {
                        // No tasks, wait for next poll
                        await this.sleep(pollInterval);
                        continue;
                    }

                    // 2. Process each task
                    for (const taskMail of pendingTasks) {
                        if (!this._isRunning) break;

                        try {
                            await this.processTaskMail(taskMail);
                        } catch (error) {
                            this.logger.error(error instanceof Error ? error : String(error));
                            await this.sendErrorReply(taskMail, error);
                        }
                    }
                } catch (error) {
                    this.logger.error(error instanceof Error ? error : String(error));
                    // Wait before retrying to avoid busy loop
                    await this.sleep(pollInterval);
                }
            }
        } finally {
            this._isRunning = false;
            this.status = 'ready';
            this.logger.info(`Expert ${this.expertId} stopped message-driven mode`);
        }
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
     * Fetch pending task emails from inbox
     */
    private async fetchPendingTasks(): Promise<MailMessage[]> {
        const mailComponent = this.getMailComponent();
        if (!mailComponent) {
            this.logger.warn(`Expert ${this.expertId}: MailComponent not available`);
            return [];
        }

        try {
            const result = await mailComponent.handleToolCall('getInbox', {
                unreadOnly: true,
                limit: 10,
            });

            // Filter messages addressed to this expert
            const myAddress = `${this.expertId}@expert`;
            const messages = (result as any)?.messages || [];

            return messages.filter((msg: MailMessage) => {
                const to = Array.isArray(msg.to) ? msg.to : [msg.to];
                return to.includes(myAddress);
            });
        } catch (error) {
            this.logger.error(error instanceof Error ? error : String(error));
            return [];
        }
    }

    /**
     * Process a single task mail
     */
    private async processTaskMail(mail: MailMessage): Promise<void> {
        this.status = 'running';
        const startTime = Date.now();

        try {
            // 1. Parse task from mail
            const task = this.parseTaskMail(mail);

            // 2. Mark as read to prevent duplicate processing
            await this.markAsRead(mail.messageId);

            // 3. Execute task (internal method)
            const result = await this.executeInternal(task);

            // 4. Send result reply
            await this.sendResultReply(mail, result);

            this.logger.info(`Task completed in ${Date.now() - startTime}ms`);
        } finally {
            this.status = 'ready';
        }
    }

    /**
     * Parse task mail to ExpertTask
     */
    private parseTaskMail(mail: MailMessage): ExpertTask {
        const payload = mail.payload || {};

        return {
            taskId: (payload['taskId'] as string) || mail.messageId,
            description: mail.subject.replace(/^\[TASK\]\s*/, ''),
            input: payload['input'] as Record<string, any> || {},
            expectedOutputs: payload['expectedOutputs'] as string[],
        };
    }

    /**
     * Execute task internally (used by both execute() and run())
     */
    private async executeInternal(task: ExpertTask): Promise<ExpertResult> {
        const startTime = Date.now();

        try {
            const taskPrompt = this.buildTaskPrompt(task);
            await this.agent.start(taskPrompt);

            const summary = await this.getStateSummary();
            const output = this.getOutput();

            // Auto-export if configured
            if (this.config.exportConfig?.autoExport) {
                await this.performAutoExport(task, output);
            }

            return {
                expertId: this.expertId,
                success: true,
                output: output,
                summary: summary,
                artifacts: this.artifacts,
                duration: Date.now() - startTime,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                expertId: this.expertId,
                success: false,
                output: null,
                summary: `Expert failed: ${errorMessage}`,
                artifacts: this.artifacts,
                errors: [errorMessage],
                duration: Date.now() - startTime,
            };
        }
    }

    /**
     * Send result reply to the sender
     */
    private async sendResultReply(originalMail: MailMessage, result: ExpertResult): Promise<void> {
        const mailComponent = this.getMailComponent();
        if (!mailComponent) {
            this.logger.warn(`Cannot send reply: MailComponent not available`);
            return;
        }

        try {
            await mailComponent.handleToolCall('sendMail', {
                to: originalMail.from,
                subject: `[RESULT] ${originalMail.subject} - ${result.success ? '完成' : '失败'}`,
                body: this.formatResultBody(result),
                payload: {
                    taskId: originalMail.taskId,
                    status: result.success ? 'success' : 'failed',
                    output: result.output,
                    duration: result.duration,
                },
                inReplyTo: originalMail.messageId,
            });
        } catch (error) {
            this.logger.error(error instanceof Error ? error : String(error));
        }
    }

    /**
     * Send error reply to the sender
     */
    private async sendErrorReply(mail: MailMessage, error: unknown): Promise<void> {
        const mailComponent = this.getMailComponent();
        if (!mailComponent) {
            return;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);

        try {
            await mailComponent.handleToolCall('sendMail', {
                to: mail.from,
                subject: `[ERROR] ${mail.subject}`,
                body: `任务执行失败: ${errorMessage}`,
                payload: {
                    taskId: mail.taskId,
                    status: 'error',
                    error: errorMessage,
                },
                inReplyTo: mail.messageId,
            });
        } catch (e) {
            this.logger.error(e instanceof Error ? e : String(e));
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
     * Mark message as read
     */
    private async markAsRead(messageId: string): Promise<void> {
        const mailComponent = this.getMailComponent();
        if (!mailComponent) return;

        try {
            await mailComponent.handleToolCall('markAsRead', { messageId });
        } catch (error) {
            this.logger.error(error instanceof Error ? error : String(error));
        }
    }

    /**
     * Format result body for reply email
     */
    private formatResultBody(result: ExpertResult): string {
        let body = result.summary || '';

        if (result.success && result.output) {
            body += '\n\n---\n输出:\n';
            body += JSON.stringify(result.output, null, 2);
        }

        if (result.errors && result.errors.length > 0) {
            body += '\n\n---\n错误:\n';
            body += result.errors.join('\n');
        }

        body += `\n\n---\n耗时: ${result.duration}ms`;

        return body;
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async execute(task: ExpertTask, context?: Record<string, any>): Promise<ExpertResult> {
        const startTime = Date.now();
        this.status = 'running';
        let exportResult: ExportResult | undefined;

        try {
            // Build Expert's task prompt
            const taskPrompt = this.buildTaskPrompt(task, context);

            // Execute task
            await this.agent.start(taskPrompt);

            // Get execution result
            const summary = await this.getStateSummary();
            const output = this.getOutput();

            // Auto-export if configured
            if (this.config.exportConfig?.autoExport) {
                exportResult = await this.performAutoExport(task, output);
                if (exportResult.success) {
                    this.logger.info(`Expert ${this.expertId} auto-exported to ${exportResult.filePath}`);
                } else {
                    this.logger.warn(`Expert ${this.expertId} auto-export failed: ${exportResult.error}`);
                }
            }

            this.status = 'completed';

            return {
                expertId: this.expertId,
                success: true,
                output: output,
                summary: summary,
                artifacts: this.artifacts,
                duration: Date.now() - startTime
            };
        } catch (error) {
            this.status = 'failed';
            const errorMessage = error instanceof Error ? error.message : String(error);

            return {
                expertId: this.expertId,
                success: false,
                output: null,
                summary: `Expert failed: ${errorMessage}`,
                artifacts: this.artifacts,
                errors: [errorMessage],
                duration: Date.now() - startTime
            };
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
