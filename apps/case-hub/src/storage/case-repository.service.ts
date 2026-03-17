/**
 * 病历数据仓库服务
 * 负责病历数据的持久化操作
 */
import { Injectable, Logger } from "@nestjs/common";
import type {
    ICase,
    CreateCaseParams,
    UpdateCaseParams,
    QueryCaseParams,
    PaginatedResult,
    CaseStatistics,
} from "./interfaces/case.interface.js";
import { CaseEntity } from "./entities/case.entity.js";

/**
 * 病历数据仓库服务
 * 提供病历的 CRUD 和数据查询操作
 */
@Injectable()
export class CaseRepositoryService {
    private readonly logger = new Logger(CaseRepositoryService.name);

    // 内存存储 (实际项目中应使用数据库)
    private cases: Map<string, CaseEntity> = new Map();

    constructor() {
        this.logger.log("CaseRepositoryService initialized");
    }

    /**
     * 创建病历
     * @param params 创建参数
     * @param id 病历 ID
     * @returns 创建的病历
     */
    async create(params: CreateCaseParams, id: string): Promise<ICase> {
        const entity = CaseEntity.fromCreateParams(params, id);
        this.cases.set(id, entity);
        this.logger.debug(`Case created: ${id}`);
        return entity.toJSON();
    }

    /**
     * 根据 ID 查找病历
     * @param id 病历 ID
     * @param includeDeleted 是否包含已删除的病历
     * @returns 病历或 null
     */
    async findById(
        id: string,
        includeDeleted = false
    ): Promise<ICase | null> {
        const entity = this.cases.get(id);
        if (!entity) {
            return null;
        }
        if (entity.isDeleted && !includeDeleted) {
            return null;
        }
        return entity.toJSON();
    }

    /**
     * 更新病历
     * @param id 病历 ID
     * @param params 更新参数
     * @returns 更新后的病历或 null
     */
    async update(id: string, params: UpdateCaseParams): Promise<ICase | null> {
        const entity = this.cases.get(id);
        if (!entity || entity.isDeleted) {
            return null;
        }
        entity.applyUpdate(params);
        this.logger.debug(`Case updated: ${id}`);
        return entity.toJSON();
    }

    /**
     * 软删除病历
     * @param id 病历 ID
     * @returns 是否删除成功
     */
    async softDelete(id: string): Promise<boolean> {
        const entity = this.cases.get(id);
        if (!entity || entity.isDeleted) {
            return false;
        }
        entity.markAsDeleted();
        this.logger.debug(`Case soft deleted: ${id}`);
        return true;
    }

    /**
     * 硬删除病历
     * @param id 病历 ID
     * @returns 是否删除成功
     */
    async hardDelete(id: string): Promise<boolean> {
        const existed = this.cases.has(id);
        if (!existed) {
            return false;
        }
        this.cases.delete(id);
        this.logger.debug(`Case hard deleted: ${id}`);
        return true;
    }

    /**
     * 恢复已删除的病历
     * @param id 病历 ID
     * @returns 恢复后的病历或 null
     */
    async restore(id: string): Promise<ICase | null> {
        const entity = this.cases.get(id);
        if (!entity || !entity.isDeleted) {
            return null;
        }
        entity.isDeleted = false;
        entity.updatedAt = new Date();
        this.logger.debug(`Case restored: ${id}`);
        return entity.toJSON();
    }

