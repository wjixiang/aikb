# EmbeddingModule

A NestJS module that provides embedding functionality using the embedding library. This module wraps the embedding library and provides a clean, NestJS-compatible interface for generating text embeddings.

## Features

- Support for multiple embedding providers (OpenAI, Alibaba, ONNX)
- Single and batch embedding generation
- Provider management and switching
- Health checks and monitoring
- Statistics tracking
- Configuration management
- Comprehensive API with Swagger documentation
- Full unit test coverage

## Installation

```bash
npm install @nestjs/config @nestjs/common @nestjs/swagger
```

## Usage

### 1. Import the Module

```typescript
import { Module } from '@nestjs/common';
import { EmbeddingModule } from '@aikb/embedding-module';

@Module({
  imports: [
    EmbeddingModule,
  ],
})
export class AppModule {}
```

### 2. Configure Environment Variables

The module supports configuration through both NestJS ConfigService and direct environment variables:

```env
# Default embedding provider (openai, alibaba, onnx)
EMBEDDING_DEFAULT_PROVIDER=alibaba

# Default concurrency limit for batch operations
EMBEDDING_DEFAULT_CONCURRENCY_LIMIT=5

# Enable/disable health checks
EMBEDDING_ENABLE_HEALTH_CHECK=true

# Health check interval in milliseconds
EMBEDDING_HEALTH_CHECK_INTERVAL=30000

# Provider-specific credentials
EMBEDDING_API_KEY=your_openai_api_key
EMBEDDING_API_BASE=https://api.openai.com/v1/
ALIBABA_API_KEY=your_alibaba_api_key
```

The `getDefaultConfig()` method in EmbeddingService automatically reads these environment variables and provides fallback to default values when configuration is not available through NestJS ConfigService.

### 3. Inject and Use the Service

```typescript
import { Controller, Get, Post, Body } from '@nestjs/common';
import { EmbeddingService } from '@aikb/embedding-module';
import { EmbeddingProvider } from 'embedding';

@Controller('my-controller')
export class MyController {
  constructor(private readonly embeddingService: EmbeddingService) {}

  @Post('embed')
  async embedText(@Body('text') text: string) {
    const result = await this.embeddingService.embed({
      text,
      provider: EmbeddingProvider.ALIBABA,
    });
    
    if (result.success) {
      return { embedding: result.embedding };
    } else {
      return { error: result.error };
    }
  }

  @Post('embed-batch')
  async embedBatch(@Body('texts') texts: string[]) {
    const result = await this.embeddingService.embedBatch({
      texts,
      provider: EmbeddingProvider.ALIBABA,
      concurrencyLimit: 3,
    });
    
    return result;
  }

  @Get('providers')
  getProviders() {
    return this.embeddingService.getProviderInfo();
  }

  @Post('switch-provider')
  switchProvider(@Body('provider') provider: EmbeddingProvider) {
    const success = this.embeddingService.setProvider(provider);
    return { success, provider };
  }

  @Get('health')
  async health() {
    return this.embeddingService.healthCheck();
  }

  @Get('stats')
  getStats() {
    return this.embeddingService.getStats();
  }
}
```

## API Endpoints

The module provides the following HTTP endpoints when the controller is included:

### POST /embedding/embed
Generate embedding for text(s).

**Request Body:**
```json
{
  "text": "Your text here" or ["text1", "text2"],
  "provider": "alibaba" // optional, defaults to configured provider
}
```

**Response:**
```json
{
  "success": true,
  "embedding": [0.1, 0.2, 0.3, ...],
  "provider": "alibaba"
}
```

### POST /embedding/embed-batch
Generate embeddings for multiple texts.

**Request Body:**
```json
{
  "texts": ["text1", "text2", "text3"],
  "provider": "alibaba", // optional
  "concurrencyLimit": 5 // optional, defaults to 5
}
```

**Response:**
```json
{
  "success": true,
  "embeddings": [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]],
  "provider": "alibaba",
  "totalCount": 3,
  "successCount": 3,
  "failureCount": 0
}
```

### GET /embedding/providers
Get information about available providers.

**Response:**
```json
[
  {
    "provider": "alibaba",
    "available": true,
    "initialized": true
  },
  {
    "provider": "openai",
    "available": false,
    "initialized": false
  }
]
```

### GET /embedding/provider/current
Get the currently active provider.

**Response:**
```json
{
  "provider": "alibaba"
}
```

### POST /embedding/provider/set?provider=alibaba
Set the active provider.

**Response:**
```json
{
  "success": true,
  "message": "Provider set to alibaba successfully"
}
```

### GET /embedding/health
Check the health of the embedding service.

**Response:**
```json
{
  "status": "healthy",
  "providers": [...],
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

### GET /embedding/stats
Get embedding service statistics.

**Response:**
```json
{
  "totalRequests": 100,
  "successfulRequests": 95,
  "failedRequests": 5,
  "averageResponseTime": 150,
  "providerStats": {
    "alibaba": {
      "requests": 80,
      "successes": 78,
      "failures": 2,
      "averageResponseTime": 140
    }
  }
}
```

### POST /embedding/stats/reset
Reset embedding service statistics.

**Response:**
```json
{
  "success": true,
  "message": "Statistics reset successfully"
}
```

## Configuration

The module can be configured through environment variables or by providing a custom configuration:

```typescript
import { Module } from '@nestjs/common';
import { EmbeddingModule, defaultEmbeddingModuleConfig } from '@aikb/embedding-module';

@Module({
  imports: [
    EmbeddingModule.forRoot({
      ...defaultEmbeddingModuleConfig,
      defaultProvider: EmbeddingProvider.OPENAI,
      defaultConcurrencyLimit: 10,
      enableHealthCheck: false,
    }),
  ],
})
export class AppModule {}
```

## Testing

Run the unit tests:

```bash
nx test EmbeddingModule
```

## Architecture

The module follows NestJS best practices:

- **Dependency Injection**: Uses NestJS's DI system for configuration and services
- **Modular Design**: Separated concerns into services, controllers, DTOs, and configuration
- **Validation**: Uses class-validator for request validation
- **Documentation**: Full Swagger/OpenAPI documentation
- **Error Handling**: Comprehensive error handling and logging
- **Testing**: Full unit test coverage
- **Configuration**: Flexible configuration through environment variables

## Dependencies

- `@nestjs/common`: Core NestJS framework
- `@nestjs/config`: Configuration management
- `@nestjs/swagger`: API documentation
- `embedding`: The underlying embedding library
- `class-validator`: Request validation
- `log-management`: Logging utilities

## License

This module is part of the AIKB project and follows the same license terms.
