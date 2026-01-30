import { IsString } from 'class-validator';

export class UpdateMarkdownDto {
  @IsString()
  id!: string;

  @IsString()
  markdownContent!: string;
}
