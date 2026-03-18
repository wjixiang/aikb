/**
 * Expert Orchestrator - Expert Orchestrator (Core of Controller Agent)
 *
 * Responsible for:
 * - Task decomposition
 * - Expert scheduling
 * - Result aggregation
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
     * Execute orchestration
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
     * List all available Experts
     */
    listExperts() {
        return this.registry.listExperts();
    }

    /**
     * Sequential execution
     */
    private async executeSequential(request: ExpertOrchestrationRequest): Promise<ExpertOrchestrationResult> {
        const startTime = Date.now();
        const expertResults = new Map<string, ExpertResult>();
        const allArtifacts: ExpertArtifact[] = [];
        const errors: string[] = [];

        // Global context
        let context = { ...request.globalContext };

        for (const expertTask of request.expertTasks) {
            this.logger.info(`[Orchestrator] Executing expert: ${expertTask.expertId}`);

            const result = await this.executor.executeTask(
                expertTask.expertId,
                expertTask.task,
                context
            );

            expertResults.set(expertTask.expertId, result);
            if (result.artifacts) {
                allArtifacts.push(...result.artifacts);
            }

            if (!result.success) {
                errors.push(`Expert ${expertTask.expertId} failed: ${result.summary}`);
                // Decide whether to continue based on error handling strategy
                // Here we choose to continue execution
            }

            // Add result to context for next Expert to use
            context = {
                ...context,
                [`${expertTask.expertId}_result`]: result.output,
                [`${expertTask.expertId}_summary`]: result.summary,
                // Pass shareable artifacts
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
     * Parallel execution
     */
    private async executeParallel(request: ExpertOrchestrationRequest): Promise<ExpertOrchestrationResult> {
        const startTime = Date.now();
        const expertResults = new Map<string, ExpertResult>();
        const allArtifacts: ExpertArtifact[] = [];
        const errors: string[] = [];

        // Execute all Experts in parallel
        const promises = request.expertTasks.map(async (expertTask) => {
            this.logger.info(`[Orchestrator] Starting parallel expert: ${expertTask.expertId}`);

            const result = await this.executor.executeTask(
                expertTask.expertId,
                expertTask.task,
                request.globalContext
            );

            return { expertId: expertTask.expertId, result };
        });

        const results = await Promise.all(promises);

        for (const { expertId, result } of results) {
            expertResults.set(expertId, result);
            if (result.artifacts) {
                allArtifacts.push(...result.artifacts);
            }

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
     * Dependency-ordered execution
     */
    private async executeDependencyOrdered(request: ExpertOrchestrationRequest): Promise<ExpertOrchestrationResult> {
        // Build dependency graph and perform topological sort
        const startTime = Date.now();
        const expertResults = new Map<string, ExpertResult>();
        const allArtifacts: ExpertArtifact[] = [];
        const errors: string[] = [];

        // TODO: Implement dependency-ordered execution
        // 1. Build dependency graph
        // 2. Perform topological sort
        // 3. Execute in order

        return this.executeSequential(request);
    }

    /**
     * Conditional execution
     */
    private async executeConditional(request: ExpertOrchestrationRequest): Promise<ExpertOrchestrationResult> {
        const startTime = Date.now();
        const expertResults = new Map<string, ExpertResult>();
        const allArtifacts: ExpertArtifact[] = [];
        const errors: string[] = [];

        let context = { ...request.globalContext };

        for (const expertTask of request.expertTasks) {
            // Check condition
            if (expertTask.conditional) {
                const shouldExecute = this.evaluateCondition(expertTask.task, context);
                if (!shouldExecute) {
                    this.logger.info(`[Orchestrator] Skipping expert ${expertTask.expertId} due to condition`);
                    continue;
                }
            }

            const result = await this.executor.executeTask(
                expertTask.expertId,
                expertTask.task,
                context
            );

            expertResults.set(expertTask.expertId, result);
            if (result.artifacts) {
                allArtifacts.push(...result.artifacts);
            }

            // Update context
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
     * Evaluate condition
     */
    private evaluateCondition(task: ExpertTask, context: Record<string, any>): boolean {
        // Simplified condition evaluation
        // Can dynamically determine based on task description and context
        return true;
    }

    /**
     * Generate summary
     */
    private generateSummary(results: Map<string, ExpertResult>): string {
        const entries = Array.from(results.entries());
        const summaries = entries.map(([expertId, result]) =>
            `- ${expertId}: ${result.success ? '✓' : '✗'} ${result.summary}`
        );

        return `Expert Execution Summary:\n${summaries.join('\n')}`;
    }

    /**
     * Aggregate outputs
     */
    private aggregateOutputs(results: Map<string, ExpertResult>): any {
        const outputs: Record<string, any> = {};

        for (const [expertId, result] of results.entries()) {
            outputs[expertId] = result.output;
        }

        return outputs;
    }
}
