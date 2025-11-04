import {
  IsString,
  IsArray,
  IsOptional,
  IsNumber,
  IsEnum,
} from 'class-validator';
import { Author } from '@aikb/bibliography';

export class CreateLibraryItemDto {
  @IsString()
  title!: string;

  @IsArray()
  authors!: Author[];

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

  @IsArray()
  tags!: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  collections!: string[];

  @IsEnum(['pdf', 'article', 'book', 'other'])
  fileType!: 'pdf' | 'article' | 'book' | 'other';

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

  @IsOptional()
  @IsString()
  markdownContent?: string;
}
