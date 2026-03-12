/**
 * Expert Executor - 专家执行器
 *
 * 负责创建、管理和执行 Expert 实例
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
     * 注册 Expert 配置
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

        // 创建 Agent 实例
        const agent = this.createAgent(config);

        // 创建 Expert 实例
        const expertInstance = new ExpertInstance(config, agent);

        // 激活 Expert
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

        // 如果 Expert 不存在，创建它
        if (!expert) {
            expert = await this.createExpert(request.expertId);
        }

        // 执行任务
        return await expert.execute(request.task, request.context);
    }

    /**
     * 收集所有 Expert 的产物
     */
    collectAllArtifacts(): ExpertArtifact[] {
        const allArtifacts: ExpertArtifact[] = [];
        for (const expert of this.expertInstances.values()) {
            allArtifacts.push(...expert.getArtifacts());
        }
        return allArtifacts;
    }

    /**
     * 创建 Agent 实例
     */
    private createAgent(config: ExpertConfig): Agent {
        // 这里需要根据 AgentContainer 的逻辑创建 Agent
        // 简化版本：返回一个新的 Agent 实例
        // 实际实现需要注入 Container 和其他依赖

        // TODO: 实现完整的 Agent 创建逻辑
        // 需要：
        // 1. 创建 VirtualWorkspace 并注册 config.components
        // 2. 创建 Agent 并注入 workspace
        // 3. 配置 Agent 的系统提示

        throw new Error('ExpertExecutor.createAgent() needs full implementation with DI container');
    }
}
