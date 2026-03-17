/**
 * 创建病历 DTO
 */
import {
    IsString,
    IsOptional,
    IsArray,
    IsObject,
    Length,
    ArrayMinSize,
} from "class-validator";
import type { ClinicalCaseComplete } from "../../types/case.type.js";

export class CreateCaseDto {
    @IsString()
    @Length(1, 200, { message: "标题长度必须在 1-200 字符之间" })
    title!: string;

    @IsString()
    @Length(1, 50000, { message: "内容长度必须在 1-50000 字符之间" })
    content!: string;

    @IsOptional()
    @IsObject()
    structuredData?: ClinicalCaseComplete;

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
    @ArrayMinSize(0)
    tags?: string[];

    @IsOptional()
    @IsString()
    createdBy?: string;
}
