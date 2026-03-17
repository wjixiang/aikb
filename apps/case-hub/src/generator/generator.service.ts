/**
 * Generator Service - 病历生成服务
 * 整合 case-generator 和 long-case-generator 的功能
 */

import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v4 as uuidv4 } from "uuid";
import { ApiClientFactory } from "agent-lib";
import type { ApiClient } from "agent-lib";
import type { CaseGeneratorOptions, GeneratedCase } from "../types/generator.type.js";
import {
    CaseGenerator,
    createCaseGenerator
} from "../lib/case-generator.js";
import {
    LongCaseGenerator,
    createLongCaseGenerator
} from "../lib/long-case-generator.js";
import {
    departmentTemplates,
    getRandomTemplate
} from "../lib/case-templates.js";
import type {
    GenerationJob,
    GenerationJobStatus,
    IGeneratorService,
    TemplatesResponse,
    TemplateInfo
} from "./interfaces/generator.interface.js";

/**
 * 生成任务实现
 */
class GenerationJobImpl implements GenerationJob {
    id: string;
    type: "single" | "batch" | "long";
    status: GenerationJobStatus;
    total: number;
    completed: number;
    failed: number;
    results: GeneratedCase[];
    errors: string[];
    createdAt: Date;
    completedAt?: Date | undefined;

    constructor(type: "single" | "batch" | "long", total: number) {
        this.id = uuidv4();
        this.type = type;
        this.status = "pending";
        this.total = total;
        this.completed = 0;
        this.failed = 0;
        this.results = [];
        this.errors = [];
        this.createdAt = new Date();
    }

    markRunning(): void {
        this.status = "running";
    }

    markCompleted(): void {
        this.status = "completed";
        this.completedAt = new Date();
    }

    markFailed(): void {
        this.status = "failed";
        this.completedAt = new Date();
    }

    markCancelled(): void {
        this.status = "cancelled";
        this.completedAt = new Date();
    }

    addResult(result: GeneratedCase): void {
        this.results.push(result);
        this.completed++;
    }

    addError(error: string): void {
        this.errors.push(error);
        this.failed++;
    }
}

@Injectable()
export class GeneratorService implements OnModuleInit, IGeneratorService {
    private readonly logger = new Logger(GeneratorService.name);
    private caseGenerator: CaseGenerator | null = null;
    private longCaseGenerator: LongCaseGenerator | null = null;
    private jobs: Map<string, GenerationJobImpl> = new Map();

    constructor(private readonly configService: ConfigService) {}

    /**
     * 模块初始化时创建生成器实例
     */
    onModuleInit(): void {
        const apiKey = this.configService.get<string>("MINIMAX_API_KEY") || "";
        const apiModelId = this.configService.get<string>("MINIMAX_MODEL_ID") || "MiniMax-M2.5";

        if (!apiKey) {
            this.logger.warn("MINIMAX_API_KEY not configured, generator will not work properly");
        }

        const apiClient: ApiClient = ApiClientFactory.create({
            apiProvider: "minimax",
            apiModelId,
            apiKey
        });

        this.caseGenerator = createCaseGenerator(apiClient);
        this.longCaseGenerator = createLongCaseGenerator(apiClient);

        this.logger.log("GeneratorService initialized");
    }

