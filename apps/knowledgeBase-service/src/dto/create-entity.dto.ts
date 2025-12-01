import { IsString, IsArray, IsOptional, IsEnum } from 'class-validator';

export class CreateNomenclatureDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  acronym?: string;

  @IsEnum(['en', 'zh'])
  language: 'en' | 'zh';
}

export class CreateAbstractDto {
  @IsString()
  description: string;
}

export class CreateEntityDto {
  @IsArray()
  nomenclature: CreateNomenclatureDto[];

  abstract: CreateAbstractDto;
}
