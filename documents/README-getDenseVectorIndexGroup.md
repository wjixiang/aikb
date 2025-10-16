# getDenseVectorIndexGroup Method

## Overview

The `getDenseVectorIndexGroup` method has been added to the `LibraryItem` class to retrieve all available dense vector index groups (embedding versions) for a specific library item. This allows users to understand which embedding versions are available for retrieval and comparison.

## Method Signature

```typescript
async getDenseVectorIndexGroup(): Promise<string[]>
```

## Description

This method queries the storage for all chunks associated with the current `LibraryItem` and extracts all unique `denseVectorIndexGroupId` values. These groups represent different embedding versions that may have been created using different strategies, providers, or configurations.

## Return Value

- **Promise<string[]>**: An array of unique dense vector index group identifiers for this item. Returns an empty array if no chunks exist.

## Usage Examples

### Basic Usage

```typescript
// Get a library item
const item = await library.getItem(itemId);

if (item) {
  // Get all available dense vector index groups
  const groups = await item.getDenseVectorIndexGroup();
  console.log('Available groups:', groups);
}
```

### Using Groups for Search

```typescript
// Get available groups
const groups = await item.getDenseVectorIndexGroup();

if (groups.length > 0) {
  // Use the first group for semantic search
  const results = await item.findSimilarInChunks(queryVector, 10, 0.7, {
    denseVectorIndexGroupId: groups[0]
  });
}
```

### Comparing Results Across Groups

```typescript
const groups = await item.getDenseVectorIndexGroup();
const queryVector = [0.1, 0.2, 0.3]; // Your query vector

// Compare results from different embedding versions
for (const group of groups) {
  const results = await item.findSimilarInChunks(queryVector, 5, 0.7, {
    denseVectorIndexGroupId: group
  });
  
  console.log(`Results from ${group}:`, results);
}
```

## Implementation Details

The method:
1. Retrieves all chunks for the current item using the existing `getChunks()` method
2. Extracts the `denseVectorIndexGroupId` field from each chunk
3. Filters out any empty or null values
4. Returns an array of unique group identifiers

## Error Handling

The method includes comprehensive error handling:
- If no chunks exist for the item, it returns an empty array
- If there's an error retrieving chunks, it logs the error and re-throws it
- All operations are wrapped in try-catch blocks with appropriate logging

## Use Cases

1. **Multi-Version Embedding Management**: Identify which embedding versions are available for an item
2. **Strategy Comparison**: Compare search results across different chunking or embedding strategies
3. **Version Selection**: Choose the most appropriate embedding version for a specific use case
4. **System Monitoring**: Check which embedding versions have been successfully generated
5. **Migration Operations**: Identify items that need re-processing with new strategies

## Related Methods

- `getChunks()`: Retrieves chunks for an item, with optional filtering by group
- `findSimilarInChunks()`: Finds similar chunks within an item, with optional group filtering
- `processItemChunks()`: Processes chunks with specific strategies and configurations

## Testing

The method is thoroughly tested with the following test cases:
- Returns empty array when no chunks exist
- Returns single group when all chunks have the same group
- Returns multiple groups when chunks have different groups
- Filters out empty or null group values

Tests are located in: `knowledgeBase/knowledgeImport/__tests__/library-getDenseVectorIndexGroup.test.ts`