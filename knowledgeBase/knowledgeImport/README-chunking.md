# PDF Chunking and Embedding Workflow

This document describes the enhanced PDF upload workflow that includes automatic chunking and embedding of markdown content, with storage in Elasticsearch for efficient semantic search.

## Overview

The enhanced workflow processes PDF documents through the following stages:

1. **PDF Upload**: Store PDF file in S3 and save metadata
2. **Markdown Conversion**: Convert PDF to markdown using MinerU
3. **Text Chunking**: Split markdown content into manageable chunks
4. **Embedding Generation**: Create vector embeddings for each chunk
5. **Elasticsearch Storage**: Store chunks with embeddings in Elasticsearch
6. **Semantic Search**: Enable similarity search across document chunks

## Key Components

### BookChunk Interface

```typescript
interface BookChunk {
  id: string;
  itemId: string; // Reference to the parent book item
  title: string;
  content: string;
  index: number; // Position in the document
  embedding?: number[]; // Vector embedding of the content
  metadata?: {
    chunkType?: 'h1' | 'paragraph';
    startPosition?: number;
    endPosition?: number;
    wordCount?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Chunking Strategies

The system supports two chunking strategies:

1. **H1 Chunking** (`h1`): Splits content based on H1 headings
2. **Paragraph Chunking** (`paragraph`): Splits content based on paragraph breaks

### Storage Implementations

Both MongoDB and Elasticsearch storage implementations support chunk operations:

- `S3MongoLibraryStorage`: Stores chunks in MongoDB with manual vector similarity calculation
- `S3ElasticSearchLibraryStorage`: Stores chunks in Elasticsearch with native vector search

## Usage Examples

### Basic PDF Upload with Automatic Chunking

```typescript
import Library, { S3ElasticSearchLibraryStorage } from './liberary';
import { createMinerUConvertorFromEnv } from './PdfConvertor';

// Initialize library
const storage = new S3ElasticSearchLibraryStorage();
const pdfConvertor = createMinerUConvertorFromEnv();
const library = new Library(storage, pdfConvertor);

// Upload PDF - automatically processes chunks
const pdfBuffer = fs.readFileSync('document.pdf');
const item = await library.storePdf(pdfBuffer, 'document.pdf', {
  title: 'Research Paper',
  authors: [{ firstName: 'John', lastName: 'Doe' }],
  fileType: 'pdf',
});

console.log(`Created ${await library.getItemChunks(item.metadata.id!)} chunks`);
```

### Manual Chunk Processing

```typescript
// Process chunks with specific strategy
await library.processItemChunks(itemId, 'h1');

// Get all chunks for an item
const chunks = await library.getItemChunks(itemId);

// Re-process with different strategy
await library.processItemChunks(itemId, 'paragraph');
```

### LibraryItem-Level Chunk Processing

The LibraryItem class provides methods for self-contained chunk processing:

```typescript
// Get the LibraryItem instance
const item = await library.getItem(itemId);

// Process chunks using the LibraryItem method
const chunks = await item.chunkEmbed('h1', true); // forceReprocess=true

// Get chunk statistics
const stats = await item.getChunkStats();
console.log(`Total chunks: ${stats.totalChunks}, Average words: ${stats.averageWordsPerChunk}`);

// Search within the item
const searchResults = await item.searchInChunks('machine learning', 10);

// Find similar chunks within the item
const queryVector = await embeddingService.embed('neural networks');
const similarChunks = await item.findSimilarInChunks(queryVector, 5, 0.7);

// Delete all chunks for this item
await item.deleteChunks();
```

### Searching Chunks

```typescript
// Text-based search
const results = await library.searchChunks({
  query: 'machine learning',
  itemId: 'specific-item-id',
  limit: 10,
});

// Semantic similarity search
const queryVector = await embeddingService.embed('neural networks');
const similarChunks = await library.findSimilarChunks(
  queryVector,
  5, // limit
  0.7, // similarity threshold
  ['item-id-1', 'item-id-2'] // optional item filter
);
```

### LibraryItem-Specific Search

The system provides convenient methods for searching within specific LibraryItems:

```typescript
// Semantic search within a specific item
const similarInItem = await library.findSimilarChunksInItem(
  'item-id-123',
  queryVector,
  5, // limit
  0.7 // similarity threshold
);