    /**
     * 查询病历列表
     * @param params 查询参数
     * @returns 分页结果
     */
    async findMany(
        params: QueryCaseParams = {}
    ): Promise<PaginatedResult<ICase>> {
        const {
            page = 1,
            limit = 20,
            keyword,
            department,
            diseaseType,
            caseType,
            tags,
            startDate,
            endDate,
            createdBy,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = params;

        // 过滤数据
        let filtered = Array.from(this.cases.values()).filter(
            (entity) => !entity.isDeleted
        );

        // 关键词搜索
        if (keyword) {
            const lowerKeyword = keyword.toLowerCase();
            filtered = filtered.filter(
                (entity) =>
                    entity.title.toLowerCase().includes(lowerKeyword) ||
                    entity.content.toLowerCase().includes(lowerKeyword)
            );
        }

        // 科室筛选
        if (department) {
            filtered = filtered.filter(
                (entity) => entity.department === department
            );
        }

        // 疾病类型筛选
        if (diseaseType) {
            filtered = filtered.filter(
                (entity) => entity.diseaseType === diseaseType
            );
        }

        // 病历类型筛选
        if (caseType) {
            filtered = filtered.filter(
                (entity) => entity.caseType === caseType
            );
        }

        // 标签筛选
        if (tags && tags.length > 0) {
            filtered = filtered.filter((entity) =>
                tags.some((tag) => entity.tags?.includes(tag))
            );
        }

        // 时间范围筛选
        if (startDate) {
            filtered = filtered.filter(
                (entity) => entity.createdAt >= startDate
            );
        }
        if (endDate) {
            filtered = filtered.filter(
                (entity) => entity.createdAt <= endDate
            );
        }

        // 创建者筛选
        if (createdBy) {
            filtered = filtered.filter(
                (entity) => entity.createdBy === createdBy
            );
        }

        // 排序
        filtered.sort((a, b) => {
            const aValue = a[sortBy];
            const bValue = b[sortBy];
            const multiplier = sortOrder === "asc" ? 1 : -1;

            if (aValue instanceof Date && bValue instanceof Date) {
                return (aValue.getTime() - bValue.getTime()) * multiplier;
            }
            if (typeof aValue === "string" && typeof bValue === "string") {
                return aValue.localeCompare(bValue) * multiplier;
            }
            return 0;
        });

        // 分页
        const total = filtered.length;
        const totalPages = Math.ceil(total / limit);
        const start = (page - 1) * limit;
        const end = start + limit;
        const data = filtered.slice(start, end).map((entity) => entity.toJSON());

        return {
            data,
            total,
            page,
            limit,
            totalPages,
        };
    }

    /**
     * 获取所有病历 (不分页)
     * @param includeDeleted 是否包含已删除的病历
     * @returns 病历列表
     */
    async findAll(includeDeleted = false): Promise<ICase[]> {
        return Array.from(this.cases.values())
            .filter((entity) => includeDeleted || !entity.isDeleted)
            .map((entity) => entity.toJSON());
    }

    /**
     * 获取病历统计信息
     * @returns 统计结果
     */
    async getStatistics(): Promise<CaseStatistics> {
        const allCases = Array.from(this.cases.values()).filter(
            (entity) => !entity.isDeleted
        );

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(
            today.getFullYear(),
            today.getMonth() - 1,
            today.getDate()
        );

        // 按科室统计
        const byDepartment: Record<string, number> = {};
        // 按疾病类型统计
        const byDiseaseType: Record<string, number> = {};
        // 按病历类型统计
        const byCaseType: Record<string, number> = {};

        let todayCases = 0;
        let weekCases = 0;
        let monthCases = 0;

        for (const entity of allCases) {
            // 科室统计
            if (entity.department) {
                byDepartment[entity.department] =
                    (byDepartment[entity.department] || 0) + 1;
            }

            // 疾病类型统计
            if (entity.diseaseType) {
                byDiseaseType[entity.diseaseType] =
                    (byDiseaseType[entity.diseaseType] || 0) + 1;
            }

            // 病历类型统计
            if (entity.caseType) {
                byCaseType[entity.caseType] =
                    (byCaseType[entity.caseType] || 0) + 1;
            }

            // 时间统计
            if (entity.createdAt >= today) {
                todayCases++;
            }
            if (entity.createdAt >= weekAgo) {
                weekCases++;
            }
            if (entity.createdAt >= monthAgo) {
                monthCases++;
            }
        }

        return {
            totalCases: allCases.length,
            todayCases,
            weekCases,
            monthCases,
            byDepartment,
            byDiseaseType,
            byCaseType,
        };
    }

    /**
     * 检查病历是否存在
     * @param id 病历 ID
     * @returns 是否存在
     */
    async exists(id: string): Promise<boolean> {
        const entity = this.cases.get(id);
        return !!entity && !entity.isDeleted;
    }

    /**
     * 获取所有科室列表
     * @returns 科室列表
     */
    async getDepartments(): Promise<string[]> {
        const departments = new Set<string>();
        for (const entity of this.cases.values()) {
            if (!entity.isDeleted && entity.department) {
                departments.add(entity.department);
            }
        }
        return Array.from(departments).sort();
    }

    /**
     * 获取所有疾病类型列表
     * @returns 疾病类型列表
     */
    async getDiseaseTypes(): Promise<string[]> {
        const types = new Set<string>();
        for (const entity of this.cases.values()) {
            if (!entity.isDeleted && entity.diseaseType) {
                types.add(entity.diseaseType);
            }
        }
        return Array.from(types).sort();
    }

    /**
     * 获取所有标签列表
     * @returns 标签列表
     */
    async getAllTags(): Promise<string[]> {
        const tags = new Set<string>();
        for (const entity of this.cases.values()) {
            if (!entity.isDeleted && entity.tags) {
                for (const tag of entity.tags) {
                    tags.add(tag);
                }
            }
        }
        return Array.from(tags).sort();
    }
}

export default CaseRepositoryService;
