/**
 * 病历控制器 - REST API
 */

import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    HttpStatus,
    HttpCode,
    ValidationPipe,
    ParseUUIDPipe,
} from "@nestjs/common";
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiQuery,
    ApiBearerAuth,
} from "@nestjs/swagger";
import { CasesService } from "./cases.service.js";
import { CreateCaseDto } from "./dto/create-case.dto.js";
import { UpdateCaseDto } from "./dto/update-case.dto.js";
import { QueryCaseDto } from "./dto/query-case.dto.js";
import {
    CaseResponseDto,
    CaseListResponseDto,
    DepartmentListResponseDto,
    DepartmentResponseDto,
    DiseaseListResponseDto,
    DiseaseResponseDto,
    OperationResultDto,
} from "./dto/case-response.dto.js";
import { ICase, ICaseQuery, CaseStatus, CaseType } from "./interfaces/case.interface.js";

/**
 * 将内部 ICase 转换为响应 DTO
 */
function toCaseResponseDto(medicalCase: ICase): CaseResponseDto {
    return {
        id: medicalCase.id,
        caseNumber: medicalCase.caseNumber,
        patientName: medicalCase.patientName,
        gender: medicalCase.gender,
        age: medicalCase.age,
        department: medicalCase.department,
        disease: medicalCase.disease,
        status: medicalCase.status,
        caseType: medicalCase.caseType,
        content: medicalCase.content,
        createdAt: medicalCase.createdAt,
        updatedAt: medicalCase.updatedAt,
        createdBy: medicalCase.createdBy ?? undefined,
        updatedBy: medicalCase.updatedBy ?? undefined,
        tags: medicalCase.tags ?? undefined,
        remarks: medicalCase.remarks ?? undefined,
    };
}

/**
 * 病历控制器
 */
@ApiTags("病历管理")
@ApiBearerAuth()
@Controller("cases")
export class CasesController {
    constructor(private readonly casesService: CasesService) {}

    /**
     * 创建病历
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: "创建病历",
        description: "创建一个新的病历记录",
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: "病历创建成功",
        type: CaseResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: "病历编号已存在",
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: "请求参数错误",
    })
    async create(
        @Body(new ValidationPipe({ transform: true })) createCaseDto: CreateCaseDto
    ): Promise<CaseResponseDto> {
        const medicalCase = await this.casesService.create(createCaseDto);
        return toCaseResponseDto(medicalCase);
    }

    /**
     * 查询病历列表
     */
    @Get()
    @ApiOperation({
        summary: "查询病历列表",
        description: "支持分页、筛选、排序的病历列表查询",
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: "查询成功",
        type: CaseListResponseDto,
    })
    @ApiQuery({
        name: "keyword",
        required: false,
        description: "关键词搜索（姓名、病历号、疾病）",
    })
    @ApiQuery({
        name: "department",
        required: false,
        description: "科室筛选",
    })
    @ApiQuery({
        name: "disease",
        required: false,
        description: "疾病筛选",
    })
    @ApiQuery({
        name: "gender",
        required: false,
        enum: ["男", "女", "其他"],
        description: "性别筛选",
    })
    @ApiQuery({
        name: "minAge",
        required: false,
        description: "年龄范围 - 最小",
    })
    @ApiQuery({
        name: "maxAge",
        required: false,
        description: "年龄范围 - 最大",
    })
    @ApiQuery({
        name: "status",
        required: false,
        enum: CaseStatus,
        description: "状态筛选",
    })
    @ApiQuery({
        name: "caseType",
        required: false,
        enum: ["A型", "B型", "C型", "D型"],
        description: "病例分型筛选",
    })
    @ApiQuery({
        name: "page",
        required: false,
        description: "页码",
    })
    @ApiQuery({
        name: "pageSize",
        required: false,
        description: "每页数量",
    })
    async findAll(
        @Query(new ValidationPipe({ transform: true })) queryDto: QueryCaseDto
    ): Promise<CaseListResponseDto> {
        const query: ICaseQuery = {
            keyword: queryDto.keyword,
            department: queryDto.department,
            disease: queryDto.disease,
            gender: queryDto.gender,
            minAge: queryDto.minAge,
            maxAge: queryDto.maxAge,
            status: queryDto.status,
            caseType: queryDto.caseType,
            createdFrom: queryDto.createdFrom ? new Date(queryDto.createdFrom) : undefined,
            createdTo: queryDto.createdTo ? new Date(queryDto.createdTo) : undefined,
            page: queryDto.page,
            pageSize: queryDto.pageSize,
            sortBy: queryDto.sortBy,
            sortOrder: queryDto.sortOrder,
        };

        const result = await this.casesService.findAll(query);

        return {
            items: result.items.map(toCaseResponseDto),
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
            totalPages: result.totalPages,
        };
    }

