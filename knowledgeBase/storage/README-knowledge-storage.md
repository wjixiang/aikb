# Knowledge Storage Implementation

This document describes the implementation of Knowledge storage functionality in the knowledge base system.

## Overview

The Knowledge storage system provides a complete solution for storing, retrieving, and managing knowledge items with hierarchical relationships. It consists of three main components:

1. **KnowledgeContentStorage** - Stores knowledge content and metadata
2. **KnowledgeGraphStorage** - Manages relationships between knowledge items
3. **KnowledgeVectorStorage** - Handles vector embeddings for similarity search

## Implementation Details

### MongoDB KnowledgeContentStorage

The `MongodbKnowledgeContentStorage` class implements the `AbstractKnowledgeContentStorage` interface and provides the following operations:

- `create_new_knowledge_content()` - Create new knowledge content
- `get_knowledge_content_by_id()` - Retrieve knowledge by ID
- `update_knowledge_content()` - Update existing knowledge
- `delete_knowledge_content_by_id()` - Delete knowledge content
- `search_knowledge_contents()` - Search knowledge by text
- `list_all_knowledge_contents()` - List all knowledge items

### MongoDB KnowledgeVectorStorage

The `MongodbKnowledgeVectorStorage` class implements the `AbstractKnowledgeVectorStorage` interface and provides:

- `store_knowledge_vector()` - Store vector embeddings
- `get_knowledge_vector()` - Retrieve vector embeddings
- `update_knowledge_vector()` - Update vector embeddings
- `delete_knowledge_vector()` - Delete vector embeddings
- `find_similar_knowledge_vectors()` - Find similar knowledge using cosine similarity
- `batch_store_knowledge_vectors()` - Batch store multiple vectors

### MongoDB KnowledgeGraphStorage

The `MongoKnowledgeGraphStorage` class implements the `AbstractKnowledgeGraphStorage` interface and provides:

- `create_new_link()` - Create relationships between knowledge items

## Usage Examples

### Basic Knowledge Storage

```typescript
import { MongodbKnowledgeContentStorage } from './storage/mongodb-knowledge-content-storage';
import { MongodbKnowledgeVectorStorage } from './storage/mongodb-knowledge-vector-storage';
import { MongoKnowledgeGraphStorage } from './storage/mongodb-knowledge-graph-storage';
import KnowledgeStorage from './storage/knowledgeStorage';

// Initialize storage components
const knowledgeContentStorage = new MongodbKnowledgeContentStorage();
const knowledgeVectorStorage = new MongodbKnowledgeVectorStorage();
const knowledgeGraphStorage = new MongoKnowledgeGraphStorage();

// Create knowledge storage instance
const knowledgeStorage = new KnowledgeStorage(
  knowledgeContentStorage,
  knowledgeGraphStorage,
  knowledgeVectorStorage,
);

// Create knowledge
const knowledgeData = {
  scope: 'Machine Learning',
  content: 'Machine learning is a subset of artificial intelligence...',
  childKnowledgeId: [],
};

const knowledge = await knowledgeStorage.create_new_knowledge(knowledgeData, 'source_id');
```

### Working with Knowledge Instances

```typescript
// Retrieve knowledge by ID
const retrievedKnowledge = await knowledgeStorage.get_knowledge_by_id(knowledge.id);

// Create child knowledge
const childData = {
  scope: 'Supervised Learning',
  content: 'Supervised learning uses labeled training data...',
  childKnowledgeId: [],
};

const childKnowledge = await retrievedKnowledge.subdivide(childData);

// Update knowledge content
await retrievedKnowledge.update({
  content: 'Updated content about machine learning...',
});

// Render knowledge as markdown
const markdown = retrievedKnowledge.render_to_markdown_string();
console.log(markdown);
```

### Vector Operations

```typescript
// Store vector for knowledge
const vector = await generateEmbedding(knowledge.content); // Your embedding function
await knowledgeVectorStorage.store_knowledge_vector(
  knowledge.id,
  vector,
  { topic: 'machine-learning', category: 'ai' }
);

// Find similar knowledge
const similarKnowledge = await knowledgeVectorStorage.find_similar_knowledge_vectors(
  queryVector,
  10, // limit
  0.7 // similarity threshold
);

// Batch store vectors
const vectors = knowledgeItems.map(item => ({
  knowledgeId: item.id,
  vector: await generateEmbedding(item.content),
  metadata: { topic: item.scope }
}));

await knowledgeVectorStorage.batch_store_knowledge_vectors(vectors);
```

## Knowledge Class Enhancements

The `Knowledge` class has been enhanced with the following methods:

- `subdivide()` - Create child knowledge
- `update()` - Update knowledge content
- `delete()` - Delete knowledge and all children
- `addChild()` - Add a child knowledge
- `removeChild()` - Remove a child knowledge
- `getChildren()` - Get all child knowledge
- `getData()` - Get knowledge data as object

## Testing

The implementation includes comprehensive tests in `knowledgeBase/storage/__tests__/mongodb-knowledge-storage.test.ts`. To run the tests:

```bash
npm test -- knowledgeBase/storage/__tests__/mongodb-knowledge-storage.test.ts
```

## Examples

See `knowledgeBase/examples/knowledge-storage-example.ts` for complete usage examples, including:

- Basic knowledge creation and storage
- Working with knowledge hierarchies
- Vector operations and similarity search
- Advanced knowledge management

## Architecture

The Knowledge storage system follows the same architectural patterns as the Entity storage system:

1. **Abstract interfaces** define the contract for storage operations
2. **Concrete implementations** provide database-specific functionality
3. **Storage classes** coordinate between different storage types
4. **Domain models** (Knowledge class) provide business logic and methods

This architecture ensures:

- Separation of concerns
- Database agnostic design
- Easy testing and mocking
- Consistent API across storage types

## Integration with Existing System

The Knowledge storage system integrates seamlessly with the existing Entity storage system:

- Both use the same MongoDB connection
- Similar API patterns and conventions
- Can be used together in the same application
- Shared configuration and logging

## Future Enhancements

Potential future enhancements include:

1. **Elasticsearch integration** for full-text search
2. **Caching layer** for improved performance
3. **Access control** for knowledge items
4. **Versioning** for knowledge history
5. **Import/Export** functionality for knowledge bases