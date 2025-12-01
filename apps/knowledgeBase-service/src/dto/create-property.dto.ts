import { IsString, IsOptional } from 'class-validator';

export class CreatePropertyDto {
  @IsString()
  content: string;
}
