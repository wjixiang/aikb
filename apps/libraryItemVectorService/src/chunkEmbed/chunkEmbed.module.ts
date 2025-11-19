import { Module } from '@nestjs/common';
import { ChunkEmbedController } from './chunkEmbed.controller';
import { ChunkEmbedService } from './chunkEmbed.service';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { BibliographyGrpcClient } from 'proto-ts';

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
  controllers: [ChunkEmbedController],
  providers: [ChunkEmbedService, BibliographyGrpcClient],
})
export class ChunkEmbedModule {}
