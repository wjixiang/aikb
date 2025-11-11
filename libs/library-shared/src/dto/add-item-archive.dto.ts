import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';

export class AddItemArchiveDto {
  @IsEnum(['pdf'])
  fileType!: 'pdf';

  @IsNumber()
  fileSize!: number;

  @IsString()
  fileHash!: string;

  @IsString()
  s3Key!: string;

  @IsNumber()
  pageCount!: number; // Required for PDF files

  @IsOptional()
  @IsNumber()
  wordCount?: number;
}
