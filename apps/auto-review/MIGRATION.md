# NestJS to Fastify Migration

## Overview

The `auto-review` application has been migrated from NestJS (CommonJS) to Fastify (ESM).

## Changes

### Dependencies
- **Removed**: All NestJS packages (`@nestjs/*`, `ts-node`, etc.)
- **Added**: Fastify packages (`fastify`, `@fastify/cors`, `@fastify/multipart`, `@fastify/swagger`, `@fastify/swagger-ui`)

### Module System
- Changed from `commonjs` to `ESNext` in tsconfig.json
- Added `"type": "module"` to package.json
- Uses dynamic imports for CJS modules (Prisma, BAML)

### Architecture
- **Removed**: NestJS decorators (`@Injectable`, `@Controller`, `@Module`)
- **Removed**: NestJS dependency injection
- **Added**: Simple dependency injection container using closures (`src/di/index.ts`)
- **Added**: New route handlers using Fastify syntax

### File Structure

```
src/
├── index.ts                    # New Fastify entry point
├── config.ts                   # Environment configuration
├── di/
│   └── index.ts              # Dependency injection container
├── app/
│   ├── routes.ts              # New (replaces app.controller)
│   ├── app.service.ts         # Migrated (removed @Injectable)
│   ├── app.dto.ts            # No changes
│   ├── baml/
│   │   ├── baml.service.ts    # Migrated (removed @Injectable)
│   │   └── index.ts         # New exports
│   └── task.ts               # Migrated (removed @Injectable)
├── search/
│   ├── routes.ts              # New (replaces search.controller)
│   ├── search.service.ts      # Migrated (removed @Injectable)
│   └── dto/
│       └── search.dto.ts      # No changes
├── article-analysis/
│   ├── routes.ts              # New (replaces article-analysis.controller)
│   ├── article-analysis.service.ts  # Migrated (removed @Injectable)
├── literature-summary/
│   ├── routes.ts              # New (replaces literature-summary.controller)
│   └── literature-summary.service.ts  # Migrated (removed @Injectable)
├── prisma/
│   ├── routes.ts              # New (replaces article-analysis.controller)
│   ├── article-analysis.service.ts  # Migrated (removed @Injectable)
├── prisma/
│   ├── prisma.service.ts      # Migrated (removed @Injectable, lifecycle hooks)
│   └── index.ts             # New exports
└── utils/
    ├── logger.ts             # New (replaces NestJS Logger)
    ├── validation.ts         # New (zod-based validation)
    └── error-handler.ts      # New (error handling utilities)
```

### Deleted Files
- `nest-cli.json`
- `src/main.ts` (replaced by `src/index.ts`)
- `src/app/app.module.ts`
- `src/app/app.controller.ts`
- `src/search/search.module.ts`
- `src/search/search.controller.ts`
- `src/article-analysis/article-analysis.module.ts`
- `src/article-analysis/article-analysis.controller.ts`
- `src/literature-summary/literature-summary.module.ts`
- `src/literature-summary/literature-summary.controller.ts`
- `src/app/baml/baml.module.ts`
- `src/prisma/prisma.module.ts`
- All `*.spec.ts` files (NestJS tests - need rewriting)

## Running the Application

### Development
```bash
cd apps/auto-review
pnpm install
pnpm start:dev
```

### Production
```bash
cd apps/auto-review
pnpm build
pnpm start
```

### Testing Endpoints

The following endpoints are available:

- `POST /app/review` - Create review task
- `POST /app/progress` - Check task progress
- `GET /search/pubmed` - PubMed search
- `GET /search/pubmed/:pmid` - Article detail
- `POST /article-analysis/extract/url` - Extract PDF from URL
- `POST /article-analysis/extract/file` - Extract PDF from uploaded file
- `GET /article-analysis/task/:taskId` - Get task result
- `GET /article-analysis/validate-token` - Validate MinerU token
- `POST /literature-summary/summarize` - Summarize paper
- `POST /literature-summary/extract-pico` - Extract PICO
- `POST /literature-summary/summarize-batch` - Batch summarize

Swagger UI is available at `http://localhost:3000/docs`

## Environment Variables

The following environment variables are required:

- `DATABASE_URL` - PostgreSQL connection string
- `MINIMAX_API_KEY` - LLM API key for literature summary
- `MINERU_TOKEN` - MinerU API token (optional, for Precision API)

Optional variables:

- `PORT` - Server port (default: 3000)
- `CORS_ORIGIN` - CORS origin(s)
- `UPLOADS_DIR` - File upload directory (default: ./uploads)
- `SWAGGER_ENABLED` - Enable/disable Swagger UI (default: true)

## Notes

### CJS Interop
Prisma and BAML clients use dynamic imports:
```typescript
const prismaModule = await import('generated/prisma/index.js');
const { PrismaClient } = prismaModule;
```

### Logger
Replaced NestJS Logger with a simple console-based logger:
```typescript
import { Logger } from './utils/logger.js';
const logger = new Logger('MyClass');
logger.log('Message');
```

### Validation
Uses zod for schema validation:
```typescript
import { validateBody, reviewRequestSchema } from './utils/validation.js';
const body = validateBody(reviewRequestSchema, request.body);
```

### File Uploads
Uses `@fastify/multipart` instead of multer. The multipart plugin is configured with file size limits and custom storage location.

## Testing

Tests were removed during migration (NestJS-specific). New tests will need to be written for the Fastify-based application using vitest.

## Future Improvements

1. Rewrite tests using Fastify test utilities
2. Consider upgrading Prisma to support ESM output natively
3. Add request/response middleware for logging
4. Implement rate limiting
5. Add request validation middleware
