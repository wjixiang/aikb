/**
 * Generator Controller - 病历生成 REST API 控制器
 */

import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    HttpCode,
    HttpStatus,
    ValidationPipe,
    NotFoundException,
    BadRequestException
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";
import { GeneratorService } from "./generator.service.js";
import { GenerateCaseDto } from "./dto/generate-case.dto.js";
import { BatchGenerateDto } from "./dto/batch-generate.dto.js";
import { GenerateLongCaseDto } from "./dto/generate-long-case.dto.js";
import {
    SingleGenerationResponseDto,
    BatchGenerationResponseDto,
    JobStatusResponseDto,
    TemplatesResponseDto,
    GeneratedCaseDto,
    GenerationJobDto,
    TemplateInfoDto
} from "./dto/generation-response.dto.js";
import type { CaseGeneratorOptions } from "../types/generator.type.js";

@ApiTags("generator")
@Controller("generator")
export class GeneratorController {
    constructor(private readonly generatorService: GeneratorService) {}

    /**
     * 生成单个病历
     */
    @Post("case")
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "生成单个病历", description: "根据指定参数生成一份病历" })
    @ApiResponse({
        status: HttpStatus.OK,
        description: "病历生成成功",
        type: SingleGenerationResponseDto
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: "请求参数错误"
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: "生成失败"
    })
    async generateCase(
        @Body(new ValidationPipe({ transform: true })) dto: GenerateCaseDto
    ): Promise<SingleGenerationResponseDto> {
        try {
            const options: CaseGeneratorOptions = this.buildOptionsFromDto(dto);

            const result = await this.generatorService.generateCase(options);

            return {
                success: true,
                data: {
                    content: result.content,
                    metadata: {
                        department: result.metadata.department,
                        disease: result.metadata.disease,
                        caseType: result.metadata.caseType,
                        generatedAt: result.metadata.generatedAt
                    }
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                data: {
                    content: "",
                    metadata: {
                        department: "",
                        disease: "",
                        caseType: "A型",
                        generatedAt: new Date().toISOString()
                    }
                },
                error: errorMessage
            };
        }
    }

    /**
     * 批量生成病历
     */
    @Post("batch")
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiOperation({
        summary: "批量生成病历",
        description: "异步批量生成多份病历，返回任务ID用于查询进度"
    })
    @ApiResponse({
        status: HttpStatus.ACCEPTED,
        description: "批量生成任务已启动",
        type: BatchGenerationResponseDto
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: "请求参数错误（count 必须在 1-100 之间）"
    })
    async batchGenerate(
        @Body(new ValidationPipe({ transform: true })) dto: BatchGenerateDto
    ): Promise<BatchGenerationResponseDto> {
        try {
            const options: CaseGeneratorOptions = dto.options
                ? this.buildOptionsFromDto(dto.options)
                : {};

            const job = await this.generatorService.batchGenerate(dto.count, options);

            return {
                success: true,
                job: this.mapJobToDto(job)
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new BadRequestException(errorMessage);
        }
    }

    /**
     * 生成长病历
     */
    @Post("long-case")
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: "生成长病历",
        description: "生成约3000字的详细长病历，分段生成后合并"
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: "长病历生成成功",
        type: SingleGenerationResponseDto
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: "请求参数错误"
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: "生成失败"
    })
    async generateLongCase(
        @Body(new ValidationPipe({ transform: true })) dto: GenerateLongCaseDto
    ): Promise<SingleGenerationResponseDto> {
        try {
            const options: CaseGeneratorOptions = this.buildOptionsFromLongDto(dto);

            const result = await this.generatorService.generateLongCase(options);

            return {
                success: true,
                data: {
                    content: result.content,
                    metadata: {
                        department: result.metadata.department,
                        disease: result.metadata.disease,
                        caseType: result.metadata.caseType,
                        generatedAt: result.metadata.generatedAt
                    }
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                data: {
                    content: "",
                    metadata: {
                        department: "",
                        disease: "",
                        caseType: "A型",
                        generatedAt: new Date().toISOString()
                    }
                },
                error: errorMessage
            };
        }
    }

    /**
     * 查询生成任务状态
     */
    @Get("jobs/:id")
    @ApiOperation({
        summary: "查询生成任务状态",
        description: "根据任务ID查询批量生成任务的进度和结果"
    })
    @ApiParam({ name: "id", description: "任务ID" })
    @ApiResponse({
        status: HttpStatus.OK,
        description: "查询成功",
        type: JobStatusResponseDto
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: "任务不存在"
    })
    getJobStatus(@Param("id") jobId: string): JobStatusResponseDto {
        const job = this.generatorService.getJobStatus(jobId);

        if (!job) {
            throw new NotFoundException(`Job ${jobId} not found`);
        }

        return {
            success: true,
            job: this.mapJobToDto(job)
        };
    }

    /**
     * 获取所有任务
     */
    @Get("jobs")
    @ApiOperation({
        summary: "获取所有生成任务",
        description: "获取所有生成任务的列表"
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: "查询成功",
        type: [GenerationJobDto]
    })
    getAllJobs(): GenerationJobDto[] {
        const jobs = this.generatorService.getAllJobs();
        return jobs.map((job) => this.mapJobToDto(job));
    }

    /**
     * 获取可用模板列表
     */
    @Get("templates")
    @ApiOperation({
        summary: "获取可用模板列表",
        description: "获取所有支持的科室和疾病模板列表"
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: "查询成功",
        type: TemplatesResponseDto
    })
    getTemplates(): TemplatesResponseDto {
        const templates = this.generatorService.getTemplates();

        return {
            success: true,
            templates: templates.templates.map(
                (t): TemplateInfoDto => ({
                    department: t.department,
                    diseases: t.diseases
                })
            ),
            totalDepartments: templates.totalDepartments,
            totalDiseases: templates.totalDiseases
        };
    }

    /**
     * 将 Job 映射为 DTO
     */
    private mapJobToDto(job: {
        id: string;
        type: "single" | "batch" | "long";
        status: import("./interfaces/generator.interface.js").GenerationJobStatus;
        total: number;
        completed: number;
        failed: number;
        results: Array<{
            content: string;
            metadata: {
                department: string;
                disease: string;
                caseType: "A型" | "B型" | "C型" | "D型";
                generatedAt: string;
            };
        }>;
        errors: string[];
        createdAt: Date;
        completedAt?: Date | undefined;
    }): GenerationJobDto {
        return {
            id: job.id,
            type: job.type,
            status: job.status,
            total: job.total,
            completed: job.completed,
            failed: job.failed,
            results: job.results.map(
                (r): GeneratedCaseDto => ({
                    content: r.content,
                    metadata: {
                        department: r.metadata.department,
                        disease: r.metadata.disease,
                        caseType: r.metadata.caseType,
                        generatedAt: r.metadata.generatedAt
                    }
                })
            ),
            errors: job.errors,
            createdAt: job.createdAt,
            completedAt: job.completedAt
        };
    }

    /**
     * 从 DTO 构建 CaseGeneratorOptions
     */
    private buildOptionsFromDto(dto: GenerateCaseDto): CaseGeneratorOptions {
        const options: CaseGeneratorOptions = {};
        if (dto.department !== undefined) options.department = dto.department;
        if (dto.disease !== undefined) options.disease = dto.disease;
        if (dto.patientName !== undefined) options.patientName = dto.patientName;
        if (dto.ageRange !== undefined) options.ageRange = dto.ageRange;
        if (dto.gender !== undefined) options.gender = dto.gender;
        if (dto.caseType !== undefined) options.caseType = dto.caseType;
        if (dto.anonymize !== undefined) options.anonymize = dto.anonymize;
        return options;
    }

    /**
     * 从 LongCase DTO 构建 CaseGeneratorOptions
     */
    private buildOptionsFromLongDto(dto: GenerateLongCaseDto): CaseGeneratorOptions {
        const options: CaseGeneratorOptions = {};
        if (dto.department !== undefined) options.department = dto.department;
        if (dto.disease !== undefined) options.disease = dto.disease;
        if (dto.patientName !== undefined) options.patientName = dto.patientName;
        if (dto.ageRange !== undefined) {
            options.ageRange = {
                min: dto.ageRange.min,
                max: dto.ageRange.max
            };
        }
        if (dto.gender !== undefined) options.gender = dto.gender;
        if (dto.caseType !== undefined) options.caseType = dto.caseType;
        if (dto.anonymize !== undefined) options.anonymize = dto.anonymize;
        return options;
    }
}
