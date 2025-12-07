import { Module } from '@nestjs/common';
import { VectorService } from './vector.service';
import { ChunkEmbedService } from './chunk-embed.service';
import { ChunkEmbedController } from './chunk-embed.controller';
import { VectorGrpcController } from './vector.grpc.controller';
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
  controllers: [ChunkEmbedController, VectorGrpcController],
  providers: [VectorService, ChunkEmbedService, BibliographyGrpcClient],
  exports: [VectorService, ChunkEmbedService],
})
export class VectorModule {}