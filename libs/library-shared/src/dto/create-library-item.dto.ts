import {
  IsString,
  IsArray,
  IsOptional,
  IsNumber,
  IsEnum,
} from 'class-validator';
import { Author } from 'bibliography';

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

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  markdownContent?: string;

  @IsOptional()
  @IsArray()
  archives?: Array<{
    fileType: 'pdf';
    fileSize: number;
    fileHash: string;
    addDate: Date;
    s3Key: string;
    pageCount?: number;
    wordCount?: number;
  }>;
}
