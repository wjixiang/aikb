# S3ElasticSearchLibraryStorage

This document describes the `S3ElasticSearchLibraryStorage` class, which provides an implementation of the `AbstractLibraryStorage` interface using Amazon S3 for file storage and Elasticsearch for metadata storage.

## Overview

The `S3ElasticSearchLibraryStorage` class combines the strengths of two storage systems:

- **Amazon S3**: Used for storing PDF files and other binary content
- **Elasticsearch**: Used for storing and searching metadata, providing powerful full-text search capabilities

This implementation is ideal for applications that require:
- Scalable file storage
- Advanced search capabilities
- High-performance metadata queries
- Full-text search across document content

## Features

### File Storage
- Upload PDF files from buffer or file path
- Generate signed URLs for secure file downloads
- Automatic file organization by year

### Metadata Storage
- Store rich metadata including authors, tags, collections, and more
- Full-text search across title, abstract, and notes
- Advanced filtering by tags, collections, authors, publication year, and file type
- Content hash-based deduplication

### Collection Management
- Create hierarchical collections
- Organize items into multiple collections
- Search and filter by collections

### Citation Generation
- Generate citations in multiple formats (APA, MLA, Chicago)
- Store citation history

## Installation

Make sure you have the required dependencies installed:

```bash
pnpm install @elastic/elasticsearch
```

## Configuration

The following environment variables are required:

```bash
# Elasticsearch configuration
ELASTICSEARCH_URL=http://elasticsearch:9200
ELASTICSEARCH_URL_API_KEY=your-api-key

# S3 configuration
PDF_OSS_BUCKET_NAME=your-bucket-name
# Other S3 configuration as required by your S3Service implementation
```

## Setting up Elasticsearch

### Option 1: Using the provided shell script (Recommended)

The project includes a shell script that uses curl and docker-compose to check and start Elasticsearch:

```bash
# Check if Elasticsearch is available and start it if needed
./knowledgeBase/knowledgeImport/scripts/check-elasticsearch-simple.sh
```

This option is recommended as it avoids Node.js compatibility issues.

### Option 2: Using the Node.js script

The project also includes a Node.js script to check and start Elasticsearch:

```bash
# Check if Elasticsearch is available and start it if needed
node knowledgeBase/knowledgeImport/scripts/check-elasticsearch.js
```

Note: This script may have compatibility issues with some Node.js versions.

### Option 2: Manual setup using docker-compose

The project includes Elasticsearch configuration in the `elastic-start-local` directory:

```bash
cd elastic-start-local
./start.sh
```

### Option 3: Using Docker directly

```bash
docker run -d \
  --name elasticsearch \
  -p 9200:9200 \
  -p 9300:9300 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  -e "ES_JAVA_OPTS=-Xms512m -Xmx512m" \
  elasticsearch:8.15.1
```

### Verifying Elasticsearch is running

You can verify Elasticsearch is running by:

```bash
curl http://elasticsearch:9200
```

Or by running the check script:

```bash
node knowledgeBase/knowledgeImport/scripts/check-elasticsearch.js
```

## Usage

### Basic Usage

```typescript
import Library, { S3ElasticSearchLibraryStorage } from './liberary';

// Initialize the storage
const elasticsearchUrl = process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200';
const storage = new S3ElasticSearchLibraryStorage(elasticsearchUrl);

// Create a library instance
const library = new Library(storage);

// Store an article
const article = await library.storeArticle({
  title: 'My Research Paper',
  authors: [{ firstName: 'John', lastName: 'Doe' }],
  abstract: 'This is my research paper abstract',
  tags: ['research', 'science'],
  fileType: 'article'
});

// Search for items
const results = await library.searchItems({
  query: 'research',
  tags: ['science']
});
```

### Storing PDF Files

```typescript
// Store a PDF from a file path
const pdfItem = await library.storePdf('/path/to/document.pdf', {
  title: 'Important Document',
  authors: [{ firstName: 'Jane', lastName: 'Smith' }],
  tags: ['important', 'pdf']
});

// Store a PDF from a buffer
const fs = require('fs');
const pdfBuffer = fs.readFileSync('/path/to/document.pdf');
const pdfItem2 = await library.storePdfFromBuffer(pdfBuffer, 'document.pdf', {
  title: 'Another Document',
  authors: [{ firstName: 'Bob', lastName: 'Johnson' }],
  tags: ['buffer', 'pdf']
});
```

### Working with Collections

