import { IsString, IsArray, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmbeddingProvider } from 'embedding';

export class EmbeddingRequestDto {
  @ApiProperty({
    description: 'Text or array of texts to embed',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }]
  })
  @IsString()
  text!: string | string[];

  @ApiPropertyOptional({
    description: 'Embedding provider to use',
    enum: EmbeddingProvider,
    default: EmbeddingProvider.ALIBABA
  })
  @IsOptional()
  @IsEnum(EmbeddingProvider)
  provider?: EmbeddingProvider;
}

export class BatchEmbeddingRequestDto {
  @ApiProperty({
    description: 'Array of texts to embed',
    type: 'array',
    items: { type: 'string' }
  })
  @IsArray()
  @IsString({ each: true })
  texts!: string[];

  @ApiPropertyOptional({
    description: 'Embedding provider to use',
    enum: EmbeddingProvider,
    default: EmbeddingProvider.ALIBABA
  })
  @IsOptional()
  @IsEnum(EmbeddingProvider)
  provider?: EmbeddingProvider;

  @ApiPropertyOptional({
    description: 'Maximum number of concurrent requests',
    type: 'number',
    default: 5,
    minimum: 1,
    maximum: 20
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  concurrencyLimit?: number;
}

export class EmbeddingResponseDto {
  @ApiProperty({
    description: 'Whether the embedding was generated successfully',
    type: 'boolean'
  })
  success!: boolean;

  @ApiPropertyOptional({
    description: 'Generated embedding vector',
    type: 'array',
    items: { type: 'number' }
  })
  embedding?: number[];

  @ApiPropertyOptional({
    description: 'Error message if embedding failed',
    type: 'string'
  })
  error?: string;

  @ApiPropertyOptional({
    description: 'Provider used for embedding',
    enum: EmbeddingProvider
  })
  provider?: EmbeddingProvider;
}

export class BatchEmbeddingResponseDto {
  @ApiProperty({
    description: 'Whether the batch embedding was successful',
    type: 'boolean'
  })
  success!: boolean;

  @ApiPropertyOptional({
    description: 'Generated embedding vectors',
    type: 'array',
    items: { oneOf: [{ type: 'array', items: { type: 'number' } }, { type: 'null' }] }
  })
  embeddings?: (number[] | null)[];

  @ApiPropertyOptional({
    description: 'Error messages if any',
    type: 'array',
    items: { type: 'string' }
  })
  errors?: string[];

  @ApiPropertyOptional({
    description: 'Provider used for embedding',
    enum: EmbeddingProvider
  })
  provider?: EmbeddingProvider;

  @ApiProperty({
    description: 'Total number of texts processed',
    type: 'number'
  })
  totalCount!: number;

  @ApiProperty({
    description: 'Number of successful embeddings',
    type: 'number'
  })
  successCount!: number;

  @ApiProperty({
    description: 'Number of failed embeddings',
    type: 'number'
  })
  failureCount!: number;
}

export class ProviderInfoDto {
  @ApiProperty({
    description: 'Provider type',
    enum: EmbeddingProvider
  })
  provider!: EmbeddingProvider;

  @ApiProperty({
    description: 'Whether the provider is available',
    type: 'boolean'
  })
  available!: boolean;

  @ApiProperty({
    description: 'Whether the provider is initialized',
    type: 'boolean'
  })
  initialized!: boolean;
}

export class HealthCheckResponseDto {
  @ApiProperty({
    description: 'Health status',
    enum: ['healthy', 'unhealthy']
  })
  status!: 'healthy' | 'unhealthy';

  @ApiProperty({
    description: 'Provider information',
    type: 'array',
    items: { $ref: '#/components/schemas/ProviderInfoDto' }
  })
  providers!: ProviderInfoDto[];

  @ApiProperty({
    description: 'Timestamp of the health check',
    type: 'string'
  })
  timestamp!: string;
}

export class EmbeddingStatsDto {
  @ApiProperty({
    description: 'Total number of requests',
    type: 'number'
  })
  totalRequests!: number;

  @ApiProperty({
    description: 'Number of successful requests',
    type: 'number'
  })
  successfulRequests!: number;

  @ApiProperty({
    description: 'Number of failed requests',
    type: 'number'
  })
  failedRequests!: number;

  @ApiProperty({
    description: 'Average response time in milliseconds',
    type: 'number'
  })
  averageResponseTime!: number;

  @ApiProperty({
    description: 'Statistics per provider',
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: {
        requests: { type: 'number' },
        successes: { type: 'number' },
        failures: { type: 'number' },
        averageResponseTime: { type: 'number' }
      }
    }
  })
  providerStats!: Record<EmbeddingProvider, {
    requests: number;
    successes: number;
    failures: number;
    averageResponseTime: number;
  }>;
}