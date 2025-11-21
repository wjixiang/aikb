# Variable-Length Vector Support Implementation Plan

## Current Analysis

The system currently uses PostgreSQL with pgvector extension and has a fixed 1024-dimensional vector constraint in the `item_chunks` table.

### Current Issues:
1. **Fixed Dimension**: `embedding Unsupported("vector(1024)")?` in Prisma schema
2. **SQL Migration**: Hard-coded `vector(1024)` in migration scripts
3. **Inflexibility**: Cannot support different embedding models with varying dimensions

## Solution: Variable-Length Vector Support

### 1. Database Schema Changes

**Current Schema:**
```prisma
embedding Unsupported("vector(1024)")?  // Fixed 1024 dimensions
```

**Proposed Schema:**
```prisma
embedding Unsupported("vector")?  // Variable-length vectors
```

### 2. SQL Migration Strategy

Create a new migration file to alter the column type:

```sql
-- Migration: Make embedding column support variable-length vectors
ALTER TABLE item_chunks 
ALTER COLUMN embedding TYPE vector 
USING embedding::vector;

-- Recreate indexes for better performance
DROP INDEX IF EXISTS item_chunks_embedding_vector_idx;
CREATE INDEX IF NOT EXISTS item_chunks_embedding_vector_idx 
ON item_chunks 
USING ivfflat (embedding vector_cosine_ops);
```

### 3. TypeScript Interface Updates

The current `ItemChunk` interface already supports variable-length arrays:
```typescript
embedding: number[]; // Already flexible - no changes needed
```

### 4. Code Changes Required

#### A. Prisma Schema Update
- Change `Unsupported("vector(1024)")` to `Unsupported("vector")`

#### B. SQL Migration Script
- Create new migration for variable-length vectors
- Update existing migration files

#### C. Vector Storage Implementation
- No changes needed in [`prisma-item-vector-storage.ts`](libs/item-vector-storage/src/lib/prisma-item-vector-storage.ts) - it already handles variable-length arrays

#### D. Test Updates
- Update test files that assume 1024 dimensions
- Add tests for different vector dimensions

### 5. Migration Steps

1. **Backup Database**: Always backup before schema changes
2. **Apply Schema Changes**: Update Prisma schema and generate migration
3. **Update SQL Scripts**: Modify migration files
4. **Regenerate Prisma Client**: Run `prisma generate`
5. **Test Implementation**: Verify with different embedding dimensions

### 6. Benefits

- **Flexibility**: Support any embedding model dimension (384, 768, 1024, 1536, etc.)
- **Future-proof**: No need for future migrations when changing embedding models
- **Backward Compatible**: Existing 1024-dim vectors continue to work
- **Performance**: pgvector handles variable-length vectors efficiently

### 7. Implementation Files to Modify

1. [`libs/bibliography-db/src/prisma/schema.prisma`](libs/bibliography-db/src/prisma/schema.prisma:152) - Update embedding field
2. [`libs/bibliography-db/migrations/add_vector_indexes.sql`](libs/bibliography-db/migrations/add_vector_indexes.sql:10) - Update SQL migration
3. Test files that hardcode 1024 dimensions
4. Documentation updates

### 8. Testing Strategy

- Test with different embedding dimensions (384, 768, 1024, 1536)
- Verify similarity search works with mixed dimensions
- Performance testing with various vector sizes
- Migration testing from fixed to variable-length

This approach provides the most flexibility while maintaining compatibility with existing data and requiring minimal code changes.