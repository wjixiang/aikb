# Kafka Integration for Knowledge Base

This directory contains the Kafka integration implementation for the knowledge base project. It provides event-driven architecture for processing entity data through three main storage types: content, graph, and vector.

## Architecture Overview

The Kafka integration follows an event-driven architecture where:

1. **Producers** publish events when entities are created, updated, or deleted
2. **Consumers** subscribe to specific topics and process events asynchronously
3. **Processors** handle the actual storage operations for different data types

## Components

### Core Services

- **KafkaProducerService**: Handles publishing events to Kafka topics
- **KafkaConsumerService**: Manages consuming events from Kafka topics
- **KafkaEntityStorage**: Proxy implementation that publishes events instead of direct storage
- **KafkaService**: Main service that orchestrates producers and consumers

### Processors

- **EntityContentProcessor**: Handles entity content storage operations
- **EntityGraphProcessor**: Handles entity relationship storage operations
- **EntityVectorProcessor**: Handles entity vector storage operations

### Configuration

- **KafkaConfig**: Configuration management for different environments
- **KafkaTypes**: TypeScript type definitions for all Kafka-related structures

## Setup

### 1. Environment Configuration

Copy `.env.example` to `.env` and configure your Kafka settings:

```bash
cp .env.example .env
```

Key environment variables:

```env
KAFKA_ENABLED=true
KAFKA_BROKERS=kafka:9092
KAFKA_SSL=false
KAFKA_SASL_MECHANISM=
KAFKA_SASL_USERNAME=
KAFKA_SASL_PASSWORD=
```

### 2. Docker Kafka Setup

If you're using Docker for Kafka, ensure your Kafka container is running and accessible.

### 3. Initialize Kafka Service

```typescript
import { initializeAndStartKafkaService } from './knowledgeBase/kafka';

// Initialize with your storage implementations
const kafkaService = await initializeAndStartKafkaService(
  entityContentStorage,
  entityGraphStorage,
  entityVectorStorage
);
```

## Usage

### Creating an Entity with Kafka

```typescript
import { getKafkaService } from './knowledgeBase/kafka';

const kafkaService = getKafkaService();
const entityStorage = kafkaService?.getEntityStorage();

if (entityStorage) {
  const entity = await entityStorage.create_new_entity({
    name: ['Example Entity'],
    tags: ['example', 'test'],
    definition: 'This is an example entity'
  });
  
  console.log('Entity created with ID:', entity.id);
}
```

### Creating Entity Relations

```typescript
await entityStorage.create_entity_relation(
  'entity1-id',
  'entity2-id',
  'related_to',
  { strength: 0.8 }
);
```

### Generating Entity Vectors

```typescript
const vector = await embeddingService.embed('Entity definition text');
await entityStorage.generate_entity_vector(
  'entity-id',
  vector,
  { model: 'text-embedding-ada-002' }
);
```

## Event Flow

1. **Entity Creation**:
   - Client calls `entityStorage.create_new_entity()`
   - Event is published to `entity-events` topic
   - EntityContentProcessor consumes and stores the entity content

2. **Relation Creation**:
   - Client calls `entityStorage.create_entity_relation()`
   - Event is published to `entity-relation-processing` topic
   - EntityGraphProcessor consumes and stores the relation

3. **Vector Generation**:
   - Client calls `entityStorage.generate_entity_vector()`
   - Event is published to `entity-vector-processing` topic
   - EntityVectorProcessor consumes and stores the vector

## Topics

- `entity-events`: Entity creation, update, and deletion events
- `entity-relation-processing`: Entity relationship events
- `entity-vector-processing`: Entity vector generation events
- `knowledge-events`: Knowledge-related events
- `knowledge-vector-processing`: Knowledge vector events
- `dead-letter-queue`: Failed events for debugging

## Consumer Groups

- `entity-content-processor`: Processes entity content events
- `entity-graph-processor`: Processes entity relationship events
- `entity-vector-processor`: Processes entity vector events
- `knowledge-content-processor`: Processes knowledge content events
- `knowledge-vector-processor`: Processes knowledge vector events

## Error Handling

The implementation includes comprehensive error handling:

- Failed messages are logged with detailed error information
- Dead letter queue support for failed events (planned)
- Retry mechanisms for transient failures
- Health check endpoints for monitoring

## Testing

Run the integration tests:

```bash
pnpm test:unit knowledgeBase/kafka/__tests__/kafka.integration.test.ts
```

Note: Integration tests require a running Kafka instance.

## Monitoring

The service includes health check capabilities:

```typescript
const health = await kafkaService.healthCheck();
console.log('Kafka service health:', health);
```

## Configuration Options

### Producer Configuration

- `transactionTimeout`: Timeout for transactions (default: 60s)
- `maxInFlightRequests`: Maximum concurrent requests (default: 5)
- `idempotent`: Enable idempotent producer (default: true)

### Consumer Configuration

- `sessionTimeout`: Consumer session timeout (default: 30s)
- `heartbeatInterval`: Heartbeat interval (default: 3s)
- `maxWaitTimeInMs`: Maximum wait time for messages (default: 5s)
- `autoOffsetReset`: Where to start reading (default: 'latest')

### Topic Configuration

- Partitions and replication factors can be configured per topic
- Default partitions: 3 for most topics, 6 for vector processing
- Default replication factor: 1 (adjust for production)

## Best Practices

1. **Idempotent Operations**: Ensure your storage operations are idempotent
2. **Error Handling**: Implement proper error handling in your processors
3. **Monitoring**: Set up monitoring for consumer lag and processing times
4. **Scaling**: Increase partitions for high-throughput topics
5. **Security**: Use SSL/SASL for production environments

## Troubleshooting

### Common Issues

1. **Connection Refused**: Check Kafka broker addresses and network connectivity
2. **Authentication Failed**: Verify SASL credentials
3. **Topic Not Found**: Ensure topics are created or enable auto-creation
4. **Consumer Lag**: Monitor consumer group lag and scale consumers if needed

### Debug Logging

Enable debug logging by setting the log level:

```env
KAFKA_MONITORING_LOG_LEVEL=debug
```

## Production Considerations

1. **High Availability**: Configure multiple brokers and replication factors > 1
2. **Security**: Enable SSL/TLS and SASL authentication
3. **Monitoring**: Set up comprehensive monitoring and alerting
4. **Backup**: Implement backup and disaster recovery procedures
5. **Performance**: Tune batch sizes and compression settings