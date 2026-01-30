import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';

export class CreateVertexDto {
  @IsString()
  content: string;

  @IsEnum(['concept', 'attribute', 'relationship'])
  type: 'concept' | 'attribute' | 'relationship';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
