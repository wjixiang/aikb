/**
 * 生成长病历 DTO
 */
import { IsString, IsOptional, IsBoolean, IsInt, IsEnum, Min, Max, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * 年龄范围 DTO
 */
export class LongCaseAgeRangeDto {
    @ApiProperty({ description: "最小年龄", minimum: 0, maximum: 150 })
    @IsInt()
    @Min(0)
    @Max(150)
    @Type(() => Number)
    min!: number;

    @ApiProperty({ description: "最大年龄", minimum: 0, maximum: 150 })
    @IsInt()
    @Min(0)
    @Max(150)
    @Type(() => Number)
    max!: number;
}

/**
 * 生成长病历请求 DTO
 */
export class GenerateLongCaseDto {
    @ApiPropertyOptional({ description: "科室类型，如：呼吸内科、消化内科、心内科等" })
    @IsString()
    @IsOptional()
    department?: string;

    @ApiPropertyOptional({ description: "疾病类型，如：肺炎、胃炎、冠心病等" })
    @IsString()
    @IsOptional()
    disease?: string;

    @ApiPropertyOptional({ description: "患者姓名（可选，不传则随机生成）" })
    @IsString()
    @IsOptional()
    patientName?: string;

    @ApiPropertyOptional({ description: "患者年龄范围" })
    @ValidateNested()
    @Type(() => LongCaseAgeRangeDto)
    @IsOptional()
    ageRange?: LongCaseAgeRangeDto;

    @ApiPropertyOptional({ description: "性别", enum: ["男", "女"] })
    @IsEnum(["男", "女"] as const)
    @IsOptional()
    gender?: "男" | "女";

    @ApiPropertyOptional({ description: "病例分型：A/B/C/D", enum: ["A型", "B型", "C型", "D型"] })
    @IsEnum(["A型", "B型", "C型", "D型"] as const)
    @IsOptional()
    caseType?: "A型" | "B型" | "C型" | "D型";

    @ApiPropertyOptional({ description: "是否生成脱敏版本", default: false })
    @IsBoolean()
    @IsOptional()
    anonymize?: boolean;
}
