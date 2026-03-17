import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module.js';
import { ValidationPipe } from './common/pipes/validation.pipe.js';
import { HttpExceptionFilter, AllExceptionsFilter } from './common/filters/http-exception.filter.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security middleware
  app.use(helmet());
  app.use(compression());

  // CORS configuration
  app.enableCors({
    origin: process.env['CORS_ORIGIN']?.split(',') || '*',
    credentials: process.env['CORS_CREDENTIALS'] === 'true',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Global pipes
  app.useGlobalPipes(new ValidationPipe());

  // Global filters
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Case Hub API')
    .setDescription('病历管理 API - 提供病历生成、存储、查询和管理功能')
    .setVersion('1.0.0')
    .addTag('cases', '病历管理')
    .addTag('generator', '病历生成')
    .addTag('storage', '存储管理')
    .addTag('health', '健康检查')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Start server
  const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3002;
  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}/api`);
  console.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
