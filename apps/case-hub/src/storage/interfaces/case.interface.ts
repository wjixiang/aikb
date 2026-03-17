/**
 * 病历数据接口定义
 */
import type { ClinicalCaseComplete } from "../../types/case.type.js";

/**
 * 病历基础接口
 */
export interface ICase {
    /** 病历唯一 ID */
    id: string;
    /** 病历标题 */
    title: string;
    /** 病历内容 (Markdown 格式) */
    content: string;
    /** 结构化病历数据 */
    structuredData: ClinicalCaseComplete | undefined;
    /** 科室 */
    department: string | undefined;
    /** 疾病类型 */
    diseaseType: string | undefined;
    /** 病历类型 */
    caseType: string | undefined;
    /** 标签 */
    tags: string[] | undefined;
    /** 创建时间 */
    createdAt: Date;
    /** 更新时间 */
    updatedAt: Date;
    /** 创建者 ID */
    createdBy: string | undefined;
    /** 是否已删除 */
    isDeleted: boolean;
}

/**
 * 创建病历参数
 */
export interface CreateCaseParams {
    /** 病历标题 */
    title: string;
    /** 病历内容 */
    content: string;
    /** 结构化病历数据 */
    structuredData?: ClinicalCaseComplete;
    /** 科室 */
    department?: string;
    /** 疾病类型 */
    diseaseType?: string;
    /** 病历类型 */
    caseType?: string;
    /** 标签 */
    tags?: string[];
    /** 创建者 ID */
    createdBy?: string;
}

/**
 * 更新病历参数
 */
export interface UpdateCaseParams {
    /** 病历标题 */
    title?: string;
    /** 病历内容 */
    content?: string;
    /** 结构化病历数据 */
    structuredData?: ClinicalCaseComplete;
    /** 科室 */
    department?: string;
    /** 疾病类型 */
    diseaseType?: string;
    /** 病历类型 */
    caseType?: string;
    /** 标签 */
    tags?: string[];
}

/**
 * 病历查询参数
 */
export interface QueryCaseParams {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    limit?: number;
    /** 搜索关键词 */
    keyword?: string;
    /** 科室筛选 */
    department?: string;
    /** 疾病类型筛选 */
    diseaseType?: string;
    /** 病历类型筛选 */
    caseType?: string;
    /** 标签筛选 */
    tags?: string[];
    /** 开始时间 */
    startDate?: Date;
    /** 结束时间 */
    endDate?: Date;
    /** 创建者 ID */
    createdBy?: string;
    /** 排序字段 */
    sortBy?: "createdAt" | "updatedAt" | "title";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
}

/**
 * 分页结果
 */
export interface PaginatedResult<T> {
    /** 数据列表 */
    data: T[];
    /** 总数 */
    total: number;
    /** 页码 */
    page: number;
    /** 每页数量 */
    limit: number;
    /** 总页数 */
    totalPages: number;
}

/**
 * 病历统计结果
 */
export interface CaseStatistics {
    /** 总病历数 */
    totalCases: number;
    /** 今日新增 */
    todayCases: number;
    /** 本周新增 */
    weekCases: number;
    /** 本月新增 */
    monthCases: number;
    /** 按科室统计 */
    byDepartment: Record<string, number>;
    /** 按疾病类型统计 */
    byDiseaseType: Record<string, number>;
    /** 按病历类型统计 */
    byCaseType: Record<string, number>;
}

/**
 * 文件存储信息
 */
export interface FileStorageInfo {
    /** 文件 ID */
    id: string;
    /** 文件名 */
    filename: string;
    /** 原始文件名 */
    originalName: string;
    /** 文件路径 */
    path: string;
    /** 文件大小 (字节) */
    size: number;
    /** MIME 类型 */
    mimeType: string;
    /** 关联病历 ID */
    caseId: string | undefined;
    /** 创建时间 */
    createdAt: Date;
}

/**
 * 存储配置接口
 */
export interface StorageConfig {
    /** 存储类型 */
    type: "local" | "s3" | "minio";
    /** 本地存储路径 */
    localPath?: string;
    /** 最大文件大小 (字节) */
    maxSize: number;
    /** 允许的文件类型 */
    allowedMimeTypes?: string[];
}

export type { ClinicalCaseComplete };
