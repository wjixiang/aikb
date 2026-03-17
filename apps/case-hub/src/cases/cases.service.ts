/**
 * 病历服务 - 业务逻辑层
 * 使用 Prisma 进行数据持久化
 */

import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../storage/prisma.service.js";
import type {
    ICase,
    ICaseQuery,
    IPaginatedResult,
    IDepartment,
    IDisease,
} from "./interfaces/case.interface.js";
import { CaseStatus, CaseType } from "./interfaces/case.interface.js";
import type { ClinicalCaseComplete } from "../types/case.type.js";
import type { CreateCaseDto } from "./dto/create-case.dto.js";
import type { UpdateCaseDto } from "./dto/update-case.dto.js";
import type { Case, Prisma } from "../generated/prisma/index.js";

/**
 * 病历服务
 */
@Injectable()
export class CasesService {
    // 预定义的科室列表
    private readonly departments: IDepartment[] = [
        { code: "internal-medicine", name: "内科", description: "内科疾病诊治", caseCount: undefined },
        { code: "general-surgery", name: "普外科", description: "普通外科，主要负责腹部外科手术", caseCount: undefined },
        { code: "orthopedics", name: "骨科", description: "骨骼肌肉系统疾病诊治", caseCount: undefined },
        { code: "urology", name: "泌尿外科", description: "泌尿系统疾病诊治", caseCount: undefined },
        { code: "cardiology", name: "心内科", description: "心血管系统疾病诊治", caseCount: undefined },
        { code: "respiratory", name: "呼吸内科", description: "呼吸系统疾病诊治", caseCount: undefined },
        { code: "gastroenterology", name: "消化内科", description: "消化系统疾病诊治", caseCount: undefined },
        { code: "neurology", name: "神经内科", description: "神经系统疾病诊治", caseCount: undefined },
        { code: "obstetrics-gynecology", name: "妇产科", description: "妇产科疾病诊治", caseCount: undefined },
        { code: "pediatrics", name: "儿科", description: "儿童疾病诊治", caseCount: undefined },
        { code: "dermatology", name: "皮肤科", description: "皮肤疾病诊治", caseCount: undefined },
        { code: "emergency", name: "急诊科", description: "急诊急救", caseCount: undefined },
    ];

    // 预定义的疾病列表
    private readonly diseases: IDisease[] = [
        { code: "hypertension", name: "高血压", department: "心内科", description: "血压持续升高", caseCount: undefined },
        { code: "diabetes", name: "糖尿病", department: "内分泌科", description: "血糖代谢异常", caseCount: undefined },
        { code: "appendicitis", name: "急性阑尾炎", department: "普外科", description: "阑尾的急性炎症", caseCount: undefined },
        { code: "cholecystitis", name: "急性胆囊炎", department: "普外科", description: "胆囊的急性炎症", caseCount: undefined },
        { code: "fracture", name: "骨折", department: "骨科", description: "骨骼断裂", caseCount: undefined },
        { code: "kidney-stone", name: "肾结石", department: "泌尿外科", description: "肾脏结石", caseCount: undefined },
        { code: "pneumonia", name: "肺炎", department: "呼吸内科", description: "肺部感染", caseCount: undefined },
        { code: "gastritis", name: "胃炎", department: "消化内科", description: "胃黏膜炎症", caseCount: undefined },
        { code: "stroke", name: "脑卒中", department: "神经内科", description: "脑血管疾病", caseCount: undefined },
        { code: "pregnancy", name: "正常妊娠", department: "妇产科", description: "正常孕期检查", caseCount: undefined },
        { code: "eczema", name: "湿疹", department: "皮肤科", description: "皮肤炎症性疾病", caseCount: undefined },
        { code: "acute-abdomen", name: "急性腹痛", department: "急诊科", description: "急性腹部疼痛", caseCount: undefined },
    ];

    constructor(private readonly prisma: PrismaService) {}

    /**
     * 生成病历编号
     */
    private generateCaseNumber(): string {
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
        return `CASE${dateStr}${random}`;
    }

