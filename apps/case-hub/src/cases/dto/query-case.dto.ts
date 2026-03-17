/**
 * 查询病历 DTO
 */

import { ApiPropertyOptional } from "@nestjs/swagger";
import {
    IsDateString,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Max,
    Min,
} from "class-validator";
import { Type } from "class-transformer";
import { CaseStatus, CaseType } from "../interfaces/case.interface.js";

/**
 * 查询病历请求 DTO
 */
export class QueryCaseDto {
    @ApiPropertyOptional({
        description: "关键词搜索（姓名、病历号、疾病）",
        example: "张三",
    })
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({
        description: "科室筛选",
        example: "普外科",
    })
    @IsOptional()
    @IsString()
    department?: string;

    @ApiPropertyOptional({
        description: "疾病筛选",
        example: "急性阑尾炎",
    })
    @IsOptional()
    @IsString()
    disease?: string;

    @ApiPropertyOptional({
        description: "性别筛选",
        enum: ["男", "女", "其他"],
        example: "男",
    })
    @IsOptional()
    @IsEnum(["男", "女", "其他"], { message: "性别必须是男、女或其他" })
    gender?: "男" | "女" | "其他";

    @ApiPropertyOptional({
        description: "年龄范围 - 最小",
        example: 18,
        minimum: 0,
        maximum: 150,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "最小年龄必须是整数" })
    @Min(0, { message: "年龄不能小于0" })
    @Max(150, { message: "年龄不能大于150" })
    minAge?: number;

    @ApiPropertyOptional({
        description: "年龄范围 - 最大",
        example: 65,
        minimum: 0,
        maximum: 150,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "最大年龄必须是整数" })
    @Min(0, { message: "年龄不能小于0" })
    @Max(150, { message: "年龄不能大于150" })
    maxAge?: number;

    @ApiPropertyOptional({
        description: "状态筛选",
        enum: CaseStatus,
        example: CaseStatus.ACTIVE,
    })
    @IsOptional()
    @IsEnum(CaseStatus, { message: "无效的病历状态" })
    status?: CaseStatus;

    @ApiPropertyOptional({
        description: "病例分型筛选",
        enum: CaseType,
        example: CaseType.TYPE_A,
    })
    @IsOptional()
    @IsEnum(CaseType, { message: "无效的病例分型" })
    caseType?: CaseType;

    @ApiPropertyOptional({
        description: "创建时间范围 - 开始 (ISO 8601 格式)",
        example: "2024-01-01T00:00:00.000Z",
    })
    @IsOptional()
    @IsDateString({}, { message: "开始时间必须是有效的日期字符串" })
    createdFrom?: string;

    @ApiPropertyOptional({
        description: "创建时间范围 - 结束 (ISO 8601 格式)",
        example: "2024-12-31T23:59:59.999Z",
    })
    @IsOptional()
    @IsDateString({}, { message: "结束时间必须是有效的日期字符串" })
    createdTo?: string;

    @ApiPropertyOptional({
        description: "页码",
        example: 1,
        default: 1,
        minimum: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "页码必须是整数" })
    @Min(1, { message: "页码必须大于等于1" })
    page?: number;

    @ApiPropertyOptional({
        description: "每页数量",
        example: 10,
        default: 10,
        minimum: 1,
        maximum: 100,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "每页数量必须是整数" })
    @Min(1, { message: "每页数量必须大于等于1" })
    @Max(100, { message: "每页数量不能大于100" })
    pageSize?: number;

    @ApiPropertyOptional({
        description: "排序字段",
        example: "createdAt",
        default: "createdAt",
    })
    @IsOptional()
    @IsString()
    sortBy?: string;

    @ApiPropertyOptional({
        description: "排序方向",
        enum: ["asc", "desc"],
        example: "desc",
        default: "desc",
    })
    @IsOptional()
    @IsEnum(["asc", "desc"], { message: "排序方向必须是 asc 或 desc" })
    sortOrder?: "asc" | "desc";
}
