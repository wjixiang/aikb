import { IsString, IsEnum, IsOptional } from 'class-validator';

export class CreateEdgeDto {
  @IsString()
  in: string;

  @IsString()
  out: string;

  @IsEnum(['start', 'middle', 'end'])
  type: 'start' | 'middle' | 'end';
}