/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { createLoggerWithPrefix } from 'log-management';
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app/app.module';

console.log('>>> ROOT LOG <<<');

async function bootstrap() {
  const logger = createLoggerWithPrefix('bibliography-service');

  // Create HTTP application
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const httpPort = 3003;

  // Create gRPC microservice
  const grpcPort = process.env.GRPC_PORT || 50051;
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'bibliography',
      protoPath: '/workspace/protos/bibliography.proto',
      url: `0.0.0.0:${grpcPort}`,
    },
  });

  await app.listen(httpPort);
  await app.startAllMicroservices();

  logger.info(
    `🚀 HTTP Application is running on: http://localhost:${httpPort}/${globalPrefix}`,
  );
  logger.info(`🚀 gRPC Service is running on: localhost:${grpcPort}`);
}

bootstrap();
