import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  ValidateNested,
  IsObject,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ChunkingStrategy } from 'chunking';
import {
  EmbeddingProvider,
  OpenAIModel,
  AlibabaModel,
  OnnxModel,
} from 'embedding';

class ChunkingConfigDto {
  @IsEnum(ChunkingStrategy)
  strategy!: ChunkingStrategy;
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
  @IsOptional()
  batchSize?: number;

  @IsNumber()
  @Min(0)
  @Max(10)
  @IsOptional()
  maxRetries?: number;

  @IsNumber()
  @Min(1000)
  @IsOptional()
  timeout?: number;

  @IsEnum(EmbeddingProvider)
  provider!: EmbeddingProvider;
}

export class CreateChunkEmbedGroupDto {
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => ChunkingConfigDto)
  @IsOptional()
  chunkingConfig?: ChunkingConfigDto;

  @IsObject()
  @ValidateNested()
  @Type(() => EmbeddingConfigDto)
  @IsOptional()
  embeddingConfig?: EmbeddingConfigDto;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  createdBy?: string;
}
