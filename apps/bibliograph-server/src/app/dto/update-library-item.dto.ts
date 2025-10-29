import { IsString, IsArray, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { Author } from '@aikb/bibliography';

export class UpdateLibraryItemDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsArray()
  authors?: Author[];

  @IsOptional()
  @IsString()
  abstract?: string;

  @IsOptional()
  @IsNumber()
  publicationYear?: number;

  @IsOptional()
  @IsString()
  publisher?: string;

  @IsOptional()
  @IsString()
  isbn?: string;

  @IsOptional()
  @IsString()
  doi?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  collections?: string[];

  @IsOptional()
  @IsEnum(['pdf', 'article', 'book', 'other'])
  fileType?: 'pdf' | 'article' | 'book' | 'other';

  @IsOptional()
  @IsString()
  s3Key?: string;

  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @IsOptional()
  @IsNumber()
  pageCount?: number;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  contentHash?: string;
}