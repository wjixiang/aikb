# PrismaReviewStorage Integration Tests

## Overview

The integration tests for `PrismaReviewStorage` are located in [`prismaStorage.spec.ts`](./prismaStorage.spec.ts). These tests use the actual Prisma client without mocking to verify the storage implementation works correctly with a real database.

## Test Structure

The tests are organized into the following categories:

### 1. CRUD Operations

- **Create**: Verifies creating new reviews with all fields
- **Read**: Tests finding reviews by ID, multiple IDs, and handling non-existent reviews
- **Update**: Validates updating review fields
- **Delete**: Tests both hard and soft delete operations

### 2. Upsert Operations

- **Create on no match**: Creates new review when no match is found
- **Update on match**: Updates existing review when match is found by DOI
- **Match by database IDs**: Tests matching by database identifiers
- **Force update**: Tests the forceUpdate option
- **Bulk upsert**: Tests batch upsert operations

### 3. Query Operations

- **Search with filters**: Tests complex filtering and pagination
- **Full text search**: Tests text-based search functionality
- **Find by database ID**: Tests lookup by database identifiers
- **Find by DOI/PMID/CochraneID**: Tests lookup by various IDs
- **Find by database source**: Tests filtering by data source
- **Find by review type**: Tests filtering by review type
- **Find by publication status**: Tests filtering by status
- **Find by evidence quality**: Tests filtering by quality
- **Find by author**: Tests searching by author name
- **Find by journal**: Tests searching by journal name
- **Find by MeSH term**: Tests filtering by MeSH terms
- **Find by keyword**: Tests filtering by keywords
- **Find all with pagination**: Tests pagination
- **Count**: Tests counting with filters
- **Exists**: Tests existence check

### 4. Duplicate Detection

- **Detect potential duplicates**: Tests similarity-based duplicate detection
- **Mark as duplicates**: Tests marking reviews as duplicates
- **Unmark as duplicates**: Tests removing duplicate marks

### 5. Statistics and Analytics

- **Get overall statistics**: Tests aggregate statistics
- **Get aggregated stats by field**: Tests field-based aggregation
- **Get time series data**: Tests time-series data retrieval

### 6. Health and Maintenance

- **Get health status**: Tests database health check
- **Validate data integrity**: Tests data validation

### 7. Edge Cases and Error Handling

- **Minimal required fields**: Tests creating reviews with minimal data
- **Empty arrays**: Tests handling of empty array fields
- **Special characters**: Tests handling of special characters
- **Very long text**: Tests handling of long text fields
- **Concurrent creates**: Tests concurrent operations

## Running the Tests

### Prerequisites

1. **Database Connection**: The tests require a running PostgreSQL database with the schema created via Prisma migrations.

2. **Environment Setup**: Ensure the `.env` file contains the correct `DATABASE_URL`.

### Run Tests

```bash
# Run all integration tests
cd /workspace/libs/syntheses
npx vitest run src/storage/prismaStorage.spec.ts

# Run with verbose output
npx vitest run src/storage/prismaStorage.spec.ts --reporter=verbose

# Run specific test suite
npx vitest run src/storage/prismaStorage.spec.ts -t "CRUD Operations"
```

### Using Nx

```bash
# Run tests using Nx (if test target is configured)
nx test syntheses --testFile=prismaStorage.spec.ts
```

## Test Data

The tests use a `createTestReview()` helper function that generates realistic test data with:

- Multiple authors with roles
- Multiple database identifiers
- Journal information
- Eligibility criteria
- PICO framework elements
- Quality assessment with domain scores
- URLs with different access levels
- Sync metadata
- Related reviews

## Database Cleanup

Each test suite cleans up the database before running using the `beforeEach` hook:

```typescript
beforeEach(async () => {
  // Clean up database before each test
  await prisma.review_related_review.deleteMany({});
  await prisma.review_url.deleteMany({});
  // ... more cleanup
});
```

## Test Isolation

Tests are designed to be isolated:

- Each test creates its own data with unique DOIs using `Date.now()`
- Database is cleaned before each test
- Tests don't depend on execution order

## Known Limitations

1. **Database Required**: These tests require a real database connection and cannot run without one.

2. **Execution Time**: Integration tests are slower than unit tests due to database operations.

3. **Data Persistence**: Tests modify the database, so they should run against a test database, not production.

## Future Improvements

1. **Test Database**: Set up a separate test database with Docker Compose
2. **Fixtures**: Add more diverse test fixtures for edge cases
3. **Performance Tests**: Add tests for bulk operations performance
4. **Transaction Tests**: Test transaction rollback scenarios
5. **Migration Tests**: Test schema migration compatibility

## Troubleshooting

### Connection Timeout

If tests timeout on connection:

- Verify PostgreSQL is running
- Check `DATABASE_URL` in `.env`
- Ensure database exists and migrations are applied

### Hook Timeout

If hooks timeout:

- Increase timeout in vitest config: `hookTimeout: 30000`
- Check database performance
- Verify network connectivity

### Test Failures

If tests fail:

- Check database schema is up to date: `nx run syntheses-db:db-push`
- Review test logs for specific errors
- Ensure Prisma client is generated: `nx run syntheses-db:gen-client`
