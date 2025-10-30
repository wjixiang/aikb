import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { AppService } from './app.service';
import {
  CreateLibraryItemDto,
  DeleteLibraryItemDto
} from '@aikb/library-shared';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('library-items')
  async createLibraryItem(@Body() createLibraryItemDto: CreateLibraryItemDto) {
    return this.appService.createLibraryItem(createLibraryItemDto);
  }

  @Delete('library-items')
  @HttpCode(HttpStatus.OK)
  async deleteLibraryItem(@Body() deleteLibraryItemDto: DeleteLibraryItemDto) {
    return this.appService.deleteLibraryItem(deleteLibraryItemDto);
  }

  @Get('library-items/:id')
  async getLibraryItem(@Param('id') id: string) {
    return this.appService.getLibraryItem(id);
  }
}
