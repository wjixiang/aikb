import { IsEnum, IsOptional, IsString, IsNumber } from 'class-validator';
import { PdfProcessingStatus } from '@aikb/bibliography';

export class UpdateProcessingStatusDto {
  @IsEnum(PdfProcessingStatus)
  status!: PdfProcessingStatus;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsNumber()
  progress?: number;

  @IsOptional()
  @IsString()
  error?: string;
}