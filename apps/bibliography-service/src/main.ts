/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { createLoggerWithPrefix } from '@aikb/log-management';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

console.log('>>> ROOT LOG <<<');

async function bootstrap() {
  const logger = createLoggerWithPrefix('bibliography-service')
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.info(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
