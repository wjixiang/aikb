# Markdown Part Storage System

This document describes the new markdown part storage system that provides real-time status updates and reliable storage for PDF processing parts.

## Overview

The markdown part storage system is designed to handle the storage of individual PDF parts as they are converted to markdown. It provides:

- Real-time status updates through message queues
- Reliable storage with retry mechanisms
- Automatic merging when all parts are completed
- Error handling and recovery

## Architecture

### Components

1. **MarkdownPartStorageWorker** - Handles storage requests for individual markdown parts
2. **Message Types** - Defines the communication protocol between workers
3. **RabbitMQ Service** - Provides message queue infrastructure
4. **MarkdownPartCache** - Provides storage and retrieval functionality

### Message Flow

```
PDF Conversion Worker
        ↓ (sends MARKDOWN_PART_STORAGE_REQUEST)
Markdown Part Storage Worker
        ↓ (stores in cache, sends progress updates)
Markdown Part Cache
        ↓ (when all parts complete, triggers merge)
PDF Merger Service
        ↓ (retrieves merged content)
Storage System
```

## Message Types

### MarkdownPartStorageRequestMessage
Sent by the PDF conversion worker to request storage of a markdown part.

```typescript
interface MarkdownPartStorageRequestMessage extends BaseRabbitMQMessage {
  eventType: 'MARKDOWN_PART_STORAGE_REQUEST';
  itemId: string;
  partIndex: number;
  totalParts: number;
  markdownContent: string;
  priority?: 'low' | 'normal' | 'high';
  retryCount?: number;
  maxRetries?: number;
  metadata?: {
    pageCount?: number;
    processingTime?: number;
    startPage?: number;
    endPage?: number;
  };
}
```

### MarkdownPartStorageProgressMessage
Sent by the storage worker to provide real-time progress updates.

```typescript
interface MarkdownPartStorageProgressMessage extends BaseRabbitMQMessage {
  eventType: 'MARKDOWN_PART_STORAGE_PROGRESS';
  itemId: string;
  partIndex: number;
  totalParts: number;
  status: PdfProcessingStatus;
  progress: number; // 0-100
  message?: string;
  error?: string;
  startedAt?: number;
  estimatedCompletion?: number;
}
```

### MarkdownPartStorageCompletedMessage
Sent when a markdown part has been successfully stored.

```typescript
interface MarkdownPartStorageCompletedMessage extends BaseRabbitMQMessage {
  eventType: 'MARKDOWN_PART_STORAGE_COMPLETED';
  itemId: string;
  partIndex: number;
  totalParts: number;
  status: PdfProcessingStatus.COMPLETED;
  processingTime: number;
  metadata?: {
    contentSize?: number;
    cachedAt?: number;
  };
}
```

### MarkdownPartStorageFailedMessage
Sent when storage of a markdown part fails.

```typescript
interface MarkdownPartStorageFailedMessage extends BaseRabbitMQMessage {
  eventType: 'MARKDOWN_PART_STORAGE_FAILED';
  itemId: string;
  partIndex: number;
  totalParts: number;
  status: PdfProcessingStatus.FAILED;
  error: string;
  errorCode?: string;
  retryCount: number;
  maxRetries: number;
  canRetry: boolean;
  processingTime: number;
}
```

## Usage

### Starting the Storage Worker

```typescript
import { createMarkdownPartStorageWorker } from './markdown-part-storage.worker';

// Create and start the worker
const worker = await createMarkdownPartStorageWorker();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await worker.stop();
  process.exit(0);
});
```

### Sending Storage Requests

```typescript
import { getRabbitMQService } from './rabbitmq.service';

const rabbitMQService = getRabbitMQService();

const storageRequest = {
  messageId: uuidv4(),
  timestamp: Date.now(),
  eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
  itemId: 'document-123',
  partIndex: 0,
  totalParts: 3,
  markdownContent: '# Chapter 1\n\nContent...',
  priority: 'normal',
  retryCount: 0,
  maxRetries: 3,
};

await rabbitMQService.publishMarkdownPartStorageRequest(storageRequest);
```

