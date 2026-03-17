/**
 * 创建病历 DTO
 */

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
    IsArray,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    Max,
    Min,
} from "class-validator";
import { CaseType } from "../interfaces/case.interface.js";
import { ClinicalCaseComplete } from "../../types/case.type.js";
import { CaseStatus } from "../interfaces/case.interface.js";

/**
 * 创建病历请求 DTO
 */
export class CreateCaseDto {
    @ApiProperty({
        description: "病历编号",
        example: "CASE202403170001",
    })
    @IsString()
    @IsNotEmpty({ message: "病历编号不能为空" })
    caseNumber: string;

    @ApiProperty({
        description: "患者姓名",
        example: "张三",
    })
    @IsString()
    @IsNotEmpty({ message: "患者姓名不能为空" })
    patientName: string;

    @ApiProperty({
        description: "患者性别",
        enum: ["男", "女", "其他"],
        example: "男",
    })
    @IsEnum(["男", "女", "其他"], { message: "性别必须是男、女或其他" })
    gender: "男" | "女" | "其他";

    @ApiProperty({
        description: "患者年龄",
        example: 45,
        minimum: 0,
        maximum: 150,
    })
    @IsInt({ message: "年龄必须是整数" })
    @Min(0, { message: "年龄不能小于0" })
    @Max(150, { message: "年龄不能大于150" })
    age: number;

    @ApiProperty({
        description: "科室",
        example: "普外科",
    })
    @IsString()
    @IsNotEmpty({ message: "科室不能为空" })
    department: string;

    @ApiProperty({
        description: "疾病名称",
        example: "急性阑尾炎",
    })
    @IsString()
    @IsNotEmpty({ message: "疾病名称不能为空" })
    disease: string;

    @ApiPropertyOptional({
        description: "病历状态",
        enum: CaseStatus,
        example: CaseStatus.ACTIVE,
        default: CaseStatus.ACTIVE,
    })
    @IsOptional()
    @IsEnum(CaseStatus, { message: "无效的病历状态" })
    status?: CaseStatus;

    @ApiPropertyOptional({
        description: "病例分型：A/B/C/D",
        enum: CaseType,
        example: CaseType.TYPE_A,
        default: CaseType.TYPE_A,
    })
    @IsOptional()
    @IsEnum(CaseType, { message: "无效的病例分型" })
    caseType?: CaseType;

    @ApiProperty({
        description: "完整病历内容",
        type: () => Object,
    })
    @IsObject({ message: "病历内容必须是对象" })
    @IsNotEmpty({ message: "病历内容不能为空" })
    content: ClinicalCaseComplete;

    @ApiPropertyOptional({
        description: "创建者ID",
        example: "user123",
    })
    @IsOptional()
    @IsString()
    createdBy?: string;

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
