# Interactive Search Tool

This is an interactive command-line tool for searching library items and performing semantic search using the knowledge base library module.

## Features

- **Item Listing**: List library items with optional filtering by query, tags, authors, and file type
- **Interactive Mode**: Browse items and perform actions on them
- **Semantic Search**: Perform semantic search across all items or within specific items
- **Chunk Viewing**: View and explore content chunks of items

## Installation

The tool is part of the knowledge base project. Make sure you have all dependencies installed:

```bash
pnpm install
```

## Usage

### Running the Interactive Mode

```bash
pnpm search interactive
```

Or directly:

```bash
node knowledgeBase/cli/interactive-search.js interactive
```

This will start the interactive mode where you can:
- List and select items
- Perform semantic search
- View item details and chunks

### Listing Items

List all items:

```bash
pnpm search list
```

List items with filters:

```bash
# Search by query
pnpm search list --query "machine learning"

# Filter by tags
pnpm search list --tags "ai,ml,research"

# Filter by authors
pnpm search list --authors "Smith,Johnson"

# Filter by file type
pnpm search list --file-type "pdf,article"

# Run in interactive mode after listing
pnpm search list --interactive
```

### Semantic Search

Perform semantic search across all items:

```bash
pnpm search search --query "neural networks"
```

Search with custom parameters:

```bash
# Limit results and set similarity threshold
pnpm search search --query "deep learning" --limit 5 --threshold 0.8

# Search within a specific item
pnpm search search --query "transformers" --item-id "item-id-here"
```

## Commands

### `list`

List library items with optional filtering.

**Options:**
- `-q, --query <query>`: Search query for title, abstract, or notes
- `-t, --tags <tags>`: Filter by tags (comma-separated)
- `-a, --authors <authors>`: Filter by authors (comma-separated)
- `-f, --file-type <fileType>`: Filter by file type (comma-separated)
- `-i, --interactive`: Run in interactive mode

### `search`

Perform semantic search across all items.

**Options:**
- `-q, --query <query>`: Search query
- `-l, --limit <limit>`: Maximum number of results (default: 10)
- `-t, --threshold <threshold>`: Similarity threshold (0-1, default: 0.7)
- `--item-id <itemId>`: Search within specific item

### `interactive`

Run in interactive mode with a menu-driven interface.

## Examples

### Example 1: Interactive Search

```bash
pnpm search interactive
```

This will show a menu:
```
? 请选择操作:
❯ 📚 列出并选择项目
  🔍 语义搜索
  ❌ 退出
```

### Example 2: Find Items About Machine Learning

```bash
pnpm search list --query "machine learning" --interactive
```

### Example 3: Semantic Search for Neural Networks

```bash
pnpm search search --query "neural networks" --limit 5 --threshold 0.8
```

## Configuration

The tool uses the following environment variables:

- `ELASTICSEARCH_URL`: Elasticsearch server URL (default: http://elasticsearch:9200)
- `ELASTICSEARCH_URL_API_KEY`: Elasticsearch API key (optional)
- `PDF_OSS_BUCKET_NAME`: S3 bucket name for PDF storage
- `VECTOR_DIMENSIONS`: Vector dimensions for embeddings (default: 1024)
  - Use 1024 for Alibaba text-embedding-v3 model
  - Use 1536 for OpenAI text-embedding-ada-002 model
- Embedding service configuration (OpenAI, Alibaba, etc.)

Make sure your `.env` file is properly configured with these variables.

### Vector Dimensions Configuration

If you encounter a "Vector dimensions mismatch" error, it means the embedding model used for queries doesn't match the model used to create the stored chunks. Set the appropriate vector dimensions:

```bash
# For OpenAI embeddings (1536 dimensions)
export VECTOR_DIMENSIONS=1536

# For Alibaba embeddings (1024 dimensions)
export VECTOR_DIMENSIONS=1024
```

## Troubleshooting

### Common Issues

1. **"Failed to initialize library"**: Check your Elasticsearch and S3 configuration
2. **"Failed to generate embedding for query"**: Check your embedding service configuration
3. **"No items found"**: Make sure you have items in your library with processed chunks

### Debug Mode

Set the `SYSTEM_LOG_LEVEL` environment variable to see detailed logs:

```bash
SYSTEM_LOG_LEVEL=3 pnpm search interactive
```

## Development

The tool is implemented in TypeScript and uses the following main components:

- `Library` class from `knowledgeImport/library.ts`
- `S3ElasticSearchLibraryStorage` for data persistence
- `embeddingService` for semantic search
- `inquirer` for interactive prompts
- `chalk` for colored output
- `cli-table3` for formatted tables

To modify the tool, edit the `knowledgeBase/cli/interactive-search.ts` file.