import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { Transport } from '@nestjs/microservices';

async function bootstrap() {
  Logger.log('Starting libraryItemVectorService microservice bootstrap...');

  const grpcPort = process.env.GRPC_PORT || 50053;
  const app = await NestFactory.createMicroservice(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: 'libraryItemVector',
      protoPath: '/workspace/protos/libraryItemVector.proto',
      url: `0.0.0.0:${grpcPort}`,
    },
  });

  Logger.log('Microservice created, starting to listen...');
  await app.listen();

  // Logger.log(
  //   `🚀 RMQ: amqp://${process.env['RABBITMQ_USERNAME']}:${process.env['RABBITMQ_PASSWORD']}@${process.env['RABBITMQ_HOSTNAME']}:${process.env['RABBITMQ_AMQP_PORT']}/${process.env['RABBITMQ_VHOST']}`,
  // );
}

bootstrap();
// /workspace/protos/libraryItemVector.proto
