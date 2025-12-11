import { Controller } from '@nestjs/common';
import { AppService } from './app.service';
import { RabbitRPC } from '@golevelup/nestjs-rabbitmq';
import { Pdf2MArkdownDto } from 'llm-shared/';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @RabbitRPC({
    exchange: 'library',
    routingKey: 'item.pdf2md',
    queue: 'pdf2md-service-queue',
  })
  handlePdf2MdRequest(data: Pdf2MArkdownDto) {
    console.log('Controller received pdf conversion request', data);
    return this.appService.handlePdf2MdRequest(data);
  }
}
