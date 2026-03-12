/**
 * Expert Orchestrator - 专家编排器（Controller Agent 核心）
 *
 * 负责：
 * - 任务分解
 * - Expert 调度
 * - 结果汇总
 */

import { injectable, inject } from 'inversify';
import type { ILogger } from '../utils/logging/types.js';
import type {
    ExpertOrchestrationRequest,
    ExpertOrchestrationResult,
    ExpertSchedulingStrategy,
    ExpertTask,
    ExpertResult,
    ExpertArtifact,
} from './types.js';
import { ExpertExecutor } from './ExpertExecutor.js';
import { ExpertRegistry } from './ExpertRegistry.js';
import { TYPES } from '../di/types.js';

@injectable()
export class ExpertOrchestrator {
    @inject(TYPES.Logger) private logger!: ILogger;

    constructor(
        private executor: ExpertExecutor,
        private registry: ExpertRegistry,
    ) {}

    /**
     * 执行编排
     */
    async orchestrate(request: ExpertOrchestrationRequest): Promise<ExpertOrchestrationResult> {
        const startTime = Date.now();
        const expertResults = new Map<string, ExpertResult>();
        const allArtifacts: ExpertArtifact[] = [];
        const errors: string[] = [];

        this.logger.info(`[Orchestrator] Starting orchestration: ${request.task}`);
        this.logger.info(`[Orchestrator] Strategy: ${request.strategy}`);

        try {
            switch (request.strategy) {
                case 'sequential':
                    return await this.executeSequential(request);
                case 'parallel':
                    return await this.executeParallel(request);
                case 'dependency-ordered':
                    return await this.executeDependencyOrdered(request);
                case 'conditional':
                    return await this.executeConditional(request);
                default:
                    throw new Error(`Unknown strategy: ${request.strategy}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            errors.push(errorMessage);
            this.logger.error(`[Orchestrator] Error: ${errorMessage}`);

            return {
                success: false,
                overallSummary: `Orchestration failed: ${errorMessage}`,
                expertResults,
                finalOutput: null,
                artifacts: allArtifacts,
                totalDuration: Date.now() - startTime,
                errors
            };
        }
    }

    /**
     * 列出所有可用 Expert
     */
    listExperts() {
        return this.registry.listExperts();
    }

    /**
     * 顺序执行
     */
    private async executeSequential(request: ExpertOrchestrationRequest): Promise<ExpertOrchestrationResult> {
        const startTime = Date.now();
        const expertResults = new Map<string, ExpertResult>();
        const allArtifacts: ExpertArtifact[] = [];
        const errors: string[] = [];

        // 全局上下文
        let context = { ...request.globalContext };

        for (const expertTask of request.expertTasks) {
            this.logger.info(`[Orchestrator] Executing expert: ${expertTask.expertId}`);

            const result = await this.executor.execute({
                expertId: expertTask.expertId,
                task: expertTask.task,
                context,
                timeout: request.timeout
            });

            expertResults.set(expertTask.expertId, result);
            allArtifacts.push(...result.artifacts);

            if (!result.success) {
                errors.push(`Expert ${expertTask.expertId} failed: ${result.summary}`);
                // 根据错误处理策略决定是否继续
                // 这里选择继续执行
            }

            // 将结果添加到上下文，供下一个 Expert 使用
            context = {
                ...context,
                [`${expertTask.expertId}_result`]: result.output,
                [`${expertTask.expertId}_summary`]: result.summary,
                // 传递可共享的产物
                shared_artifacts: allArtifacts.filter(a => a.shareable)
            };
        }

        return {
            success: errors.length === 0,
            overallSummary: this.generateSummary(expertResults),
            expertResults,
            finalOutput: this.aggregateOutputs(expertResults),
            artifacts: allArtifacts,
            totalDuration: Date.now() - startTime,
            errors: errors.length > 0 ? errors : undefined
        };
    }

    /**
     * 并行执行
     */
    private async executeParallel(request: ExpertOrchestrationRequest): Promise<ExpertOrchestrationResult> {
        const startTime = Date.now();
        const expertResults = new Map<string, ExpertResult>();
        const allArtifacts: ExpertArtifact[] = [];
        const errors: string[] = [];

        // 并行执行所有 Expert
        const promises = request.expertTasks.map(async (expertTask) => {
            this.logger.info(`[Orchestrator] Starting parallel expert: ${expertTask.expertId}`);

            const result = await this.executor.execute({
                expertId: expertTask.expertId,
                task: expertTask.task,
                context: request.globalContext,
                timeout: request.timeout
            });

            return { expertId: expertTask.expertId, result };
        });

        const results = await Promise.all(promises);

        for (const { expertId, result } of results) {
            expertResults.set(expertId, result);
            allArtifacts.push(...result.artifacts);

            if (!result.success) {
                errors.push(`Expert ${expertId} failed: ${result.summary}`);
            }
        }

        return {
            success: errors.length === 0,
            overallSummary: this.generateSummary(expertResults),
            expertResults,
            finalOutput: this.aggregateOutputs(expertResults),
            artifacts: allArtifacts,
            totalDuration: Date.now() - startTime,
            errors: errors.length > 0 ? errors : undefined
        };
    }

    /**
     * 依赖顺序执行
     */
    private async executeDependencyOrdered(request: ExpertOrchestrationRequest): Promise<ExpertOrchestrationResult> {
        // 构建依赖图并执行拓扑排序
        const startTime = Date.now();
        const expertResults = new Map<string, ExpertResult>();
        const allArtifacts: ExpertArtifact[] = [];
        const errors: string[] = [];

        // TODO: 实现依赖顺序执行
        // 1. 构建依赖图
        // 2. 执行拓扑排序
        // 3. 按顺序执行

        return this.executeSequential(request);
    }

    /**
     * 条件执行
     */
    private async executeConditional(request: ExpertOrchestrationRequest): Promise<ExpertOrchestrationResult> {
        const startTime = Date.now();
        const expertResults = new Map<string, ExpertResult>();
        const allArtifacts: ExpertArtifact[] = [];
        const errors: string[] = [];

        let context = { ...request.globalContext };

        for (const expertTask of request.expertTasks) {
            // 检查条件
            if (expertTask.conditional) {
                const shouldExecute = this.evaluateCondition(expertTask.task, context);
                if (!shouldExecute) {
                    this.logger.info(`[Orchestrator] Skipping expert ${expertTask.expertId} due to condition`);
                    continue;
                }
            }

            const result = await this.executor.execute({
                expertId: expertTask.expertId,
                task: expertTask.task,
                context,
                timeout: request.timeout
            });

            expertResults.set(expertTask.expertId, result);
            allArtifacts.push(...result.artifacts);

            // 更新上下文
            context = {
                ...context,
                [`${expertTask.expertId}_result`]: result.output
            };
        }

        return {
            success: errors.length === 0,
            overallSummary: this.generateSummary(expertResults),
            expertResults,
            finalOutput: this.aggregateOutputs(expertResults),
            artifacts: allArtifacts,
            totalDuration: Date.now() - startTime,
            errors: errors.length > 0 ? errors : undefined
        };
    }

    /**
     * 评估条件
     */
    private evaluateCondition(task: ExpertTask, context: Record<string, any>): boolean {
        // 简化的条件评估
        // 可以根据任务描述和上下文动态判断
        return true;
    }

    /**
     * 生成汇总摘要
     */
    private generateSummary(results: Map<string, ExpertResult>): string {
        const entries = Array.from(results.entries());
        const summaries = entries.map(([expertId, result]) =>
            `- ${expertId}: ${result.success ? '✓' : '✗'} ${result.summary}`
        );

        return `Expert Execution Summary:\n${summaries.join('\n')}`;
    }

    /**
     * 聚合输出
     */
    private aggregateOutputs(results: Map<string, ExpertResult>): any {
        const outputs: Record<string, any> = {};

        for (const [expertId, result] of results.entries()) {
            outputs[expertId] = result.output;
        }

        return outputs;
    }
}