    /**
     * 获取单个病历详情
     */
    @Get(":id")
    @ApiOperation({
        summary: "获取病历详情",
        description: "根据ID获取单个病历的详细信息",
    })
    @ApiParam({
        name: "id",
        description: "病历唯一标识",
        example: "550e8400-e29b-41d4-a716-446655440000",
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: "查询成功",
        type: CaseResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: "病历不存在",
    })
    async findOne(
        @Param("id", ParseUUIDPipe) id: string
    ): Promise<CaseResponseDto> {
        const medicalCase = await this.casesService.findOne(id);
        return toCaseResponseDto(medicalCase);
    }

    /**
     * 更新病历
     */
    @Patch(":id")
    @ApiOperation({
        summary: "更新病历",
        description: "根据ID更新病历信息",
    })
    @ApiParam({
        name: "id",
        description: "病历唯一标识",
        example: "550e8400-e29b-41d4-a716-446655440000",
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: "更新成功",
        type: CaseResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: "病历不存在",
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: "病历编号已存在",
    })
    async update(
        @Param("id", ParseUUIDPipe) id: string,
        @Body(new ValidationPipe({ transform: true })) updateCaseDto: UpdateCaseDto
    ): Promise<CaseResponseDto> {
        const medicalCase = await this.casesService.update(id, updateCaseDto);
        return toCaseResponseDto(medicalCase);
    }

    /**
     * 删除病历
     */
    @Delete(":id")
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: "删除病历",
        description: "根据ID删除病历（软删除）",
    })
    @ApiParam({
        name: "id",
        description: "病历唯一标识",
        example: "550e8400-e29b-41d4-a716-446655440000",
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: "删除成功",
        type: OperationResultDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: "病历不存在",
    })
    async remove(
        @Param("id", ParseUUIDPipe) id: string
    ): Promise<OperationResultDto> {
        await this.casesService.remove(id);
        return {
            success: true,
            message: "病历删除成功",
            data: { id },
        };
    }

    /**
     * 获取科室列表
     */
    @Get("departments/list")
    @ApiOperation({
        summary: "获取科室列表",
        description: "获取所有可用的科室列表及每个科室的病例数量",
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: "查询成功",
        type: DepartmentListResponseDto,
    })
    async getDepartments(): Promise<DepartmentListResponseDto> {
        const departments = await this.casesService.getDepartments();
        return {
            items: departments.map((d): DepartmentResponseDto => ({
                code: d.code,
                name: d.name,
                description: d.description,
                caseCount: d.caseCount,
            })),
            total: departments.length,
        };
    }

    /**
     * 获取疾病列表
     */
    @Get("diseases/list")
    @ApiOperation({
        summary: "获取疾病列表",
        description: "获取所有可用的疾病列表及每个疾病的病例数量，可按科室筛选",
    })
    @ApiQuery({
        name: "department",
        required: false,
        description: "科室代码，用于筛选特定科室的疾病",
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: "查询成功",
        type: DiseaseListResponseDto,
    })
    async getDiseases(
        @Query("department") department?: string
    ): Promise<DiseaseListResponseDto> {
        const diseases = await this.casesService.getDiseases(department);
        return {
            items: diseases.map((d): DiseaseResponseDto => ({
                code: d.code,
                name: d.name,
                department: d.department,
                description: d.description,
                caseCount: d.caseCount,
            })),
            total: diseases.length,
        };
    }
}
