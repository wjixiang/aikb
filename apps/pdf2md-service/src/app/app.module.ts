import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'pdf_2_markdown_service',
        transport: Transport.RMQ,
        options: {
          urls: [
            `amqp://${process.env['RABBITMQ_USERNAME']}:${process.env['RABBITMQ_PASSWORD']}@${process.env['RABBITMQ_HOSTNAME']}:${process.env['RABBITMQ_AMQP_PORT']}/${process.env['RABBITMQ_VHOST']}`,
          ],
          queue: 'pdf_2_markdown_queue'
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
