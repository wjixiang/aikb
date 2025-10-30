import {
  Controller,
  Put,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { AppService } from './app.service';
import { UpdateMarkdownDto } from '@aikb/library-shared';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Put('library-items/markdown')
  @HttpCode(HttpStatus.OK)
  async updateLibraryItemMarkdown(@Body() updateMarkdownDto: UpdateMarkdownDto) {
    return this.appService.updateLibraryItemMarkdown(updateMarkdownDto);
  }

  @Get('library-items/:id/markdown')
  async getLibraryItemMarkdown(@Param('id') id: string) {
    return this.appService.getLibraryItemMarkdown(id);
  }
}
