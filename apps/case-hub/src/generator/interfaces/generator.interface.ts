/**
 * Generator 模块接口定义
 */

import type { CaseGeneratorOptions, GeneratedCase } from "../../types/generator.type.js";

/**
 * 生成任务状态
 */
export type GenerationJobStatus =
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "cancelled";

/**
 * 生成任务
 */
export interface GenerationJob {
    /** 任务ID */
    id: string;
    /** 任务类型 */
    type: "single" | "batch" | "long";
    /** 任务状态 */
    status: GenerationJobStatus;
    /** 总数量 */
    total: number;
    /** 已完成数量 */
    completed: number;
    /** 失败数量 */
    failed: number;
    /** 生成的病历 */
    results: GeneratedCase[];
    /** 错误信息 */
    errors: string[];
    /** 创建时间 */
    createdAt: Date;
    /** 完成时间 */
    completedAt?: Date | undefined;
}

/**
 * 生成器服务接口
 */
export interface IGeneratorService {
    /**
     * 生成单个病历
     */
    generateCase(options: CaseGeneratorOptions): Promise<GeneratedCase>;

    /**
     * 批量生成病历
     */
    batchGenerate(count: number, options: CaseGeneratorOptions): Promise<GenerationJob>;

    /**
     * 生成长病历
     */
    generateLongCase(options: CaseGeneratorOptions): Promise<GeneratedCase>;

    /**
     * 获取任务状态
     */
    getJobStatus(jobId: string): GenerationJob | undefined;

    /**
     * 获取所有任务
     */
    getAllJobs(): GenerationJob[];

    /**
     * 取消任务
     */
    cancelJob(jobId: string): boolean;
}

/**
 * 模板信息
 */
export interface TemplateInfo {
    /** 科室名称 */
    department: string;
    /** 疾病列表 */
    diseases: string[];
}

/**
 * 可用模板列表响应
 */
export interface TemplatesResponse {
    /** 模板列表 */
    templates: TemplateInfo[];
    /** 总科室数 */
    totalDepartments: number;
    /** 总疾病数 */
    totalDiseases: number;
}
