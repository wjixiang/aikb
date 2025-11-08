import { IsString, IsOptional, IsNumber } from 'class-validator';

export class PdfUploadUrlDto {
  @IsString()
  fileName!: string;

  @IsOptional()
  @IsNumber()
  expiresIn?: number; // Expiration time in seconds, default to 3600 (1 hour)
}

export class PdfUploadUrlResponseDto {
  @IsString()
  uploadUrl!: string;

  @IsString()
  s3Key!: string;

  @IsString()
  expiresAt!: string; // ISO string of expiration date
}