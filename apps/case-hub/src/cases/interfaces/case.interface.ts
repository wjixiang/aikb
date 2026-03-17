/**
 * 病历模块类型接口定义
 */

import { ClinicalCaseComplete } from "../../types/case.type.js";

/**
 * 病历状态
 */
export enum CaseStatus {
    DRAFT = "draft",
    ACTIVE = "active",
    ARCHIVED = "archived",
    DELETED = "deleted",
}

/**
 * 病例分型
 */
export enum CaseType {
    TYPE_A = "A型",
    TYPE_B = "B型",
    TYPE_C = "C型",
    TYPE_D = "D型",
}

/**
 * 病历基础接口
 */
export interface ICase {
    /** 病历唯一标识 */
    id: string;
    /** 病历编号 */
    caseNumber: string;
    /** 患者姓名 */
    patientName: string;
    /** 患者性别 */
    gender: "男" | "女" | "其他";
    /** 患者年龄 */
    age: number;
    /** 科室 */
    department: string;
    /** 疾病名称 */
    disease: string;
    /** 病历状态 */
    status: CaseStatus;
    /** 病例分型 */
    caseType: CaseType;
    /** 完整病历内容 */
    content: ClinicalCaseComplete;
    /** 创建时间 */
    createdAt: Date;
    /** 更新时间 */
    updatedAt: Date;
    /** 创建者ID */
    createdBy: string | undefined;
    /** 更新者ID */
    updatedBy: string | undefined;
    /** 标签 */
    tags: string[] | undefined;
    /** 备注 */
    remarks: string | undefined;
}

/**
 * 病历查询条件接口
 */
export interface ICaseQuery {
    /** 关键词搜索（姓名、病历号、疾病） */
    keyword: string | undefined;
    /** 科室筛选 */
    department: string | undefined;
    /** 疾病筛选 */
    disease: string | undefined;
    /** 性别筛选 */
    gender: "男" | "女" | "其他" | undefined;
    /** 年龄范围 - 最小 */
    minAge: number | undefined;
    /** 年龄范围 - 最大 */
    maxAge: number | undefined;
    /** 状态筛选 */
    status: CaseStatus | undefined;
    /** 病例分型筛选 */
    caseType: CaseType | undefined;
    /** 创建时间范围 - 开始 */
    createdFrom: Date | undefined;
    /** 创建时间范围 - 结束 */
    createdTo: Date | undefined;
    /** 页码 */
    page: number | undefined;
    /** 每页数量 */
    pageSize: number | undefined;
    /** 排序字段 */
    sortBy: string | undefined;
    /** 排序方向 */
    sortOrder: "asc" | "desc" | undefined;
}

/**
 * 分页结果接口
 */
export interface IPaginatedResult<T> {
    /** 数据列表 */
    items: T[];
    /** 总数量 */
    total: number;
    /** 当前页码 */
    page: number;
    /** 每页数量 */
    pageSize: number;
    /** 总页数 */
    totalPages: number;
}

/**
 * 科室信息接口
 */
export interface IDepartment {
    /** 科室代码 */
    code: string;
    /** 科室名称 */
    name: string;
    /** 科室描述 */
    description: string | undefined;
    /** 病例数量 */
    caseCount: number | undefined;
}

/**
 * 疾病信息接口
 */
export interface IDisease {
    /** 疾病代码 */
    code: string;
    /** 疾病名称 */
    name: string;
    /** 所属科室 */
    department: string | undefined;
    /** 疾病描述 */
    description: string | undefined;
    /** 病例数量 */
    caseCount: number | undefined;
}

/**
 * 病历统计信息接口
 */
export interface ICaseStatistics {
    /** 总病例数 */
    totalCases: number;
    /** 本月新增 */
    newCasesThisMonth: number;
    /** 各科室分布 */
    departmentDistribution: Record<string, number>;
    /** 各疾病分布 */
    diseaseDistribution: Record<string, number>;
}
