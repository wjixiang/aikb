/**
 * 批量生成病历 DTO
 */
import { IsInt, Min, Max, ValidateNested, IsOptional } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { GenerateCaseDto } from "./generate-case.dto.js";

/**
 * 批量生成病历请求 DTO
 */
export class BatchGenerateDto {
    @ApiProperty({ description: "生成数量", minimum: 1, maximum: 100 })
    @IsInt()
    @Min(1)
    @Max(100)
    @Type(() => Number)
    count!: number;

    @ApiPropertyOptional({ description: "生成选项" })
    @ValidateNested()
    @Type(() => GenerateCaseDto)
    @IsOptional()
    options?: GenerateCaseDto;
}
