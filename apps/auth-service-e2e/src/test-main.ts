import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { TestAuthLibModule } from './support/test-auth-lib.module';

async function bootstrap() {
  const logger = new Logger('TestBootstrap');
  logger.log('Starting Test Auth Service...');
  
  const port = process.env.PORT || 3001; // Use different port for tests
  
  try {
    const app = await NestFactory.create(TestAuthLibModule);
    
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
    logger.log(`Test Auth Service started successfully on port ${port}`);
    
    // Keep the process running
    process.on('SIGINT', async () => {
      logger.log('Shutting down test service...');
      await app.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start Test Auth Service:', error);
    throw error;
  }
}

bootstrap();