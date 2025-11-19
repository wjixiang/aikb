import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsObject,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ChunkingStrategy } from 'chunking';
import { EmbeddingProvider, OpenAIModel, AlibabaModel, OnnxModel } from 'embedding';

// Nested validation classes for chunking configuration
export class ChunkingConfigDto {
  @IsOptional()
  @IsEnum(ChunkingStrategy)
  strategy?: ChunkingStrategy;

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
}

// Nested validation classes for embedding configuration
export class EmbeddingConfigDto {
  @IsOptional()
  @IsEnum(EmbeddingProvider)
  provider?: EmbeddingProvider;

  @IsOptional()
  @IsEnum([...Object.values(OpenAIModel), ...Object.values(AlibabaModel), ...Object.values(OnnxModel)])
  model?: OpenAIModel | AlibabaModel | OnnxModel;

  @IsOptional()
  @IsNumber()
  @Min(1)
  dimension?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  batchSize?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  maxRetries?: number;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  timeout?: number;
}

export class CreateGroupAndChunkEmbedDto {
  @IsString()
  itemId!: string;

  @IsString()
  groupName!: string;

  @IsOptional()
  @IsString()
  groupDescription?: string;

  @IsOptional()
  @IsObject()
  @Type(() => ChunkingConfigDto)
  chunkingConfig?: ChunkingConfigDto;

  @IsOptional()
  @IsObject()
  @Type(() => EmbeddingConfigDto)
  embeddingConfig?: EmbeddingConfigDto;
}