/**
 * 存储服务
 * 提供病历 CRUD、文件存储和查询统计功能
 */
import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs/promises";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import type {
    ICase,
    CreateCaseParams,
    UpdateCaseParams,
    QueryCaseParams,
    PaginatedResult,
    CaseStatistics,
    FileStorageInfo,
    StorageConfig,
} from "./interfaces/case.interface.js";
import { CaseRepositoryService } from "./case-repository.service.js";
import { FileStorageEntity } from "./entities/case.entity.js";

@Injectable()
export class StorageService {
    private readonly logger = new Logger(StorageService.name);
    private readonly storageConfig: StorageConfig;
    private readonly fileStoragePath: string;
    private fileStorage: Map<string, FileStorageEntity> = new Map();

    constructor(
        private readonly caseRepository: CaseRepositoryService,
        private readonly configService: ConfigService
    ) {
        // 读取存储配置
        const storageType =
            (this.configService.get<string>("STORAGE_TYPE") as
                | "local"
                | "s3"
                | "garage") || "local";
        const maxSize = parseInt(
            this.configService.get<string>("STORAGE_MAX_SIZE") || "10485760",
            10
        );
        this.storageConfig = {
            type: storageType,
            maxSize,
            allowedMimeTypes: [
                "text/markdown",
                "text/plain",
                "application/json",
                "application/pdf",
                "image/jpeg",
                "image/png",
            ],
        };

        // 设置文件存储路径
        this.fileStoragePath =
            this.configService.get<string>("STORAGE_PATH") ||
            "./storage/cases";

        this.ensureStorageDirectory();
        this.logger.log(
            `StorageService initialized with type: ${storageType}`
        );
    }

    // ==================== 病历 CRUD ====================

    /**
     * 创建病历
     * @param params 创建参数
     * @returns 创建的病历
     */
    async createCase(params: CreateCaseParams): Promise<ICase> {
        const id = uuidv4();
        this.logger.log(`Creating case with id: ${id}`);
        return this.caseRepository.create(params, id);
    }

    /**
     * 根据 ID 获取病历
     * @param id 病历 ID
     * @returns 病历
     * @throws NotFoundException 当病历不存在时
     */
    async getCaseById(id: string): Promise<ICase> {
        const caseData = await this.caseRepository.findById(id);
        if (!caseData) {
            throw new NotFoundException(`Case not found: ${id}`);
        }
        return caseData;
    }

    /**
     * 更新病历
     * @param id 病历 ID
     * @param params 更新参数
     * @returns 更新后的病历
     * @throws NotFoundException 当病历不存在时
     */
    async updateCase(id: string, params: UpdateCaseParams): Promise<ICase> {
        const updated = await this.caseRepository.update(id, params);
        if (!updated) {
            throw new NotFoundException(`Case not found: ${id}`);
        }
        this.logger.log(`Case updated: ${id}`);
        return updated;
    }

    /**
     * 删除病历 (软删除)
     * @param id 病历 ID
     * @throws NotFoundException 当病历不存在时
     */
    async deleteCase(id: string): Promise<void> {
        const deleted = await this.caseRepository.softDelete(id);
        if (!deleted) {
            throw new NotFoundException(`Case not found: ${id}`);
        }
        this.logger.log(`Case deleted (soft): ${id}`);
    }

    /**
     * 永久删除病历
     * @param id 病历 ID
     * @throws NotFoundException 当病历不存在时
     */
    async hardDeleteCase(id: string): Promise<void> {
        const deleted = await this.caseRepository.hardDelete(id);
        if (!deleted) {
            throw new NotFoundException(`Case not found: ${id}`);
        }
        this.logger.log(`Case deleted (hard): ${id}`);
    }

    /**
     * 恢复已删除的病历
     * @param id 病历 ID
     * @returns 恢复后的病历
     * @throws NotFoundException 当病历不存在时
     */
    async restoreCase(id: string): Promise<ICase> {
        const restored = await this.caseRepository.restore(id);
        if (!restored) {
            throw new NotFoundException(`Case not found or not deleted: ${id}`);
        }
        this.logger.log(`Case restored: ${id}`);
        return restored;
    }

