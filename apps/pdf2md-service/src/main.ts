/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { Transport } from '@nestjs/microservices';

async function bootstrap() {
  Logger.log('Starting PDF2MD microservice bootstrap...');

  const app = await NestFactory.createMicroservice(AppModule, {
    name: 'pdf_2_markdown_service',
    transport: Transport.RMQ,
    options: {
      urls: [
        `amqp://${process.env['RABBITMQ_USERNAME']}:${process.env['RABBITMQ_PASSWORD']}@${process.env['RABBITMQ_HOSTNAME']}:${process.env['RABBITMQ_AMQP_PORT']}/${process.env['RABBITMQ_VHOST']}`,
      ],
      queue: 'pdf_2_markdown_queue',
    },
  });

  Logger.log('Microservice created, starting to listen...');
  await app.listen();

  Logger.log(
    `🚀 RMQ: amqp://${process.env['RABBITMQ_USERNAME']}:${process.env['RABBITMQ_PASSWORD']}@${process.env['RABBITMQ_HOSTNAME']}:${process.env['RABBITMQ_AMQP_PORT']}/${process.env['RABBITMQ_VHOST']}`,
  );
}

bootstrap();