    /**
     * 将 Prisma Case 转换为 ICase
     */
    private toICase(caseData: Case): ICase {
        return {
            id: caseData.id,
            caseNumber: caseData.caseNumber,
            patientName: caseData.patientName ?? "",
            gender: (caseData.gender as "男" | "女" | "其他") ?? "男",
            age: caseData.age ?? 0,
            department: caseData.department,
            disease: caseData.disease,
            content: caseData.content as unknown as ClinicalCaseComplete ?? {} as ClinicalCaseComplete,
            caseType: (caseData.caseType as CaseType) ?? CaseType.TYPE_A,
            status: (caseData.status as CaseStatus) ?? CaseStatus.ACTIVE,
            createdAt: caseData.createdAt,
            updatedAt: caseData.updatedAt,
            createdBy: caseData.createdBy ?? undefined,
            updatedBy: caseData.updatedBy ?? undefined,
            tags: caseData.metadata ? (caseData.metadata as Record<string, unknown>).tags as string[] : undefined,
            remarks: caseData.metadata ? (caseData.metadata as Record<string, unknown>).remarks as string : undefined,
        };
    }

    /**
     * 创建病历
     */
    async create(createCaseDto: CreateCaseDto): Promise<ICase> {
        // 检查病历编号是否已存在
        if (createCaseDto.caseNumber) {
            const existingCase = await this.prisma.case.findUnique({
                where: { caseNumber: createCaseDto.caseNumber },
            });
            if (existingCase) {
                throw new ConflictException(`病历编号 ${createCaseDto.caseNumber} 已存在`);
            }
        }

        const caseNumber = createCaseDto.caseNumber || this.generateCaseNumber();
        const now = new Date();

        const caseData = await this.prisma.case.create({
            data: {
                caseNumber,
                patientName: createCaseDto.patientName ?? "匿名患者",
                gender: createCaseDto.gender ?? "男",
                age: createCaseDto.age ?? 30,
                department: createCaseDto.department,
                disease: createCaseDto.disease,
                content: JSON.stringify(createCaseDto.content) ?? "",
                caseType: createCaseDto.caseType ?? CaseType.TYPE_A,
                status: createCaseDto.status ?? CaseStatus.ACTIVE,
                metadata: {
                    tags: createCaseDto.tags,
                    remarks: createCaseDto.remarks,
                } as Prisma.InputJsonValue,
                createdAt: now,
                updatedAt: now,
                createdBy: createCaseDto.createdBy ?? null,
                updatedBy: null,
            },
        });

        return this.toICase(caseData);
    }

