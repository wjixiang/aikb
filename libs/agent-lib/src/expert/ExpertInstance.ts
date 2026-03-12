/**
 * Expert Implementation - 独立的专家Agent
 *
 * 每个 Expert 拥有：
 * - 独立的 VirtualWorkspace（管理 Components）
 * - 独立的 MemoryModule（管理对话历史）
 * - 独立的执行循环
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
 * Expert 实例实现
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
            // 构建 Expert 的任务提示
            const taskPrompt = this.buildTaskPrompt(task, context);

            // 执行任务
            await this.agent.start(taskPrompt);

            // 获取执行结果
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
        // 获取 workspace 中的组件状态摘要
        const workspace = this.agent.workspace;
        const stats = workspace.getStats();

        // 从组件中提取状态
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
     * 添加产物
     */
    addArtifact(artifact: ExpertArtifact): void {
        this.artifacts.push(artifact);
    }

    /**
     * 获取 Agent 实例（供 Controller 使用）
     */
    getAgent(): Agent {
        return this.agent;
    }

    private get logger(): ILogger {
        return (this.agent as any).logger || console;
    }

    private buildTaskPrompt(task: ExpertTask, context?: Record<string, any>): string {
        let prompt = `## 任务\n${task.description}\n`;

        // 添加上下文信息
        if (context && Object.keys(context).length > 0) {
            prompt += `\n## 上下文信息\n${JSON.stringify(context, null, 2)}\n`;
        }

        // 添加期望产物说明
        if (task.expectedOutputs && task.expectedOutputs.length > 0) {
            prompt += `\n## 期望产物\n${task.expectedOutputs.join(', ')}\n`;
        }

        // 添加 Expert 特定的系统提示
        if (this.config.systemPrompt) {
            prompt += `\n## 专业提示\n${this.config.systemPrompt}\n`;
        }

        return prompt;
    }

    private getOutput(): any {
        // 从 workspace 或 artifacts 中提取输出
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
