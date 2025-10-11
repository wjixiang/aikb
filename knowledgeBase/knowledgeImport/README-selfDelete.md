# LibraryItem Self-Delete Functionality

## Overview

The `LibraryItem` class now includes a `selfDelete()` method that allows for complete removal of a library item and all its associated data. This method provides a convenient way to clean up all resources related to a specific item.

## What Gets Deleted

When `selfDelete()` is called, it systematically removes:

1. **Chunks and Embeddings** - All text chunks and their vector embeddings
2. **Citations** - All citation records associated with the item
3. **Markdown Content** - Processed markdown content extracted from PDFs
4. **PDF Files** - The original PDF file stored in S3
5. **PDF Split Parts** - Any PDF parts created during splitting (for large files)
6. **Metadata** - The main metadata record for the item

## Usage

```typescript
import Library, { LibraryItem } from './liberary';

// Get a library item
const libraryItem = await library.getItem(itemId);

// Delete the item and all associated data
const success = await libraryItem.selfDelete();
if (success) {
  console.log('Item and all associated data deleted successfully');
} else {
  console.log('Failed to delete item');
}
```

## Implementation Details

The `selfDelete()` method follows a specific deletion order to ensure data integrity:

1. First, it deletes chunks and embeddings (which depend on the item metadata)
2. Then, it removes citations (which reference the item ID)
3. Next, it clears markdown content (stored separately from metadata)
4. Then, it removes PDF files from S3 storage
5. Finally, it deletes the metadata record (which other operations depend on)

## Error Handling

The method is designed to be resilient:
- If S3 deletion fails, it continues with other deletions
- Errors are logged but don't stop the overall deletion process
- The method returns `true` if the metadata was successfully deleted, even if some S3 operations failed

## Storage Implementation

The `selfDelete()` method works with both storage implementations:

### S3MongoLibraryStorage
- Uses MongoDB for metadata, chunks, and citations
- Uses S3 for PDF file storage
- Implements `deleteMarkdown()` method to remove markdown content

### S3ElasticSearchLibraryStorage
- Uses Elasticsearch for metadata and chunks
- Uses S3 for PDF file storage
- Implements `deleteMarkdown()` method to remove markdown content

## Testing

The functionality is tested in:
- `knowledgeBase/knowledgeImport/__tests__/library-self-delete-simple.test.ts`

Tests cover:
- Items with PDF files
- Items without PDF files
- Items with PDF splitting information

## Example

See the complete example in:
- `knowledgeBase/examples/library-self-delete-simple-example.ts`

This example demonstrates:
- Creating a library item with PDF
- Adding markdown content and chunks
- Performing self deletion
- Verifying all data is removed

## API Reference

### LibraryItem.selfDelete()

```typescript
async selfDelete(): Promise<boolean>
```

**Returns:**
- `Promise<boolean>` - `true` if the item metadata was successfully deleted, `false` otherwise

**Throws:**
- Error if the item doesn't have an ID
- Error if there are issues with the deletion process (logged but not thrown)

## Notes

- The method is idempotent - calling it multiple times on the same item won't cause errors
- S3 deletion failures are logged but don't prevent the method from completing
- The method should be called when you want to permanently remove an item and all its data
- Consider using this method instead of the library's `deleteBook()` method when you have direct access to a LibraryItem instance