    /**
     * 生成单个病历
     */
    async generateCase(options: CaseGeneratorOptions = {}): Promise<GeneratedCase> {
        if (!this.caseGenerator) {
            throw new Error("Case generator not initialized");
        }

        const job = new GenerationJobImpl("single", 1);
        this.jobs.set(job.id, job);

        try {
            job.markRunning();
            const result = await this.caseGenerator.generate(options);
            job.addResult(result);
            job.markCompleted();
            this.logger.log(`Generated case: ${result.metadata.department} - ${result.metadata.disease}`);
            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            job.addError(errorMessage);
            job.markFailed();
            this.logger.error(`Failed to generate case: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * 批量生成病历
     */
    async batchGenerate(
        count: number,
        options: CaseGeneratorOptions = {}
    ): Promise<GenerationJob> {
        if (!this.caseGenerator) {
            throw new Error("Case generator not initialized");
        }

        if (count < 1 || count > 100) {
            throw new Error("Count must be between 1 and 100");
        }

        const job = new GenerationJobImpl("batch", count);
        this.jobs.set(job.id, job);

        // 异步执行批量生成
        this.executeBatchJob(job, count, options).catch((error) => {
            this.logger.error(`Batch job ${job.id} failed:`, error);
        });

        return job;
    }

    /**
     * 执行批量生成任务
     */
    private async executeBatchJob(
        job: GenerationJobImpl,
        count: number,
        options: CaseGeneratorOptions
    ): Promise<void> {
        job.markRunning();

        try {
            for (let i = 0; i < count; i++) {
                if (job.status === "cancelled") {
                    this.logger.log(`Batch job ${job.id} was cancelled`);
                    return;
                }

                try {
                    const result = await this.caseGenerator!.generate(options);
                    job.addResult(result);
                    this.logger.log(`Batch ${job.id}: Generated ${i + 1}/${count}`);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    job.addError(`Case ${i + 1}: ${errorMessage}`);
                    this.logger.error(`Batch ${job.id}: Failed to generate case ${i + 1}:`, error);
                }
            }

            if (job.status !== "cancelled") {
                job.markCompleted();
                this.logger.log(`Batch job ${job.id} completed: ${job.completed} success, ${job.failed} failed`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            job.addError(`Batch execution failed: ${errorMessage}`);
            job.markFailed();
            this.logger.error(`Batch job ${job.id} failed:`, error);
        }
    }

    /**
     * 生成长病历
     */
    async generateLongCase(options: CaseGeneratorOptions = {}): Promise<GeneratedCase> {
        if (!this.longCaseGenerator) {
            throw new Error("Long case generator not initialized");
        }

        const job = new GenerationJobImpl("long", 1);
        this.jobs.set(job.id, job);

        try {
            job.markRunning();
            const result = await this.longCaseGenerator.generate(options);
            job.addResult(result);
            job.markCompleted();
            this.logger.log(`Generated long case: ${result.metadata.department} - ${result.metadata.disease}`);
            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            job.addError(errorMessage);
            job.markFailed();
            this.logger.error(`Failed to generate long case: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * 获取任务状态
     */
    getJobStatus(jobId: string): GenerationJob | undefined {
        return this.jobs.get(jobId);
    }

    /**
     * 获取所有任务
     */
    getAllJobs(): GenerationJob[] {
        return Array.from(this.jobs.values());
    }

    /**
     * 取消任务
     */
    cancelJob(jobId: string): boolean {
        const job = this.jobs.get(jobId);
        if (!job) {
            return false;
        }

        if (job.status === "pending" || job.status === "running") {
            job.markCancelled();
            this.logger.log(`Job ${jobId} was cancelled`);
            return true;
        }

        return false;
    }

    /**
     * 获取可用模板列表
     */
    getTemplates(): TemplatesResponse {
        const templates: TemplateInfo[] = departmentTemplates.map((dept) => ({
            department: dept.name,
            diseases: dept.diseases.map((d) => d.name)
        }));

        const totalDiseases = departmentTemplates.reduce(
            (sum, dept) => sum + dept.diseases.length,
            0
        );

        return {
            templates,
            totalDepartments: departmentTemplates.length,
            totalDiseases
        };
    }

    /**
     * 获取随机模板
     */
    getRandomTemplateInfo(department?: string, disease?: string): {
        department: string;
        disease: string;
    } {
        const template = getRandomTemplate(department, disease);
        return {
            department: template.department,
            disease: template.disease.name
        };
    }

    /**
     * 清理已完成的任务（可选的维护方法）
     */
    cleanupCompletedJobs(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
        const now = Date.now();
        let cleaned = 0;

        for (const [id, job] of this.jobs.entries()) {
            if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
                const jobAge = now - job.createdAt.getTime();
                if (jobAge > maxAgeMs) {
                    this.jobs.delete(id);
                    cleaned++;
                }
            }
        }

        this.logger.log(`Cleaned up ${cleaned} old jobs`);
        return cleaned;
    }
}
