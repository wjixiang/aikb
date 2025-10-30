import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Req
} from '@nestjs/common';
import express from 'express';
import { AppService } from './app.service';
import {
  CreateLibraryItemDto,
  DeleteLibraryItemDto,
  UpdateMarkdownDto
} from '@aikb/library-shared';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('library-items')
  async createLibraryItem(@Body() createLibraryItemDto: CreateLibraryItemDto) {
    return this.appService.forwardToMetadataService('POST', 'library-items', createLibraryItemDto);
  }

  @Delete('library-items')
  @HttpCode(HttpStatus.OK)
  async deleteLibraryItem(@Body() deleteLibraryItemDto: DeleteLibraryItemDto) {
    return this.appService.forwardToMetadataService('DELETE', 'library-items', deleteLibraryItemDto);
  }

  @Put('library-items/markdown')
  @HttpCode(HttpStatus.OK)
  async updateLibraryItemMarkdown(@Body() updateMarkdownDto: UpdateMarkdownDto) {
    return this.appService.forwardToContentService('PUT', 'library-items/markdown', updateMarkdownDto);
  }

  @Get('library-items/:id')
  async getLibraryItem(@Param('id') id: string) {
    return this.appService.forwardToMetadataService('GET', `library-items/${id}`);
  }

  @Get('library-items/:id/markdown')
  async getLibraryItemMarkdown(@Param('id') id: string) {
    return this.appService.forwardToContentService('GET', `library-items/${id}/markdown`);
  }

  @Post('library-items/upload')
  async uploadPdf(@Body() uploadData: { fileName: string; fileData: string }) {
    return this.appService.forwardToStorageService('POST', 'library-items/upload', uploadData);
  }

  @Get('library-items/:id/download')
  async downloadPdf(@Param('id') id: string, @Res() res: express.Response) {
    return this.appService.forwardToStorageService('GET', `library-items/${id}/download`, null, res);
  }

  @Get('library-items/:id/download-url')
  async getDownloadUrl(@Param('id') id: string) {
    return this.appService.forwardToStorageService('GET', `library-items/${id}/download-url`);
  }
}
