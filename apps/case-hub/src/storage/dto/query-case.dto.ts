/**
 * 查询病历 DTO
 */
import {
    IsString,
    IsOptional,
    IsArray,
    IsInt,
    IsDate,
    IsEnum,
    Min,
    Max,
} from "class-validator";
import { Type } from "class-transformer";

export enum SortBy {
    CREATED_AT = "createdAt",
    UPDATED_AT = "updatedAt",
    TITLE = "title",
}

export enum SortOrder {
    ASC = "asc",
    DESC = "desc",
}

export class QueryCaseDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @IsOptional()
    @IsString()
    keyword?: string;

    @IsOptional()
    @IsString()
    department?: string;

    @IsOptional()
    @IsString()
    diseaseType?: string;

    @IsOptional()
    @IsString()
    caseType?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    startDate?: Date;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    endDate?: Date;

    @IsOptional()
    @IsString()
    createdBy?: string;

    @IsOptional()
    @IsEnum(SortBy)
    sortBy?: SortBy = SortBy.CREATED_AT;

    @IsOptional()
    @IsEnum(SortOrder)
    sortOrder?: SortOrder = SortOrder.DESC;
}