    /**
     * 查询病历列表
     * @param params 查询参数
     * @returns 分页结果
     */
    async queryCases(
        params: QueryCaseParams = {}
    ): Promise<PaginatedResult<ICase>> {
        return this.caseRepository.findMany(params);
    }

    /**
     * 获取所有病历
     * @returns 病历列表
     */
    async getAllCases(): Promise<ICase[]> {
        return this.caseRepository.findAll();
    }

    // ==================== 文件存储 ====================

    /**
     * 保存病历为文件
     * @param caseId 病历 ID
     * @param format 文件格式 (md, json, txt)
     * @returns 文件存储信息
     */
    async saveCaseToFile(
        caseId: string,
        format: "md" | "json" | "txt" = "md"
    ): Promise<FileStorageInfo> {
        const caseData = await this.getCaseById(caseId);

        // 生成文件名
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const sanitizedTitle = caseData.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_");
        const filename = `${sanitizedTitle}_${timestamp}.${format}`;
        const filePath = path.join(this.fileStoragePath, filename);

        // 根据格式生成内容
        let content: string;
        let mimeType: string;

        switch (format) {
            case "json":
                content = JSON.stringify(caseData, null, 2);
                mimeType = "application/json";
                break;
            case "txt":
                content = this.formatCaseAsText(caseData);
                mimeType = "text/plain";
                break;
            case "md":
            default:
                content = this.formatCaseAsMarkdown(caseData);
                mimeType = "text/markdown";
                break;
        }

        // 写入文件
        await fs.writeFile(filePath, content, "utf-8");

        // 获取文件信息
        const stats = await fs.stat(filePath);

        // 创建文件记录
        const fileInfo = new FileStorageEntity({
            id: uuidv4(),
            filename,
            originalName: `${caseData.title}.${format}`,
            path: filePath,
            size: stats.size,
            mimeType,
            caseId,
            createdAt: undefined,
        });

        this.fileStorage.set(fileInfo.id, fileInfo);
        this.logger.log(`Case saved to file: ${filePath}`);

        return fileInfo.toJSON();
    }

    /**
     * 批量保存病历为文件
     * @param caseIds 病历 ID 列表
     * @param format 文件格式
     * @returns 文件存储信息列表
     */
    async batchSaveCasesToFile(
        caseIds: string[],
        format: "md" | "json" | "txt" = "md"
    ): Promise<FileStorageInfo[]> {
        const results: FileStorageInfo[] = [];
        for (const caseId of caseIds) {
            try {
                const fileInfo = await this.saveCaseToFile(caseId, format);
                results.push(fileInfo);
            } catch (error) {
                this.logger.error(
                    `Failed to save case ${caseId} to file:`,
                    error
                );
            }
        }
        return results;
    }

    /**
     * 从文件加载病历
     * @param fileId 文件 ID
     * @returns 文件内容
     */
    async loadCaseFromFile(fileId: string): Promise<{
        content: string;
        info: FileStorageInfo;
    }> {
        const fileInfo = this.fileStorage.get(fileId);
        if (!fileInfo) {
            throw new NotFoundException(`File not found: ${fileId}`);
        }

        const content = await fs.readFile(fileInfo.path, "utf-8");
        return {
            content,
            info: fileInfo.toJSON(),
        };
    }

    /**
     * 删除文件
     * @param fileId 文件 ID
     */
    async deleteFile(fileId: string): Promise<void> {
        const fileInfo = this.fileStorage.get(fileId);
        if (!fileInfo) {
            throw new NotFoundException(`File not found: ${fileId}`);
        }

        try {
            await fs.unlink(fileInfo.path);
        } catch (error) {
            this.logger.warn(`Failed to delete file ${fileInfo.path}:`, error);
        }

        this.fileStorage.delete(fileId);
        this.logger.log(`File deleted: ${fileId}`);
    }

    /**
     * 获取病历关联的文件列表
     * @param caseId 病历 ID
     * @returns 文件存储信息列表
     */
    async getCaseFiles(caseId: string): Promise<FileStorageInfo[]> {
        return Array.from(this.fileStorage.values())
            .filter((file) => file.caseId === caseId)
            .map((file) => file.toJSON());
    }

    // ==================== 查询和统计 ====================

    /**
     * 获取病历统计信息
     * @returns 统计结果
     */
    async getStatistics(): Promise<CaseStatistics> {
        return this.caseRepository.getStatistics();
    }

