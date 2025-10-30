import { IsOptional, IsString, IsNumber, IsArray, IsObject, IsEnum } from 'class-validator';
import { PdfProcessingStatus } from '@aikb/bibliography';

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

  @IsOptional()
  @IsEnum(PdfProcessingStatus)
  pdfProcessingStatus?: PdfProcessingStatus;

  @IsOptional()
  @IsString()
  pdfProcessingMessage?: string;

  @IsOptional()
  @IsNumber()
  pdfProcessingProgress?: number;

  @IsOptional()
  @IsString()
  pdfProcessingError?: string;

  @IsOptional()
  @IsObject()
  pdfSplittingInfo?: {
    itemId: string;
    originalFileName: string;
    totalParts: number;
    parts: Array<{
      partIndex: number;
      startPage: number;
      endPage: number;
      pageCount: number;
      s3Key: string;
      status: string;
      processingTime?: number;
      error?: string;
    }>;
    processingTime: number;
  };

  @IsOptional()
  @IsObject()
  pdfPartStatuses?: Record<
    number,
    {
      status: string;
      message: string;
      error?: string;
      updatedAt: Date;
    }
  >;
}