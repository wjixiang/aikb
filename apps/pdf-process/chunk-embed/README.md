# Chunk-Embed Microservice

A standalone microservice for handling PDF chunking and embedding operations. This service processes PDF documents by breaking them into chunks and generating embeddings for semantic search and retrieval.

## Overview

The Chunk-Embed microservice is responsible for:
- Processing chunking and embedding requests from RabbitMQ queues
- Converting PDF content into manageable chunks
- Generating vector embeddings for each chunk
- Publishing progress updates and completion status
- Handling retry logic and error recovery

## Architecture

The service is built with the following components:
- **ChunkingEmbeddingWorker**: Main worker class that orchestrates the processing
- **ChunkingEmbeddingProcessor**: Handles the actual chunking and embedding logic
- **Message Services**: Supports both AMQP and STOMP protocols for message communication
- **Storage Integration**: Works with Elasticsearch and S3 for data persistence

## Installation

```bash
# Install dependencies
pnpm install

# Build the service
nx build chunk-embed
```

## Configuration

The service requires the following environment variables:

- `RABBITMQ_URL`: RabbitMQ connection URL (default: `amqp://localhost:5672`)
- `ELASTICSEARCH_URL`: Elasticsearch connection URL (default: `http://localhost:9200`)
- `AWS_ACCESS_KEY_ID`: AWS access key for S3 operations
- `AWS_SECRET_ACCESS_KEY`: AWS secret key for S3 operations
- `AWS_REGION`: AWS region (default: `us-east-1`)
- `S3_BUCKET`: S3 bucket name for PDF storage

## Usage

### Running the Service

```bash
# Development mode (with TypeScript)
nx serve chunk-embed

# Production mode (after building)
nx start chunk-embed

# Or directly with node
node dist/apps/pdf-process/chunk-embed/src/main.js
```

### As a Library

```typescript
import { createChunkingEmbeddingWorker, S3ElasticSearchLibraryStorage } from '@aikb/chunk-embed';

// Create storage instance
const storage = new S3ElasticSearchLibraryStorage('http://localhost:9200', 1024);

// Create and start worker
const worker = await createChunkingEmbeddingWorker(storage);

// Stop when done
await worker.stop();
```

## Message Types

The service processes the following message types:

- **CHUNKING_EMBEDDING_REQUEST**: Request to process a PDF for chunking and embedding
- **CHUNKING_EMBEDDING_PROGRESS**: Progress updates during processing
- **CHUNKING_EMBEDDING_COMPLETED**: Notification when processing is complete
- **CHUNKING_EMBEDDING_FAILED**: Error notification if processing fails

## Development

### Building

Run `nx build chunk-embed` to build the library.

### Running unit tests

Run `nx test chunk-embed` to execute the unit tests via [Vitest](https://vitest.dev/).

### Linting

Run `nx lint chunk-embed` to lint the files.

## Dependencies

- **@aikb/bibliography**: Library storage and management
- **@aikb/chunking**: Document chunking strategies
- **@aikb/embedding**: Vector embedding generation
- **@aikb/log-management**: Structured logging
- **amqplib**: AMQP client for RabbitMQ
- **@stomp/stompjs**: STOMP client for WebSocket messaging
- **uuid**: Unique identifier generation

## License

This project is part of the AI Knowledge Base system.
