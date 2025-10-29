import { IsString } from 'class-validator';

export class DeleteLibraryItemDto {
  @IsString()
  id: string;
}