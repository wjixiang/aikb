# MongoDB to PostgreSQL Quiz Migration Script

This script migrates quiz data from MongoDB to PostgreSQL using Prisma.

## Features

- Migrates all quiz types (A1, A2, A3, B, X) from MongoDB to PostgreSQL
- Handles data transformation between MongoDB and Prisma schemas
- Batch processing for performance
- Error handling and logging
- Duplicate detection (skips already migrated quizzes)
- Progress tracking and summary reporting

## Prerequisites

1. MongoDB database with quiz data in the "quizzes" collection
2. PostgreSQL database with Prisma schema set up
3. Environment variables configured

## Environment Variables

Set the following environment variables:

```bash
# MongoDB connection
MONGODB_URI=mongodb://localhost:27017/aikb
DB_NAME=aikb

# PostgreSQL connection (configured via Prisma)
DATABASE_URL=postgresql://user:password@localhost:5432/database
```

## Usage

### Run the migration script directly:

```bash
npx tsx apps/medquiz/quiz-management-client/src/mongo_2_postgre_quiz_migrate.ts
```

### Or use as a module:

```typescript
import { migrateQuizzes } from './mongo_2_postgre_quiz_migrate'

// Run migration
await migrateQuizzes()
```

## Script Details

### Data Transformation

The script transforms MongoDB quiz data to match the Prisma schema:

- **A1/A2**: Single question with options and single answer
- **A3**: Main question with sub-questions, stored in `specific_data`
- **B**: Multiple questions with shared options, stored in `specific_data`
- **X**: Single question with multiple correct answers

### Batch Processing

- Processes quizzes in batches of 100 (configurable via `BATCH_SIZE`)
- Shows progress for each batch
- Provides detailed summary at the end

### Error Handling

- Skips quizzes that already exist in PostgreSQL
- Logs errors for individual quiz failures
- Continues processing even if some quizzes fail
- Provides summary of successful vs failed migrations

## Output Example

```
Starting quiz migration from MongoDB to PostgreSQL...
Found 1500 quizzes to migrate
Processing batch 1/15 (100 quizzes)
Successfully migrated quiz 507f1f77bcf86cd799439011 (A1)
Successfully migrated quiz 507f1f77bcf86cd799439012 (A2)
Quiz 507f1f77bcf86cd799439013 already exists, skipping...
...

=== Migration Summary ===
Total processed: 1500
Successfully migrated: 1498
Errors/skipped: 2
Migration completed!
```

## Configuration

You can modify these constants in the script:

- `BATCH_SIZE`: Number of quizzes to process in each batch (default: 100)
- `MONGODB_COLLECTION_NAME`: MongoDB collection name (default: "quizzes")

## Notes

- The script uses the MongoDB connection utility from the bibliography library
- Prisma client is automatically disconnected after migration
- MongoDB connection is properly closed after migration
- All JSON fields are properly handled for PostgreSQL compatibility