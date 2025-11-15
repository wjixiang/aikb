import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  Logger.log('Starting PDF2MD service bootstrap...');

  const app = await NestFactory.create(AppModule);

  Logger.log('Application created, starting to listen...');
  await app.listen(3001);

  Logger.log(
    `🚀 PDF2MD Service is running on port 3001 and listening for RabbitMQ messages`,
  );
}

bootstrap();
