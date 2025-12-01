import { IsString, IsArray, IsOptional, IsNumber, IsEnum } from 'class-validator';

export class CreateNomenclatureDto {
  name: string;

  @IsOptional()
  acronym?: string;

  @IsEnum(['en', 'zh'])
  language: 'en' | 'zh';
}

export class CreateEmbeddingDto {
  model: string;

  @IsNumber()
  dimensions: number;

  @IsArray()
  @IsNumber({}, { each: true })
  vector: number[];
}

export class CreateAbstractDto {
  @IsString()
  description: string;

  embedding: CreateEmbeddingDto;
}

export class CreateEntityDto {
  @IsArray()
  nomenclature: CreateNomenclatureDto[];

  abstract: CreateAbstractDto;
}