import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  logger.log('Starting Auth Service...');
  
  const port = process.env.PORT || 3000;
  
  try {
    const app = await NestFactory.create(AppModule);
    
    // Enable CORS
    app.enableCors({
      origin: true,
      credentials: true,
    });
    
    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    
    await app.listen(port);
    logger.log(`Auth Service started successfully on port ${port}`);
  } catch (error) {
    logger.error('Failed to start Auth Service:', error);
    throw error;
  }
}

bootstrap();
