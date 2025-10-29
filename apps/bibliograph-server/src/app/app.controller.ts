import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { AppService } from './app.service';
import {
  CreateLibraryItemDto,
  DeleteLibraryItemDto,
  UpdateMarkdownDto
} from './dto';

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

  @Put('library-items/markdown')
  @HttpCode(HttpStatus.OK)
  async updateLibraryItemMarkdown(@Body() updateMarkdownDto: UpdateMarkdownDto) {
    return this.appService.updateLibraryItemMarkdown(updateMarkdownDto);
  }

  @Get('library-items/:id')
  async getLibraryItem(@Param('id') id: string) {
    return this.appService.getLibraryItem(id);
  }
}