```typescript
// Create collections
const aiCollection = await library.createCollection('Artificial Intelligence');
const mlCollection = await library.createCollection('Machine Learning', 'ML research papers');

// Add items to collections
await pdfItem.addToCollection(aiCollection.id);
await pdfItem.addToCollection(mlCollection.id);

// Search by collection
const aiPapers = await library.searchItems({
  collections: [aiCollection.id]
});
```

### Advanced Search

```typescript
// Search with multiple filters
const results = await library.searchItems({
  query: 'machine learning',
  tags: ['ai', 'research'],
  authors: ['Smith', 'Johnson'],
  dateRange: {
    start: new Date('2020-01-01'),
    end: new Date('2023-12-31')
  },
  fileType: ['article', 'pdf']
});
```

### Citation Generation

```typescript
// Generate citations in different styles
const apaCitation = await library.generateCitation(pdfItem.metadata.id, 'APA');
const mlaCitation = await library.generateCitation(pdfItem.metadata.id, 'MLA');
const chicagoCitation = await library.generateCitation(pdfItem.metadata.id, 'Chicago');

console.log(apaCitation.citationText);
console.log(mlaCitation.citationText);
console.log(chicagoCitation.citationText);
```

## Elasticsearch Index Structure

The implementation creates three Elasticsearch indexes:

### library_metadata
Stores document metadata with the following fields:
- `id`: Unique identifier
- `title`: Document title (text with keyword field)
- `authors`: Nested author objects
- `abstract`: Document abstract
- `publicationYear`: Publication year
- `publisher`: Publisher name
- `isbn`: ISBN number
- `doi`: DOI identifier
- `url`: Document URL
- `tags`: Array of tags
- `notes`: User notes
- `collections`: Array of collection IDs
- `dateAdded`: Date added
- `dateModified`: Date modified
- `fileType`: Type of file (pdf, article, book, other)
- `s3Key`: S3 object key
- `s3Url`: S3 object URL
- `fileSize`: File size in bytes
- `pageCount`: Number of pages
- `language`: Document language
- `contentHash`: Content hash for deduplication

### library_collections
Stores collection information:
- `id`: Unique identifier
- `name`: Collection name
- `description`: Collection description
- `parentCollectionId`: Parent collection ID (for nesting)
- `dateAdded`: Date added
- `dateModified`: Date modified

### library_citations
Stores generated citations:
- `id`: Unique identifier
- `itemId`: ID of the cited item
- `citationStyle`: Citation style (APA, MLA, Chicago, etc.)
- `citationText`: Formatted citation text
- `dateGenerated`: Date citation was generated

## Performance Considerations

### Indexing Strategy
- The metadata index includes text fields with keyword sub-fields for exact matching
- Authors are stored as nested objects for precise querying
- Date fields are properly typed for range queries

### Search Performance
- Full-text search is configured with fuzziness for typo tolerance
- Multi-field search across title, abstract, and notes
- Efficient filtering on tags, collections, and other categorical fields

### Scalability
- Elasticsearch automatically distributes data across nodes
- S3 provides virtually unlimited storage for files
- Index can be scaled horizontally as needed

## Error Handling

The implementation includes comprehensive error handling:
- Graceful handling of missing indexes
- Proper error messages for invalid operations
- Fallback behavior for network issues

## Testing

Run the test suite to verify functionality:

```bash
# Run the S3ElasticSearchLibraryStorage tests
pnpm test knowledgeBase/knowledgeImport/s3-elasticsearch-storage.test.ts

# Run the example
pnpm tsx knowledgeBase/knowledgeImport/examples/s3-elasticsearch-library-example.ts
```

## Migration from S3MongoLibraryStorage

If you're migrating from the MongoDB-based storage:

1. Update your storage initialization:
   ```typescript
   // Old
   const storage = new S3MongoLibraryStorage();
   
   // New
   const storage = new S3ElasticSearchLibraryStorage(elasticsearchUrl);
   ```

2. The API remains the same, so no other code changes are required

3. Benefits of migration:
   - Better search performance
   - More advanced search capabilities
   - Better scalability for large datasets

## Troubleshooting

### Common Issues

1. **Connection to Elasticsearch fails**
   - Verify ELASTICSEARCH_URL is correct
   - Check if Elasticsearch is running
   - Verify API key if authentication is enabled

2. **Search returns no results**
   - Check if indexes are created properly
   - Verify data is indexed correctly
   - Check search query syntax

3. **File upload fails**
   - Verify S3 configuration
   - Check bucket permissions
   - Verify file size limits

### Debug Logging

Enable debug logging to troubleshoot issues:

```typescript
// The storage class includes built-in logging
const storage = new S3ElasticSearchLibraryStorage(elasticsearchUrl);
// Logs will be output to console with the prefix 'S3ElasticSearchLibraryStorage'