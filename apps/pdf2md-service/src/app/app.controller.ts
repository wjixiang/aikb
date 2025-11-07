import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { EventPattern, Payload } from '@nestjs/microservices';
import { Pdf2MArkdownDto } from 'library-shared';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @EventPattern('pdf-2-markdown-conversion')
  handlePdf2MdRequest(@Payload() data: Pdf2MArkdownDto) {
    console.log('Controller received pdf conversion request', data);
    return this.appService.handlePdf2MdRequest(data);
  }
}
