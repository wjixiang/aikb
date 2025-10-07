# Zotero-like Library Management System

This system provides a comprehensive literature management solution similar to Zotero, with support for PDF storage, metadata management, collections, and citation generation.

## Features

- **PDF Storage**: Store PDF files in S3 with automatic metadata extraction
- **Metadata Management**: Rich metadata support including authors, tags, and custom fields
- **Collections**: Organize literature into hierarchical collections
- **Search & Filter**: Advanced search capabilities with multiple filter options
- **Citation Generation**: Generate citations in multiple formats (APA, MLA, Chicago)
- **Tag Management**: Add and remove tags for better organization
- **Database Integration**: MongoDB for metadata storage

## Installation

Make sure you have the following environment variables set:

```bash
# S3/OSS Configuration
OSS_ACCESS_KEY_ID=your_access_key
OSS_SECRET_ACCESS_KEY=your_secret_key
PDF_OSS_BUCKET_NAME=your_bucket_name
OSS_REGION=your_region
S3_ENDPOINT=your_endpoint (optional)

# MongoDB Configuration
MONGODB_URI=your_mongodb_uri
DB_NAME=your_database_name (optional, defaults to 'aikb')
```

## Quick Start

```typescript
import Library from './liberary';
import { S3MongoLibraryStorage } from './liberary';

// Initialize the library
const storage = new S3MongoLibraryStorage();
const library = new Library(storage);

// Create a collection
const aiCollection = await library.createCollection('Artificial Intelligence', 'AI research papers');

// Store a PDF book
const book = await library.storePdf('./path/to/paper.pdf', {
  title: 'Deep Learning',
  authors: [
    { firstName: 'Ian', lastName: 'Goodfellow' },
    { firstName: 'Yoshua', lastName: 'Bengio' }
  ],
  publicationYear: 2016,
  tags: ['deep learning', 'neural networks'],
  collections: [aiCollection.id]
});

// Store an article
const article = await library.storeArticle({
  title: 'Attention Is All You Need',
  authors: [
    { firstName: 'Ashish', lastName: 'Vaswani' }
  ],
  publicationYear: 2017,
  tags: ['transformer', 'attention'],
  doi: '10.48550/arXiv.1706.03762'
});

// Search for items
const results = await library.searchItems({
  query: 'learning',
  tags: ['deep learning']
});

// Generate citations
const apaCitation = await library.generateCitation(book.metadata.id, 'APA');
console.log(apaCitation.citationText);
```

## API Reference

### Library Class

#### Methods

- `storePdf(pdfPath: string, metadata: Partial<BookMetadata>): Promise<Book>`
  - Store a PDF file from local path with metadata
  
- `storePdfFromBuffer(pdfBuffer: Buffer, fileName: string, metadata: Partial<BookMetadata>): Promise<Book>`
  - Store a PDF from a buffer with metadata
  
- `storeArticle(metadata: Partial<BookMetadata>): Promise<Article>`
  - Store an article with metadata (no PDF file)
  
- `getBook(id: string): Promise<Book | null>`
  - Retrieve a book by ID
  
- `getArticle(id: string): Promise<Article | null>`
  - Retrieve an article by ID
  
- `searchItems(filter: SearchFilter): Promise<(Book | Article)[]>`
  - Search for items with filters
  
- `createCollection(name: string, description?: string, parentCollectionId?: string): Promise<Collection>`
  - Create a new collection
  
- `getCollections(): Promise<Collection[]>`
  - Get all collections
  
- `addItemToCollection(itemId: string, collectionId: string): Promise<void>`
  - Add an item to a collection
  
- `removeItemFromCollection(itemId: string, collectionId: string): Promise<void>`
  - Remove an item from a collection
  
- `generateCitation(itemId: string, style: string): Promise<Citation>`
  - Generate a citation for an item

### Book Class

#### Methods

- `getPdf(): Promise<Buffer | null>`
  - Get the PDF file as a buffer
  
- `getPdfDownloadUrl(): Promise<string>`
  - Get a download URL for the PDF
  
- `getMarkdown(): Promise<string>`
  - Get the content as markdown (placeholder implementation)
  
- `getJSON(): Promise<BookMetadata>`
  - Get the metadata as JSON
  
- `updateMetadata(updates: Partial<BookMetadata>): Promise<void>`
  - Update the metadata
  
- `addTag(tag: string): Promise<void>`
  - Add a tag
  
- `removeTag(tag: string): Promise<void>`
  - Remove a tag
  
- `addToCollection(collectionId: string): Promise<void>`
  - Add to a collection
  
- `removeFromCollection(collectionId: string): Promise<void>`
  - Remove from a collection

### Article Class

The Article class has the same methods as the Book class, except for PDF-related methods.

### Data Types

#### BookMetadata

```typescript
interface BookMetadata {
  id?: string;
  title: string;
  authors: Author[];
  abstract?: string;
  publicationYear?: number;
  publisher?: string;
  isbn?: string;
  doi?: string;
  url?: string;
  tags: string[];
  notes?: string;
  collections: string[];
  dateAdded: Date;
  dateModified: Date;
  fileType: 'pdf' | 'article' | 'book' | 'other';
  s3Key?: string;
  s3Url?: string;
  fileSize?: number;
  pageCount?: number;
  language?: string;
}
```

#### Author

```typescript
interface Author {
  firstName: string;
  lastName: string;
  middleName?: string;
}
```

#### Collection

```typescript
interface Collection {
  id?: string;
  name: string;
  description?: string;
  parentCollectionId?: string;
  dateAdded: Date;
  dateModified: Date;
}
```

#### SearchFilter

```typescript
interface SearchFilter {
  query?: string;
  tags?: string[];
  collections?: string[];
  authors?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  fileType?: string[];
}
```

#### Citation

```typescript
interface Citation {
  id: string;
  itemId: string;
  citationStyle: string;
  citationText: string;
  dateGenerated: Date;
}
```

## Storage Implementation

The system uses the `S3MongoLibraryStorage` class which combines:

- **S3 Storage**: For PDF files
- **MongoDB**: For metadata, collections, and citations

You can implement your own storage by extending the `AbstractLibraryStorage` class.

## Example Usage

See `knowledgeBase/examples/library-usage-example.ts` for a complete example of how to use the library system.

## Future Enhancements

- Full-text search within PDFs
- Integration with reference managers (EndNote, Mendeley)
- Web scraping for automatic metadata extraction
- PDF annotation support
- Collaboration features
- Export to various formats (BibTeX, RIS, etc.)