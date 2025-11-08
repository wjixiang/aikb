import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  IsObject,
} from 'class-validator';

export class UpdateMetadataDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsArray()
  authors?: Array<{
    firstName: string;
    lastName: string;
    middleName?: string;
  }>;

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
