/**
 * 生成响应 DTO
 */
import { IsString, IsObject, IsArray, IsEnum, IsInt, IsOptional, IsDate } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
type GenerationJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/**
 * 病历元数据 DTO
 */
export class CaseMetadataDto {
    @ApiProperty({ description: "科室" })
    @IsString()
    department!: string;

    @ApiProperty({ description: "疾病" })
    @IsString()
    disease!: string;

    @ApiProperty({ description: "病例分型", enum: ["A型", "B型", "C型", "D型"] })
    @IsEnum(["A型", "B型", "C型", "D型"] as const)
    caseType!: "A型" | "B型" | "C型" | "D型";

    @ApiProperty({ description: "生成时间" })
    @IsString()
    generatedAt!: string;
}

/**
 * 生成的病历 DTO
 */
export class GeneratedCaseDto {
    @ApiProperty({ description: "病历内容（Markdown格式）" })
    @IsString()
    content!: string;

    @ApiProperty({ description: "病历元数据" })
    @IsObject()
    @Type(() => CaseMetadataDto)
    metadata!: CaseMetadataDto;
}

/**
 * 生成任务 DTO
 */
export class GenerationJobDto {
    @ApiProperty({ description: "任务ID" })
    @IsString()
    id!: string;

    @ApiProperty({ description: "任务类型", enum: ["single", "batch", "long"] })
    @IsEnum(["single", "batch", "long"] as const)
    type!: "single" | "batch" | "long";

    @ApiProperty({ description: "任务状态", enum: ["pending", "running", "completed", "failed", "cancelled"] })
    @IsEnum(["pending", "running", "completed", "failed", "cancelled"] as const)
    status!: GenerationJobStatus;

    @ApiProperty({ description: "总数量" })
    @IsInt()
    total!: number;

    @ApiProperty({ description: "已完成数量" })
    @IsInt()
    completed!: number;

    @ApiProperty({ description: "失败数量" })
    @IsInt()
    failed!: number;

    @ApiProperty({ description: "生成的病历列表", type: [GeneratedCaseDto] })
    @IsArray()
    @Type(() => GeneratedCaseDto)
    results!: GeneratedCaseDto[];

    @ApiProperty({ description: "错误信息列表" })
    @IsArray()
    @IsString({ each: true })
    errors!: string[];

    @ApiProperty({ description: "创建时间" })
    @Type(() => Date)
    @IsDate()
    createdAt!: Date;

    @ApiPropertyOptional({ description: "完成时间" })
    @Type(() => Date)
    @IsDate()
    @IsOptional()
    completedAt?: Date | undefined;
}

/**
 * 单个病历生成响应 DTO
 */
export class SingleGenerationResponseDto {
    @ApiProperty({ description: "是否成功" })
    success!: boolean;

    @ApiProperty({ description: "病历数据" })
    @Type(() => GeneratedCaseDto)
    data!: GeneratedCaseDto;

    @ApiPropertyOptional({ description: "错误信息" })
    @IsString()
    @IsOptional()
    error?: string;
}

/**
 * 批量生成响应 DTO
 */
export class BatchGenerationResponseDto {
    @ApiProperty({ description: "是否成功" })
    success!: boolean;

    @ApiProperty({ description: "任务信息" })
    @Type(() => GenerationJobDto)
    job!: GenerationJobDto;

    @ApiPropertyOptional({ description: "错误信息" })
    @IsString()
    @IsOptional()
    error?: string;
}

/**
 * 任务状态响应 DTO
 */
export class JobStatusResponseDto {
    @ApiProperty({ description: "是否成功" })
    success!: boolean;

    @ApiPropertyOptional({ description: "任务信息" })
    @Type(() => GenerationJobDto)
    @IsOptional()
    job?: GenerationJobDto;

    @ApiPropertyOptional({ description: "错误信息" })
    @IsString()
    @IsOptional()
    error?: string;
}

/**
 * 模板信息 DTO
 */
export class TemplateInfoDto {
    @ApiProperty({ description: "科室名称" })
    @IsString()
    department!: string;

    @ApiProperty({ description: "疾病列表" })
    @IsArray()
    @IsString({ each: true })
    diseases!: string[];
}

/**
 * 模板列表响应 DTO
 */
export class TemplatesResponseDto {
    @ApiProperty({ description: "是否成功" })
    success!: boolean;

    @ApiProperty({ description: "模板列表", type: [TemplateInfoDto] })
    @IsArray()
    @Type(() => TemplateInfoDto)
    templates!: TemplateInfoDto[];

    @ApiProperty({ description: "总科室数" })
    @IsInt()
    totalDepartments!: number;

    @ApiProperty({ description: "总疾病数" })
    @IsInt()
    totalDiseases!: number;
}