// Text search within a specific item
const textResults = await library.searchChunksInItem(
  'item-id-123',
  'machine learning',
  10 // limit
);
```

### Batch Operations

```typescript
// Re-process chunks for all items
await library.reProcessChunks();

// Re-process chunks for specific item with different strategy
await library.reProcessChunks(itemId, 'paragraph');

// Search across multiple items
const results = await library.searchChunks({
  query: 'deep learning',
  itemIds: ['item-1', 'item-2', 'item-3'],
});
```

## Configuration

### Environment Variables

```bash
# Elasticsearch configuration
ELASTICSEARCH_URL=http://elasticsearch:9200
ELASTICSEARCH_URL_API_KEY=your-api-key

# Embedding configuration
EMBEDDING_DIMENSIONS=1536
EMBEDDING_CONCURRENCY_LIMIT=5

# S3 configuration
PDF_OSS_BUCKET_NAME=your-bucket-name
```

### Vector Dimensions

The system supports different embedding dimensions:

- OpenAI embeddings: 1536 dimensions
- Alibaba embeddings: Varies by model
- ONNX embeddings: Varies by model

## API Reference

### Library Methods

#### Chunk Processing

- `processItemChunks(itemId, chunkingStrategy?)`: Process chunks for a specific item
- `reProcessChunks(itemId?, chunkingStrategy?)`: Re-process chunks for one or all items
- `getItemChunks(itemId)`: Get all chunks for an item

#### Search

- `searchChunks(filter)`: Search chunks with text-based filters
- `findSimilarChunks(queryVector, limit?, threshold?, itemIds?)`: Find semantically similar chunks
- `findSimilarChunksInItem(itemId, queryVector, limit?, threshold?)`: Find similar chunks within a specific item
- `searchChunksInItem(itemId, query, limit?)`: Search chunks within a specific item

#### LibraryItem Methods

- `chunkEmbed(chunkingStrategy?, forceReprocess?)`: Process chunks for this item
- `getChunks()`: Get all chunks for this item
- `searchInChunks(query, limit?)`: Search within this item's chunks
- `findSimilarInChunks(queryVector, limit?, threshold?)`: Find similar chunks within this item
- `deleteChunks()`: Delete all chunks for this item
- `getChunkStats()`: Get chunk statistics for this item

### Storage Methods

#### Chunk Operations

- `saveChunk(chunk)`: Save a single chunk
- `getChunk(chunkId)`: Get a chunk by ID
- `getChunksByItemId(itemId)`: Get all chunks for an item
- `updateChunk(chunk)`: Update a chunk
- `deleteChunk(chunkId)`: Delete a chunk
- `deleteChunksByItemId(itemId)`: Delete all chunks for an item
- `batchSaveChunks(chunks)`: Save multiple chunks efficiently

#### Search Operations

- `searchChunks(filter)`: Search chunks with filters
- `findSimilarChunks(queryVector, limit?, threshold?, itemIds?)`: Find similar chunks

## Performance Considerations

### Embedding Generation

- Embeddings are generated in batches to optimize API usage
- Concurrency is limited by `EMBEDDING_CONCURRENCY_LIMIT`
- Failed embeddings don't prevent chunk storage

### Elasticsearch Indexing

- Chunks are indexed with `refresh: true` for immediate availability
- Vector fields use `dense_vector` type with configured dimensions
- Similarity search uses cosine similarity

### Memory Usage

- Large documents are processed in chunks to manage memory
- Batch operations minimize database round trips
- Embeddings are stored as number arrays, which can be memory-intensive

## Error Handling

The system implements graceful error handling:

- PDF conversion failures don't prevent metadata storage
- Chunking failures don't prevent markdown storage
- Embedding failures don't prevent chunk storage
- Individual chunk processing failures don't stop batch operations

## Testing

Run the test suite:

```bash
# Run chunking tests
pnpm test library-chunking.test.ts

# Run example
pnpm tsx library-chunking-example.ts
```

## Future Enhancements

Potential improvements to consider:

1. **Advanced Chunking**: Implement semantic chunking based on content coherence
2. **Hierarchical Search**: Support searching within specific document sections
3. **Chunk Merging**: Automatically merge related chunks for context
4. **Caching**: Cache embeddings for repeated content
5. **Hybrid Search**: Combine keyword and semantic search
6. **Chunk Summaries**: Generate summaries for large chunks