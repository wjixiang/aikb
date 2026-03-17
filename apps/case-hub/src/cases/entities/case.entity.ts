/**
 * 病历实体类
 */

import { ApiProperty } from "@nestjs/swagger";
import { ClinicalCaseComplete } from "../../types/case.type.js";
import { CaseStatus, CaseType, ICase } from "../interfaces/case.interface.js";

/**
 * 病历实体
 */
export class CaseEntity implements ICase {
    @ApiProperty({
        description: "病历唯一标识",
        example: "550e8400-e29b-41d4-a716-446655440000",
    })
    id: string;

    @ApiProperty({
        description: "病历编号",
        example: "CASE202403170001",
    })
    caseNumber: string;

    @ApiProperty({
        description: "患者姓名",
        example: "张三",
    })
    patientName: string;

    @ApiProperty({
        description: "患者性别",
        enum: ["男", "女", "其他"],
        example: "男",
    })
    gender: "男" | "女" | "其他";

    @ApiProperty({
        description: "患者年龄",
        example: 45,
    })
    age: number;

    @ApiProperty({
        description: "科室",
        example: "普外科",
    })
    department: string;

    @ApiProperty({
        description: "疾病名称",
        example: "急性阑尾炎",
    })
    disease: string;

    @ApiProperty({
        description: "病历状态",
        enum: CaseStatus,
        example: CaseStatus.ACTIVE,
    })
    status: CaseStatus;

    @ApiProperty({
        description: "病例分型",
        enum: CaseType,
        example: CaseType.TYPE_A,
    })
    caseType: CaseType;

    @ApiProperty({
        description: "完整病历内容",
        type: () => Object,
    })
    content: ClinicalCaseComplete;

    @ApiProperty({
        description: "创建时间",
        example: "2024-03-17T10:30:00.000Z",
    })
    createdAt: Date;

    @ApiProperty({
        description: "更新时间",
        example: "2024-03-17T10:30:00.000Z",
    })
    updatedAt: Date;

    @ApiProperty({
        description: "创建者ID",
        example: "user123",
        required: false,
    })
    createdBy: string | undefined;

    @ApiProperty({
        description: "更新者ID",
        example: "user123",
        required: false,
    })
    updatedBy: string | undefined;

    @ApiProperty({
        description: "标签",
        example: ["急症", "手术"],
        required: false,
        type: [String],
    })
    tags: string[] | undefined;

    @ApiProperty({
        description: "备注",
        example: "需要随访",
        required: false,
    })
    remarks: string | undefined;

    constructor(partial: Partial<CaseEntity>) {
        Object.assign(this, partial);
    }
}

/**
 * 科室实体
 */
export class DepartmentEntity {
    @ApiProperty({
        description: "科室代码",
        example: "general-surgery",
    })
    code: string;

    @ApiProperty({
        description: "科室名称",
        example: "普外科",
    })
    name: string;

    @ApiProperty({
        description: "科室描述",
        example: "普通外科，主要负责腹部外科手术",
        required: false,
    })
    description?: string;

    @ApiProperty({
        description: "病例数量",
        example: 128,
        required: false,
    })
    caseCount?: number;

    constructor(partial: Partial<DepartmentEntity>) {
        Object.assign(this, partial);
    }
}

/**
 * 疾病实体
 */
export class DiseaseEntity {
    @ApiProperty({
        description: "疾病代码",
        example: "appendicitis",
    })
    code: string;

    @ApiProperty({
        description: "疾病名称",
        example: "急性阑尾炎",
    })
    name: string;

    @ApiProperty({
        description: "所属科室",
        example: "普外科",
        required: false,
    })
    department?: string;

    @ApiProperty({
        description: "疾病描述",
        example: "阑尾的急性炎症，需要紧急手术治疗",
        required: false,
    })
    description?: string;

    @ApiProperty({
        description: "病例数量",
        example: 56,
        required: false,
    })
    caseCount?: number;

    constructor(partial: Partial<DiseaseEntity>) {
        Object.assign(this, partial);
    }
}
