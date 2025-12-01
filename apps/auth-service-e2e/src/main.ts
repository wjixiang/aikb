import { NestFactory } from '@nestjs/core';
import { TestAppModule } from './support/test-app.module';

async function bootstrap() {
  const app = await NestFactory.create(TestAppModule);
  app.enableCors({ origin: true, credentials: true });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`Test Auth Service started successfully on port ${port}`);
}

bootstrap();
