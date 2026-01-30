import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Pdf2MdGrpcController } from '../grpc/pdf2md.grpc.controller';
import { BibliographyGrpcClient } from '../grpc/bibliography.grpc.client';

@Module({
  imports: [
    RabbitMQModule.forRoot({
      exchanges: [
        {
          name: 'library',
          type: 'topic',
        },
      ],
      uri: `amqp://${process.env['RABBITMQ_USERNAME']}:${process.env['RABBITMQ_PASSWORD']}@${process.env['RABBITMQ_HOSTNAME']}:${process.env['RABBITMQ_AMQP_PORT']}/${process.env['RABBITMQ_VHOST']}`,
      connectionInitOptions: {
        timeout: 30000,
      },
      enableControllerDiscovery: true,
    }),
  ],
  controllers: [AppController, Pdf2MdGrpcController],
  providers: [AppService, BibliographyGrpcClient],
})
export class AppModule {}
