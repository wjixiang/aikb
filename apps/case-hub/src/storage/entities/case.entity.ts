/**
 * 病历实体类
 * 用于数据库映射和数据验证
 */
import type {
    ICase,
    CreateCaseParams,
    UpdateCaseParams,
} from "../interfaces/case.interface.js";
import type { ClinicalCaseComplete } from "../../types/case.type.js";

/**
 * 病历实体类
 */
export class CaseEntity implements ICase {
    id: string;
    title: string;
    content: string;
    structuredData: ClinicalCaseComplete | undefined;
    department: string | undefined;
    diseaseType: string | undefined;
    caseType: string | undefined;
    tags: string[] | undefined;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | undefined;
    isDeleted: boolean;

    constructor(data: Partial<ICase>) {
        this.id = data.id || "";
        this.title = data.title || "";
        this.content = data.content || "";
        this.structuredData = data.structuredData;
        this.department = data.department;
        this.diseaseType = data.diseaseType;
        this.caseType = data.caseType;
        this.tags = data.tags || [];
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
        this.createdBy = data.createdBy;
        this.isDeleted = data.isDeleted || false;
    }

    /**
     * 从创建参数创建实体
     */
    static fromCreateParams(params: CreateCaseParams, id: string): CaseEntity {
        const now = new Date();
        return new CaseEntity({
            id,
            title: params.title,
            content: params.content,
            structuredData: params.structuredData,
            department: params.department,
            diseaseType: params.diseaseType,
            caseType: params.caseType,
            tags: params.tags || [],
            createdBy: params.createdBy,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
        });
    }

    /**
     * 应用更新参数
     */
    applyUpdate(params: UpdateCaseParams): void {
        if (params.title !== undefined) {
            this.title = params.title;
        }
        if (params.content !== undefined) {
            this.content = params.content;
        }
        if (params.structuredData !== undefined) {
            this.structuredData = params.structuredData;
        }
        if (params.department !== undefined) {
            this.department = params.department;
        }
        if (params.diseaseType !== undefined) {
            this.diseaseType = params.diseaseType;
        }
        if (params.caseType !== undefined) {
            this.caseType = params.caseType;
        }
        if (params.tags !== undefined) {
            this.tags = params.tags;
        }
        this.updatedAt = new Date();
    }

    /**
     * 标记为删除
     */
    markAsDeleted(): void {
        this.isDeleted = true;
        this.updatedAt = new Date();
    }

    /**
     * 转换为 JSON 对象
     */
    toJSON(): ICase {
        return {
            id: this.id,
            title: this.title,
            content: this.content,
            structuredData: this.structuredData,
            department: this.department,
            diseaseType: this.diseaseType,
            caseType: this.caseType,
            tags: this.tags,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            createdBy: this.createdBy,
            isDeleted: this.isDeleted,
        };
    }
}

/**
 * 文件存储实体类
 */
export class FileStorageEntity {
    id: string;
    filename: string;
    originalName: string;
    path: string;
    size: number;
    mimeType: string;
    caseId: string | undefined;
    createdAt: Date;

    constructor(data: {
        id: string;
        filename: string;
        originalName: string;
        path: string;
        size: number;
        mimeType: string;
        caseId: string | undefined;
        createdAt: Date | undefined;
    }) {
        this.id = data.id;
        this.filename = data.filename;
        this.originalName = data.originalName;
        this.path = data.path;
        this.size = data.size;
        this.mimeType = data.mimeType;
        this.caseId = data.caseId;
        this.createdAt = data.createdAt ?? new Date();
    }

    /**
     * 转换为 JSON 对象
     */
    toJSON() {
        return {
            id: this.id,
            filename: this.filename,
            originalName: this.originalName,
            path: this.path,
            size: this.size,
            mimeType: this.mimeType,
            caseId: this.caseId,
            createdAt: this.createdAt,
        };
    }
}

export default CaseEntity;
