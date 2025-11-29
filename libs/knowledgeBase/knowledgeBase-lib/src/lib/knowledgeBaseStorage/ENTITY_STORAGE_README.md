# Entity Storage Interface

This document describes the `IEntityStorage` interface and its implementations for managing `EntityData` objects in the knowledge base system.

## Overview

The `IEntityStorage` interface provides a comprehensive CRUD (Create, Read, Update, Delete) API for managing entities with support for:

- Basic CRUD operations
- Text-based search with language filtering
- Vector similarity search for semantic matching
- Pagination support
- Batch operations

## Interface Definition

```typescript
export interface IEntityStorage {
    // Core CRUD operations
    create(entity: Omit<EntityData, 'id'>): Promise<EntityData>;
    findById(id: string): Promise<EntityData | null>;
    findByIds(ids: string[]): Promise<(EntityData | null)[]>;
    update(id: string, updates: Partial<Omit<EntityData, 'id'>>): Promise<EntityData | null>;
    delete(id: string): Promise<boolean>;
    exists(id: string): Promise<boolean>;

    // Search and discovery
    search(query: string, options?: SearchOptions): Promise<EntityData[]>;
    findBySimilarity(vector: number[], options?: SimilarityOptions): Promise<Array<{ entity: EntityData; similarity: number }>>;
    findAll(options?: PaginationOptions): Promise<{ entities: EntityData[]; total: number }>;
}
```

## Methods

### Core CRUD Operations

#### `create(entity)`
Creates a new entity with an automatically generated ID.

**Parameters:**
- `entity`: Entity data without ID

**Returns:** Promise resolving to the created entity with generated ID

#### `findById(id)`
Retrieves a single entity by its ID.

**Parameters:**
- `id`: The entity ID

**Returns:** Promise resolving to the entity data or null if not found

#### `findByIds(ids)`
Retrieves multiple entities by their IDs in a single operation.

**Parameters:**
- `ids`: Array of entity IDs

**Returns:** Promise resolving to array of entities (null for not found entities)

#### `update(id, updates)`
Updates an existing entity with partial data.

**Parameters:**
- `id`: The entity ID to update
- `updates`: Partial entity data to update

**Returns:** Promise resolving to the updated entity or null if not found

#### `delete(id)`
Deletes an entity by its ID.

**Parameters:**
- `id`: The entity ID to delete

**Returns:** Promise resolving to true if deleted, false if not found

#### `exists(id)`
Checks if an entity exists.

**Parameters:**
- `id`: The entity ID

**Returns:** Promise resolving to true if entity exists

### Search and Discovery

#### `search(query, options)`
Searches entities by text query across nomenclature names and abstract descriptions.

**Parameters:**
- `query`: The search query string
- `options`: Optional search parameters including:
  - `limit`: Maximum number of results (default: 50)
  - `offset`: Number of results to skip (default: 0)
  - `language`: Filter by language ('en' | 'zh')

**Returns:** Promise resolving to array of matching entities

#### `findBySimilarity(vector, options)`
Finds entities similar to a given embedding vector using cosine similarity.

**Parameters:**
- `vector`: The embedding vector to compare against
- `options`: Optional search parameters including:
  - `limit`: Maximum number of results (default: 10)
  - `threshold`: Minimum similarity score (default: 0.5)

**Returns:** Promise resolving to array of similar entities with similarity scores

#### `findAll(options)`
Retrieves all entities with pagination support.

**Parameters:**
- `options`: Optional pagination parameters including:
  - `limit`: Maximum number of results (default: 50)
  - `offset`: Number of results to skip (default: 0)

**Returns:** Promise resolving to paginated entities and total count

## Implementations

### 1. EntityStorageService (Base Implementation)

A basic implementation that provides method stubs for all interface methods. This is useful as a base class or for testing purposes.

**Location:** `src/lib/entity-storage.service.ts`

**Features:**
- Implements all interface methods
- Provides basic ID generation
- Returns default values (null, empty arrays, false)
- Suitable for inheritance and extension

### 2. EntityStorageMemoryService (In-Memory Implementation)

A complete in-memory implementation suitable for testing, development, and small-scale applications.

**Location:** `src/lib/entity-storage.memory.service.ts`

**Features:**
- Full CRUD functionality
- Text search with case-insensitive matching
- Vector similarity search using cosine similarity
- Language filtering support
- Pagination support
- Thread-safe operations
- Memory-based storage using Map

**Additional Methods:**
- `clear()`: Clears all entities from memory
- `count()`: Returns the current number of stored entities

## Usage Examples

### Basic CRUD Operations

```typescript
import { EntityStorageMemoryService } from './entity-storage.memory.service';

const storage = new EntityStorageMemoryService();

// Create an entity
const entity = await storage.create({
    nomanclature: [
        { name: 'Artificial Intelligence', acronym: 'AI', language: 'en' }
    ],
    abstract: {
        description: 'The simulation of human intelligence in machines',
        embedding: {
            config: { model: 'text-embedding-ada-002', dimensions: 1536 },
            vector: new Array(1536).fill(0.1)
        }
    }
});

// Read an entity
const found = await storage.findById(entity.id);

// Update an entity
const updated = await storage.update(entity.id, {
    nomanclature: [
        { name: 'Artificial Intelligence', acronym: 'AI', language: 'en' },
        { name: '人工智能', acronym: null, language: 'zh' }
    ]
});

// Delete an entity
const deleted = await storage.delete(entity.id);
```

### Search Operations

```typescript
// Text search
const results = await storage.search('intelligence', {
    limit: 10,
    language: 'en'
});

// Vector similarity search
const queryVector = new Array(1536).fill(0.2);
const similar = await storage.findBySimilarity(queryVector, {
    limit: 5,
    threshold: 0.8
});

// Get all entities with pagination
const all = await storage.findAll({
    limit: 20,
    offset: 0
});
```

## Testing

Both implementations include comprehensive test suites:

- `entity-storage.service.spec.ts`: Tests for the base implementation
- `entity-storage.memory.service.spec.ts`: Tests for the in-memory implementation

Run tests with:
```bash
nx test knowledgeBase-lib --testNamePattern="EntityStorage"
```

## Extending the Interface

To create a custom implementation (e.g., database-based), implement the `IEntityStorage` interface:

```typescript
@Injectable()
export class DatabaseEntityStorageService implements IEntityStorage {
    // Implement all required methods
    async create(entity: Omit<EntityData, 'id'>): Promise<EntityData> {
        // Database-specific implementation
    }
    
    // ... implement other methods
}
```

## Performance Considerations

- **Memory Implementation**: Suitable for small datasets (< 10,000 entities) and testing
- **Vector Search**: Cosine similarity calculation is O(n) - consider vector databases for large datasets
- **Text Search**: Simple string matching - consider full-text search engines for production use
- **Pagination**: Always use limits for large datasets to avoid memory issues

## Future Enhancements

Potential improvements for production use:

1. **Database Integration**: PostgreSQL, MongoDB, or vector databases (Pinecone, Weaviate)
2. **Caching Layer**: Redis for frequently accessed entities
3. **Indexing**: Full-text search indexes for better performance
4. **Batch Operations**: Bulk create, update, delete operations
5. **Event System**: Entity change notifications
6. **Validation**: Input validation and sanitization
7. **Audit Trail**: Track entity changes over time