### Monitoring Progress

```typescript
import { getRabbitMQService } from './rabbitmq.service';

const rabbitMQService = getRabbitMQService();

// Listen to progress messages
await rabbitMQService.consumeMessages(
  'markdown-part-storage-progress',
  (message) => {
    console.log(`Progress: ${message.progress}% - ${message.message}`);
  }
);
```

## Configuration

### RabbitMQ Queues

- `markdown-part-storage-request` - Incoming storage requests
- `markdown-part-storage-progress` - Progress updates
- `markdown-part-storage-completed` - Completion notifications
- `markdown-part-storage-failed` - Failure notifications

### Retry Configuration

The system automatically retries failed storage operations:

- Default max retries: 3
- Retry count is tracked in the message
- Failed messages are moved to dead letter queue after max retries

## Error Handling

### Storage Errors

When storage fails, the worker:

1. Logs the error with full context
2. Updates the part status to 'failed'
3. Sends a failure message
4. Retries if retry count < max retries

### Cache Errors

If the cache is unavailable, the worker:

1. Logs the error
2. Continues processing other parts
3. Retries the failed part

## Integration with Existing System

### PDF Conversion Worker Changes

The PDF conversion worker now sends `MarkdownPartStorageRequestMessage` instead of storing directly:

```typescript
// Old approach
await this.markdownPartCache.storePartMarkdown(itemId, partIndex, markdownContent);

// New approach
await this.sendMarkdownPartStorageRequest(itemId, partIndex, totalParts, markdownContent);
```

### PDF Merger Service Changes

The PDF merger service now retrieves merged content from the cache:

```typescript
// New approach with fallback
try {
  mergedMarkdown = await this.markdownPartCache.mergeAllParts(message.itemId);
} catch (cacheError) {
  // Fallback to original storage
  const markdownContent = await this.storage.getMarkdown(message.itemId);
  mergedMarkdown = await this.mergeMarkdownContent(markdownContent, message.itemId);
}
```

## Testing

### Integration Tests

Run the integration tests to verify the complete workflow:

```bash
npx tsx knowledgeBase/lib/rabbitmq/markdown-part-storage.integration.test.ts
```

### Test Coverage

The integration tests cover:

1. Complete storage workflow
2. Message flow between workers
3. Error handling and retry logic
4. Merging functionality
5. Cleanup operations

## Monitoring and Logging

### Log Messages

The system provides detailed logging at each step:

- Storage request received
- Progress updates (10%, 20%, ..., 90%)
- Storage completion
- Error conditions
- Retry attempts

### Metrics

Track the following metrics:

- Storage request processing time
- Success/failure rates
- Retry counts
- Queue depths
- Cache hit/miss ratios

## Troubleshooting

### Common Issues

1. **Worker not starting**: Check RabbitMQ connection and queue configuration
2. **Storage failures**: Verify cache connectivity and permissions
3. **Merging issues**: Check that all parts are completed before merging
4. **Message delays**: Monitor queue depths and worker performance

### Debug Commands

```bash
# Check queue status
npx tsx -e "
import { getRabbitMQService } from './knowledgeBase/lib/rabbitmq/rabbitmq.service';
const service = getRabbitMQService();
service.getQueueInfo('markdown-part-storage-request').then(console.log);
"

# Purge a queue (use with caution)
npx tsx -e "
import { getRabbitMQService } from './knowledgeBase/lib/rabbitmq/rabbitmq.service';
const service = getRabbitMQService();
service.purgeQueue('markdown-part-storage-request');
"
```

## Future Enhancements

1. **Batch Processing**: Support for storing multiple parts in a single operation
2. **Compression**: Compress markdown content before storage
3. **Deduplication**: Avoid storing duplicate content
4. **Priority Queues**: Support for high-priority documents
5. **Metrics Dashboard**: Real-time monitoring interface