    /**
     * 查询病历列表（支持分页和筛选）
     */
    async findAll(query: ICaseQuery): Promise<IPaginatedResult<ICase>> {
        const where: Prisma.CaseWhereInput = {};

        // 关键词搜索
        if (query.keyword) {
            where.OR = [
                { patientName: { contains: query.keyword, mode: "insensitive" } },
                { caseNumber: { contains: query.keyword, mode: "insensitive" } },
                { disease: { contains: query.keyword, mode: "insensitive" } },
            ];
        }

        // 科室筛选
        if (query.department) {
            where.department = query.department;
        }

        // 疾病筛选
        if (query.disease) {
            where.disease = query.disease;
        }

        // 性别筛选
        if (query.gender) {
            where.gender = query.gender;
        }

        // 状态筛选
        if (query.status) {
            where.status = query.status;
        }

        // 病例分型筛选
        if (query.caseType) {
            where.caseType = query.caseType;
        }

        // 创建时间范围筛选
        if (query.createdFrom || query.createdTo) {
            where.createdAt = {};
            if (query.createdFrom) {
                where.createdAt.gte = query.createdFrom;
            }
            if (query.createdTo) {
                where.createdAt.lte = query.createdTo;
            }
        }

        // 年龄范围筛选
        if (query.minAge !== undefined || query.maxAge !== undefined) {
            where.age = {};
            if (query.minAge !== undefined) {
                where.age.gte = query.minAge;
            }
            if (query.maxAge !== undefined) {
                where.age.lte = query.maxAge;
            }
        }

        // 分页
        const page = query.page || 1;
        const pageSize = query.pageSize || 10;

        // 排序
        const orderBy: Prisma.CaseOrderByWithRelationInput = {};
        const sortBy = query.sortBy || "createdAt";
        const sortOrder = query.sortOrder || "desc";
        orderBy[sortBy as keyof Prisma.CaseOrderByWithRelationInput] = sortOrder;

        const [cases, total] = await Promise.all([
            this.prisma.case.findMany({
                where,
                orderBy,
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.case.count({ where }),
        ]);

        const totalPages = Math.ceil(total / pageSize);

        return {
            items: cases.map(c => this.toICase(c)),
            total,
            page,
            pageSize,
            totalPages,
        };
    }

    /**
     * 根据ID获取单个病历
     */
    async findOne(id: string): Promise<ICase> {
        const caseData = await this.prisma.case.findUnique({
            where: { id },
        });

        if (!caseData) {
            throw new NotFoundException(`病历 ID ${id} 不存在`);
        }

        return this.toICase(caseData);
    }

    /**
     * 根据病历编号获取病历
     */
    async findByCaseNumber(caseNumber: string): Promise<ICase | null> {
        const caseData = await this.prisma.case.findUnique({
            where: { caseNumber },
        });

        return caseData ? this.toICase(caseData) : null;
    }

    /**
     * 更新病历
     */
    async update(id: string, updateCaseDto: UpdateCaseDto): Promise<ICase> {
        const existingCase = await this.prisma.case.findUnique({
            where: { id },
        });

        if (!existingCase) {
            throw new NotFoundException(`病历 ID ${id} 不存在`);
        }

        // 如果更新病历编号，检查是否与其他病历冲突
        if (updateCaseDto.caseNumber && updateCaseDto.caseNumber !== existingCase.caseNumber) {
            const conflictCase = await this.prisma.case.findUnique({
                where: { caseNumber: updateCaseDto.caseNumber },
            });
            if (conflictCase && conflictCase.id !== id) {
                throw new ConflictException(`病历编号 ${updateCaseDto.caseNumber} 已存在`);
            }
        }

        // 构建更新数据
        const updateData: Prisma.CaseUpdateInput = {
            updatedAt: new Date(),
        };

        if (updateCaseDto.caseNumber !== undefined) updateData.caseNumber = updateCaseDto.caseNumber;
        if (updateCaseDto.patientName !== undefined) updateData.patientName = updateCaseDto.patientName;
        if (updateCaseDto.gender !== undefined) updateData.gender = updateCaseDto.gender;
        if (updateCaseDto.age !== undefined) updateData.age = updateCaseDto.age;
        if (updateCaseDto.department !== undefined) updateData.department = updateCaseDto.department;
        if (updateCaseDto.disease !== undefined) updateData.disease = updateCaseDto.disease;
        if (updateCaseDto.content !== undefined) updateData.content = JSON.stringify(updateCaseDto.content);
        if (updateCaseDto.status !== undefined) updateData.status = updateCaseDto.status;
        if (updateCaseDto.caseType !== undefined) updateData.caseType = updateCaseDto.caseType;
        if (updateCaseDto.updatedBy !== undefined) updateData.updatedBy = updateCaseDto.updatedBy;

        // 处理 metadata 中的 tags 和 remarks
        const existingMetadata = (existingCase.metadata as Record<string, unknown>) || {};
        const newMetadata: Record<string, unknown> = { ...existingMetadata };
        if (updateCaseDto.tags !== undefined) newMetadata.tags = updateCaseDto.tags;
        if (updateCaseDto.remarks !== undefined) newMetadata.remarks = updateCaseDto.remarks;
        if (Object.keys(newMetadata).length > 0) {
            updateData.metadata = newMetadata as Prisma.InputJsonValue;
        }

        const caseData = await this.prisma.case.update({
            where: { id },
            data: updateData,
        });

        return this.toICase(caseData);
    }

    /**
     * 删除病历（软删除）
     */
    async remove(id: string): Promise<void> {
        const existingCase = await this.prisma.case.findUnique({
            where: { id },
        });

        if (!existingCase) {
            throw new NotFoundException(`病历 ID ${id} 不存在`);
        }

        await this.prisma.case.update({
            where: { id },
            data: {
                status: "DELETED",
                updatedAt: new Date(),
            },
        });
    }

    /**
     * 硬删除病历
     */
    async hardRemove(id: string): Promise<void> {
        const existingCase = await this.prisma.case.findUnique({
            where: { id },
        });

        if (!existingCase) {
            throw new NotFoundException(`病历 ID ${id} 不存在`);
        }

        await this.prisma.case.delete({
            where: { id },
        });
    }

    /**
     * 获取所有科室列表
     */
    async getDepartments(): Promise<IDepartment[]> {
        // 计算每个科室的病例数量
        const caseCounts = await this.prisma.case.groupBy({
            by: ["department"],
            _count: { id: true },
            where: { status: { not: "DELETED" } },
        });

        const countMap = new Map(caseCounts.map(c => [c.department, c._count.id]));

        return this.departments.map((dept) => ({
            ...dept,
            caseCount: countMap.get(dept.name) ?? 0,
        }));
    }

    /**
     * 获取所有疾病列表
     */
    async getDiseases(department?: string): Promise<IDisease[]> {
        let diseases = this.diseases;

        // 如果指定了科室，筛选该科室的疾病
        if (department) {
            const deptInfo = this.departments.find((d) => d.code === department || d.name === department);
            if (deptInfo) {
                diseases = diseases.filter((d) => d.department === deptInfo.name);
            }
        }

        // 计算每个疾病的病例数量
        const caseCounts = await this.prisma.case.groupBy({
            by: ["disease"],
            _count: { id: true },
            where: { status: { not: "DELETED" } },
        });

        const countMap = new Map(caseCounts.map(c => [c.disease, c._count.id]));

        return diseases.map((disease) => ({
            ...disease,
            caseCount: countMap.get(disease.name) ?? 0,
        }));
    }

    /**
     * 根据科室代码获取科室信息
     */
    async getDepartmentByCode(code: string): Promise<IDepartment | undefined> {
        return this.departments.find((d) => d.code === code);
    }

    /**
     * 根据疾病代码获取疾病信息
     */
    async getDiseaseByCode(code: string): Promise<IDisease | undefined> {
        return this.diseases.find((d) => d.code === code);
    }

    /**
     * 批量创建病历
     */
    async batchCreate(createCaseDtos: CreateCaseDto[]): Promise<ICase[]> {
        const results: ICase[] = [];
        for (const dto of createCaseDtos) {
            try {
                const newCase = await this.create(dto);
                results.push(newCase);
            } catch (error) {
                // 记录错误但继续处理其他病历
                console.error(`创建病历失败: ${dto.caseNumber}`, error);
            }
        }
        return results;
    }

    /**
     * 获取病历统计信息
     */
    async getStatistics(): Promise<{
        totalCases: number;
        newCasesThisMonth: number;
        departmentDistribution: Record<string, number>;
        diseaseDistribution: Record<string, number>;
    }> {
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [totalCases, newCasesThisMonth, deptCounts, diseaseCounts] = await Promise.all([
            this.prisma.case.count({ where: { status: { not: "DELETED" } } }),
            this.prisma.case.count({
                where: {
                    createdAt: { gte: thisMonthStart },
                    status: { not: "DELETED" },
                },
            }),
            this.prisma.case.groupBy({
                by: ["department"],
                _count: { id: true },
                where: { status: { not: "DELETED" } },
            }),
            this.prisma.case.groupBy({
                by: ["disease"],
                _count: { id: true },
                where: { status: { not: "DELETED" } },
            }),
        ]);

        const departmentDistribution: Record<string, number> = {};
        deptCounts.forEach((c) => {
            departmentDistribution[c.department] = c._count.id;
        });

        const diseaseDistribution: Record<string, number> = {};
        diseaseCounts.forEach((c) => {
            diseaseDistribution[c.disease] = c._count.id;
        });

        return {
            totalCases,
            newCasesThisMonth,
            departmentDistribution,
            diseaseDistribution,
        };
    }
}
