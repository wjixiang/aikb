/**
 * 通用分页 DTO
 * 用于所有分页查询请求
 */

import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsOptional,
  IsString,
  IsEnum,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * 排序方向枚举
 */
export enum SortOrder {
  ASC = "asc",
  DESC = "desc",
}

/**
 * 通用分页查询 DTO
 */
export class PaginationDto {
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
  page?: number = 1;

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
  pageSize?: number = 10;

  @ApiPropertyOptional({
    description: "排序字段",
    example: "createdAt",
    default: "createdAt",
  })
  @IsOptional()
  @IsString()
  sortBy?: string = "createdAt";

  @ApiPropertyOptional({
    description: "排序方向",
    enum: SortOrder,
    example: SortOrder.DESC,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder, { message: "排序方向必须是 asc 或 desc" })
  sortOrder?: SortOrder = SortOrder.DESC;
}

/**
 * 分页响应元数据
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * 分页响应 DTO 构建器
 */
export function buildPaginationMeta(
  page: number,
  pageSize: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / pageSize);
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
