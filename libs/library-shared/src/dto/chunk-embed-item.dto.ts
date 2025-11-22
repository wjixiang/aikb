import {
  IsString,
  IsArray,
  IsOptional,
  IsNumber,
  IsEnum,
  IsObject,
  IsBoolean,
  IsDateString,
  ValidateNested,
  IsNotEmpty,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { ChunkEmbedGroupMetadata } from 'item-vector-storage';
import { ChunkingStrategy } from 'chunking';
import {
  EmbeddingProvider,
  OpenAIModel,
  AlibabaModel,
  OnnxModel,
} from 'embedding';

// Nested validation classes for ChunkEmbedGroupMetadata
class ChunkingConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxChunkSize?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minChunkSize?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overlap?: number;

  @IsOptional()
  @IsEnum(ChunkingStrategy)
  strategy?: ChunkingStrategy;
}

class EmbeddingConfigDto {
  @IsEnum([
    ...Object.values(OpenAIModel),
    ...Object.values(AlibabaModel),
    ...Object.values(OnnxModel),
  ])
  model!: OpenAIModel | AlibabaModel | OnnxModel;

  @IsNumber()
  @Min(1)
  dimension!: number;

  @IsNumber()
  @Min(1)
  @Max(1000)
  batchSize!: number;

  @IsNumber()
  @Min(0)
  @Max(10)
  maxRetries!: number;

  @IsNumber()
  @Min(1000)
  timeout!: number;

  @IsEnum(EmbeddingProvider)
  provider!: EmbeddingProvider;
}

export class ChunkEmbedItemDto {
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => ChunkEmbedGroupMetadataDto)
  chunkEmbedGroupMetadata!: ChunkEmbedGroupMetadata;
}

class ChunkEmbedGroupMetadataDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => ChunkingConfigDto)
  chunkingConfig!: ChunkingConfigDto;

  @IsObject()
  @ValidateNested()
  @Type(() => EmbeddingConfigDto)
  embeddingConfig!: EmbeddingConfigDto;

  @IsBoolean()
  isDefault!: boolean;

  @IsBoolean()
  isActive!: boolean;

  @IsDateString()
  createdAt!: string;

  @IsDateString()
  updatedAt!: string;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
