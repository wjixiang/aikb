import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Res
} from '@nestjs/common';
import express from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('library-items/upload')
  async uploadPdf(@Body() uploadData: { fileName: string; fileData: string }) {
    return this.appService.uploadPdf(uploadData.fileName, Buffer.from(uploadData.fileData, 'base64'));
  }

  @Get('library-items/:id/download')
  async downloadPdf(@Param('id') id: string, @Res() res: express.Response) {
    const pdfBuffer = await this.appService.getPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  }

  @Get('library-items/:id/download-url')
  async getDownloadUrl(@Param('id') id: string) {
    return this.appService.getPdfDownloadUrl(id);
  }
}
