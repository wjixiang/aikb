/**
 * 更新病历 DTO
 */

import { ApiPropertyOptional } from "@nestjs/swagger";
import {
    IsArray,
    IsEnum,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
    Max,
    Min,
} from "class-validator";
import { ClinicalCaseComplete } from "../../types/case.type.js";
import { CaseStatus, CaseType } from "../interfaces/case.interface.js";

/**
 * 更新病历请求 DTO
 */
export class UpdateCaseDto {
    @ApiPropertyOptional({
        description: "病历编号",
        example: "CASE202403170001",
    })
    @IsOptional()
    @IsString()
    caseNumber?: string;

    @ApiPropertyOptional({
        description: "患者姓名",
        example: "张三",
    })
    @IsOptional()
    @IsString()
    patientName?: string;

    @ApiPropertyOptional({
        description: "患者性别",
        enum: ["男", "女", "其他"],
        example: "男",
    })
    @IsOptional()
    @IsEnum(["男", "女", "其他"], { message: "性别必须是男、女或其他" })
    gender?: "男" | "女" | "其他";

    @ApiPropertyOptional({
        description: "患者年龄",
        example: 45,
        minimum: 0,
        maximum: 150,
    })
    @IsOptional()
    @IsInt({ message: "年龄必须是整数" })
    @Min(0, { message: "年龄不能小于0" })
    @Max(150, { message: "年龄不能大于150" })
    age?: number;

    @ApiPropertyOptional({
        description: "科室",
        example: "普外科",
    })
    @IsOptional()
    @IsString()
    department?: string;

    @ApiPropertyOptional({
        description: "疾病名称",
        example: "急性阑尾炎",
    })
    @IsOptional()
    @IsString()
    disease?: string;

    @ApiPropertyOptional({
        description: "病历状态",
        enum: CaseStatus,
        example: CaseStatus.ACTIVE,
    })
    @IsOptional()
    @IsEnum(CaseStatus, { message: "无效的病历状态" })
    status?: CaseStatus;

    @ApiPropertyOptional({
        description: "病例分型：A/B/C/D",
        enum: CaseType,
        example: CaseType.TYPE_A,
    })
    @IsOptional()
    @IsEnum(CaseType, { message: "无效的病例分型" })
    caseType?: CaseType;

    @ApiPropertyOptional({
        description: "完整病历内容",
        type: () => Object,
    })
    @IsOptional()
    @IsObject({ message: "病历内容必须是对象" })
    content?: ClinicalCaseComplete;

    @ApiPropertyOptional({
        description: "更新者ID",
        example: "user123",
    })
    @IsOptional()
    @IsString()
    updatedBy?: string;

    @ApiPropertyOptional({
        description: "标签",
        example: ["急症", "手术"],
        type: [String],
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true, message: "标签必须是字符串数组" })
    tags?: string[];

    @ApiPropertyOptional({
        description: "备注",
        example: "需要随访",
    })
    @IsOptional()
    @IsString()
    remarks?: string;
}
