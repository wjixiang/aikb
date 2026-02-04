# PubMed Mirror Scripts

This directory contains scripts for syncing PubMed data from OSS to the database.

## Scripts

### sync_oss_to_db.ts

Syncs all baseline files for a specified year from OSS to the database.

**Usage:**

```bash
# Using npm script
npm run sync:oss-to-db 2024

# Or using tsx directly
npx tsx libs/pubmedMirror/src/scripts/sync_oss_to_db.ts 2024
```

**Arguments:**

- `year` - 4-digit year (e.g., 2024)

**Example:**

```bash
npm run sync:oss-to-db 2024
```

**Output:**

- Lists all files found for the specified year
- Shows progress for each file processed
- Displays summary with total articles, success count, and failed count

### sync_file_to_db.ts

Syncs a single baseline file from OSS to the database.

**Usage:**

```bash
# Using npm script
npm run sync:file-to-db 2024 pubmed24n0001.xml.gz

# Or using tsx directly
npx tsx libs/pubmedMirror/src/scripts/sync_file_to_db.ts 2024 pubmed24n0001.xml.gz
```

**Arguments:**

- `year` - 4-digit year (e.g., 2024)
- `filename` - Name of the baseline file (e.g., pubmed24n0001.xml.gz)

**Example:**

```bash
npm run sync:file-to-db 2024 pubmed24n0001.xml.gz
```

**Output:**

- Shows progress for the file being processed
- Displays summary with total articles, success count, and failed count
- Lists any failed articles with error messages

## Environment Variables

These scripts require the following environment variables to be set (typically in `.env` file):

```bash
# Database connection
DATABASE_URL=postgresql://user:password@host:port/database

# OSS/S3 configuration
MIRROR_BUCKET_NAME=pubmed-mirror
S3_ENDPOINT=https://oss-cn-beijing.aliyuncs.com
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_REGION=oss-cn-beijing
```

## Data Flow

```
OSS (S3) → Download → Decompress → Parse XML → Transform → Database
```

1. **Download**: Fetches gzipped XML files from OSS
2. **Decompress**: Gunzips the file content
3. **Parse**: Uses fast-xml-parser to parse XML
4. **Transform**: Converts parsed data to database format
5. **Database**: Uses Prisma to insert/update records

## Error Handling

- Scripts exit with code 1 if any errors occur
- Database connection is properly closed on exit
- Failed articles are logged with error messages
- Progress is displayed during processing

## Notes

- The scripts use the existing `syncBaselineFileToDb` and `syncFileToDb` functions from `db-storage.ts`
- Journal records are automatically created if they don't exist (based on `nlmUniqueId`)
- Existing articles are updated with new data
- The process is batched for better performance
