/**
 * bib-lib Server Example
 * This file demonstrates how to use bib-lib in a NestJS application
 */
import { NestFactory } from '@nestjs/core';
import { Module, Get, Controller } from '@nestjs/common';
import { PrismaModule, PrismaService } from './prisma/prisma.module.js';
import { SearchModule, SearchService } from './search/search.module.js';
import { ApiModule } from './api/api.module.js';

@Module({
  imports: [PrismaModule, SearchModule, ApiModule],
})
class AppModule {}

@Controller()
class AppController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async root() {
    return {
      message: 'bib-lib API Server',
      version: '1.0.0',
      endpoints: {
        search: '/api/search?query=your-query',
        suggestions: '/api/suggestions?query=your-query',
        facets: '/api/facets?query=your-query',
        export: '/api/export?query=your-query&format=bibtex',
        health: '/api/health',
      },
    };
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    bib-lib Server                           ║
╠══════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${port}                  ║
║                                                              ║
║  API Endpoints:                                             ║
║  - GET /api/search?query=...                                ║
║  - GET /api/suggestions?query=...                            ║
║  - GET /api/facets?query=...                                ║
║  - GET /api/export?query=...&format=bibtex                  ║
║  - GET /api/health                                          ║
╚══════════════════════════════════════════════════════════════╝
  `);
}

bootstrap();
