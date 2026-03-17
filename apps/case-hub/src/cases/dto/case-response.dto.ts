/**
 * 病历响应 DTO
 */

import { ApiProperty } from "@nestjs/swagger";
import { ClinicalCaseComplete } from "../../types/case.type.js";
import { CaseStatus, CaseType } from "../interfaces/case.interface.js";

/**
 * 病历响应 DTO
 */
export class CaseResponseDto {
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
}

/**
 * 分页响应 DTO
 */
export class PaginatedResponseDto<T> {
    @ApiProperty({
        description: "数据列表",
        isArray: true,
    })
    items: T[];

    @ApiProperty({
        description: "总数量",
        example: 100,
    })
    total: number;

    @ApiProperty({
        description: "当前页码",
        example: 1,
    })
    page: number;

    @ApiProperty({
        description: "每页数量",
        example: 10,
    })
    pageSize: number;

    @ApiProperty({
        description: "总页数",
        example: 10,
    })
    totalPages: number;
}

/**
 * 病历列表响应 DTO
 */
export class CaseListResponseDto extends PaginatedResponseDto<CaseResponseDto> {
    declare items: CaseResponseDto[];
}

/**
 * 科室响应 DTO
 */
export class DepartmentResponseDto {
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
    description: string | undefined;

    @ApiProperty({
        description: "病例数量",
        example: 128,
        required: false,
    })
    caseCount: number | undefined;
}

/**
 * 科室列表响应 DTO
 */
export class DepartmentListResponseDto {
    @ApiProperty({
        description: "科室列表",
        type: [DepartmentResponseDto],
    })
    items: DepartmentResponseDto[];

    @ApiProperty({
        description: "总数量",
        example: 10,
    })
    total: number;
}

/**
 * 疾病响应 DTO
 */
export class DiseaseResponseDto {
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
    department: string | undefined;

    @ApiProperty({
        description: "疾病描述",
        example: "阑尾的急性炎症，需要紧急手术治疗",
        required: false,
    })
    description: string | undefined;

    @ApiProperty({
        description: "病例数量",
        example: 56,
        required: false,
    })
    caseCount: number | undefined;
}

/**
 * 疾病列表响应 DTO
 */
export class DiseaseListResponseDto {
    @ApiProperty({
        description: "疾病列表",
        type: [DiseaseResponseDto],
    })
    items: DiseaseResponseDto[];

    @ApiProperty({
        description: "总数量",
        example: 50,
    })
    total: number;
}

/**
 * 操作结果响应 DTO
 */
export class OperationResultDto {
    @ApiProperty({
        description: "操作是否成功",
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: "响应消息",
        example: "操作成功",
    })
    message: string;

    @ApiProperty({
        description: "数据",
        required: false,
    })
    data?: unknown;
}
