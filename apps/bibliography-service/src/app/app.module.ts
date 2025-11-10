import { Module } from '@nestjs/common';
import { LibraryItemController } from './library-item.controller';
import { LibraryItemService } from './library-item.service';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'PDF_2_MARKDOWN_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [
            `amqp://${process.env['RABBITMQ_USERNAME']}:${process.env['RABBITMQ_PASSWORD']}@${process.env['RABBITMQ_HOSTNAME']}:${process.env['RABBITMQ_AMQP_PORT']}/${process.env['RABBITMQ_VHOST']}`,
          ],
          queue: process.env['RABBITMQ_QUEUE'] || 'pdf_2_markdown_queue',
          connectionInitOptions: { timeout: 30000 },
          heartbeat: 60,
          prefetchCount: 1,
        },
      },
    ]),
  ],
  controllers: [LibraryItemController],
  providers: [LibraryItemService],
})
export class AppModule {}
