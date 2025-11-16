import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app/app.module';

async function bootstrap() {
  Logger.log('Starting PDF2MD service bootstrap...');

  const app = await NestFactory.create(AppModule);

  // Create gRPC microservice
  const grpcPort = process.env['GRPC_PORT'] || 50052;
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'pdf2md',
      protoPath: join(__dirname, '../proto/pdf2md.proto'),
      url: `0.0.0.0:${grpcPort}`,
    },
  });

  Logger.log('Application created, starting to listen...');
  await app.listen(3001);
  await app.startAllMicroservices();

  Logger.log(
    `🚀 PDF2MD Service is running on port 3001 and listening for RabbitMQ messages`,
  );
  Logger.log(
    `🚀 gRPC Service is running on: localhost:${grpcPort}`,
  );
}

bootstrap();
