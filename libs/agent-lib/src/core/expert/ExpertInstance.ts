/**
 * Expert Implementation - Independent Expert Agent
 *
 * Each Expert has:
 * - Independent VirtualWorkspace (manages Components)
 * - Independent MemoryModule (manages conversation history)
 * - Independent execution loop
 */

import { injectable } from 'inversify';
import type { AgentConfig, AgentPrompt } from '../agent/agent.js';
import { Agent } from '../agent/agent.js';
import type { IVirtualWorkspace } from '../statefulContext/index.js';
import type { IMemoryModule } from '../memory/types.js';
import type { IThinkingModule } from '../thinking/types.js';
import type { IActionModule } from '../action/types.js';
import type { ApiClient } from '../api-client/index.js';
import type { IToolManager } from '../tools/IToolManager.js';
import type { ILogger } from '../utils/logging/types.js';
import { TYPES } from '../di/types.js';
import type {
    ExpertConfig,
    ExpertStatus,
    ExpertResult,
    ExpertArtifact,
    ExpertTask,
    IExpertInstance,
    ExportConfig,
    ExportResult
} from './types.js';
import type { Container } from 'inversify';

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
    private stateSummary: string = '';
    private container?: Container;

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
