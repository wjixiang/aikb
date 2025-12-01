import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';

export class SearchDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsNumber()
  offset?: number;

  @IsOptional()
  @IsEnum(['en', 'zh'])
  language?: 'en' | 'zh';

  @IsOptional()
  @IsNumber()
  threshold?: number;
}