    /**
     * 搜索病历
     * @param keyword 搜索关键词
     * @param page 页码
     * @param limit 每页数量
     * @returns 分页结果
     */
    async searchCases(
        keyword: string,
        page = 1,
        limit = 20
    ): Promise<PaginatedResult<ICase>> {
        return this.caseRepository.findMany({
            keyword,
            page,
            limit,
        });
    }

    /**
     * 按科室筛选病历
     * @param department 科室名称
     * @param page 页码
     * @param limit 每页数量
     * @returns 分页结果
     */
    async getCasesByDepartment(
        department: string,
        page = 1,
        limit = 20
    ): Promise<PaginatedResult<ICase>> {
        return this.caseRepository.findMany({
            department,
            page,
            limit,
        });
    }

    /**
     * 按疾病类型筛选病历
     * @param diseaseType 疾病类型
     * @param page 页码
     * @param limit 每页数量
     * @returns 分页结果
     */
    async getCasesByDiseaseType(
        diseaseType: string,
        page = 1,
        limit = 20
    ): Promise<PaginatedResult<ICase>> {
        return this.caseRepository.findMany({
            diseaseType,
            page,
            limit,
        });
    }

    /**
     * 按标签筛选病历
     * @param tags 标签列表
     * @param page 页码
     * @param limit 每页数量
     * @returns 分页结果
     */
    async getCasesByTags(
        tags: string[],
        page = 1,
        limit = 20
    ): Promise<PaginatedResult<ICase>> {
        return this.caseRepository.findMany({
            tags,
            page,
            limit,
        });
    }

    /**
     * 获取所有科室列表
     * @returns 科室列表
     */
    async getDepartments(): Promise<string[]> {
        return this.caseRepository.getDepartments();
    }

    /**
     * 获取所有疾病类型列表
     * @returns 疾病类型列表
     */
    async getDiseaseTypes(): Promise<string[]> {
        return this.caseRepository.getDiseaseTypes();
    }

    /**
     * 获取所有标签列表
     * @returns 标签列表
     */
    async getAllTags(): Promise<string[]> {
        return this.caseRepository.getAllTags();
    }

    // ==================== 私有方法 ====================

    /**
     * 确保存储目录存在
     */
    private async ensureStorageDirectory(): Promise<void> {
        try {
            await fs.access(this.fileStoragePath);
        } catch {
            await fs.mkdir(this.fileStoragePath, { recursive: true });
            this.logger.log(`Created storage directory: ${this.fileStoragePath}`);
        }
    }

    /**
     * 格式化病历为 Markdown
     */
    private formatCaseAsMarkdown(caseData: ICase): string {
        const lines: string[] = [];

        // 元数据头部
        lines.push("---");
        lines.push(`title: ${caseData.title}`);
        lines.push(`id: ${caseData.id}`);
        if (caseData.department) {
            lines.push(`department: ${caseData.department}`);
        }
        if (caseData.diseaseType) {
            lines.push(`diseaseType: ${caseData.diseaseType}`);
        }
        if (caseData.caseType) {
            lines.push(`caseType: ${caseData.caseType}`);
        }
        if (caseData.tags && caseData.tags.length > 0) {
            lines.push(`tags: [${caseData.tags.join(", ")}]`);
        }
        lines.push(`createdAt: ${caseData.createdAt.toISOString()}`);
        lines.push(`updatedAt: ${caseData.updatedAt.toISOString()}`);
        lines.push("---");
        lines.push("");

        // 内容
        lines.push(caseData.content);

        return lines.join("\n");
    }

    /**
     * 格式化病历为纯文本
     */
    private formatCaseAsText(caseData: ICase): string {
        const lines: string[] = [];

        lines.push(`标题: ${caseData.title}`);
        lines.push(`ID: ${caseData.id}`);
        if (caseData.department) {
            lines.push(`科室: ${caseData.department}`);
        }
        if (caseData.diseaseType) {
            lines.push(`疾病类型: ${caseData.diseaseType}`);
        }
        lines.push(`创建时间: ${caseData.createdAt.toISOString()}`);
        lines.push("");
        lines.push("=".repeat(50));
        lines.push("");
        lines.push(caseData.content);

        return lines.join("\n");
    }
}

export default StorageService;
