/**
 * Expert Implementation - Independent Expert Agent
 *
 * Each Expert has:
 * - Independent VirtualWorkspace (manages Components)
 * - Independent MemoryModule (manages conversation history)
 * - Independent execution loop
 */

import { injectable, inject, optional } from 'inversify';
import type { AgentConfig, AgentPrompt } from '../agent/agent.js';
import { Agent } from '../agent/agent.js';
import type { IVirtualWorkspace } from '../statefulContext/types.js';
import type { IMemoryModule } from '../memory/types.js';
import type { ITaskModule } from '../task/types.js';
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
    IExpertInstance
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
        @inject(TYPES.Container) @optional() container?: Container,
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

        try {
            // Build Expert's task prompt
            const taskPrompt = this.buildTaskPrompt(task, context);

            // Execute task
            await this.agent.start(taskPrompt);

            // Get execution result
            const summary = await this.getStateSummary();

            this.status = 'completed';

            return {
                expertId: this.expertId,
                success: true,
                output: this.getOutput(),
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

        // Add Expert's capability (SOP Overview + Constraints)
        if (this.config.prompt?.capability) {
            prompt += `## Expert Capability\n${this.config.prompt.capability}\n\n`;
        }

        // Add Expert's direction (SOP Steps + Examples)
        if (this.config.prompt?.direction) {
            prompt += `## Expert Direction\n${this.config.prompt.direction}\n\n`;
        }

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

        // Add Expert-specific system prompt
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
}
