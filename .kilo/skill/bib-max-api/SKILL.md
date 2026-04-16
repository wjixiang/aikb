---
name: bib-max-api
description: >-
  This skill should be used when interacting with the Bib Max literature management system API at http://192.168.123.98:5000. The API provides literature/book CRUD, intelligent tagging, batch operations, PDF attachment management, AI copilot chat, and metadata extraction from PDFs.
---

# Bib Max API Skill

This skill provides guidance for interacting with the Bib Max literature/book management system API.

## Base URL

```
http://192.168.123.98:5000/api
```

API documentation available at `/docs` (Swagger UI).

## API Structure

The API is organized into these resource groups:

- **Items** - Literature/book CRUD, search, batch operations
- **Attachments** - File upload/download, PDF to Markdown conversion
- **Tags** - Tag management for categorizing items
- **Chat** - AI copilot integration via A2A messaging

## Common Headers

```json
{
  "Content-Type": "application/json"
}
```

## Error Handling

| Status Code | Meaning |
|-------------|---------|
| 400 | Bad Request - Validation error |
| 404 | Not Found - Entity not found |
| 502 | Upstream Error - Agent/runtime error |

Error response format:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation error"
}
```

## Item Endpoints

Base path: `/api/items`

### List Items
```
GET /items
```
Query parameters:
- `page` (number, optional) - Page number
- `pageSize` (number, optional, max 100) - Items per page
- `type` (string, optional) - Filter by "article" or "book"
- `search` (string, optional) - Keyword search
- `tagIds` (string[], optional) - Filter by tag IDs
- `isFavorite` (boolean, optional) - Filter favorites
- `sortBy` (string, optional) - Sort field: "createdAt", "updatedAt", "year", "title"
- `sortOrder` (string, optional) - "asc" or "desc"

Response:
```json
{
  "data": [{ "id": "uuid", "type": "article", "title": "...", ... }],
  "pagination": { "page": 1, "pageSize": 20, "total": 100, "totalPages": 5 }
}
```

### Create Item
```
POST /items
```
Body:
```json
{
  "type": "article",
  "title": "Paper Title",
  "authors": ["Author 1", "Author 2"],
  "abstract": "...",
  "year": 2024,
  "doi": "10.xxxx/xxxxx",
  "pmid": "12345678",
  "source": "Journal Name",
  "tagIds": ["uuid1", "uuid2"]
}
```

### Get Item
```
GET /items/:id
```

### Update Item
```
PUT /items/:id
```
Body: Same as Create Item (all fields optional)

### Delete Item
```
DELETE /items/:id
```
Response: `{ "success": true, "id": "uuid" }`

### Set Item Tags
```
PATCH /items/:id/tags
```
Body: `{ "tagIds": ["uuid1", "uuid2"] }`

### Batch Operations
```
POST /items/batch
```
Body:
```json
{
  "itemIds": ["uuid1", "uuid2"],
  "operation": "addTags|removeTags|setTags|delete|toggleFavorite",
  "tagIds": ["uuid1"]
}
```
Response: `{ "success": true, "updated": 2, "deleted": 0 }`

### Extract Metadata from PDF
```
POST /items/extract-metadata
```
Content-Type: `multipart/form-data`
Body: PDF file
Response:
```json
{
  "title": "Extracted Title",
  "authors": ["Author 1"],
  "abstract": "...",
  "year": 2024,
  "source": "...",
  "doi": "...",
  "type": "article"
}
```

## Attachment Endpoints

Base path: `/api/items/:itemId/attachments`

### Get Upload URL (Presigned)
```
POST /items/:itemId/attachments/upload-url
```
Body:
```json
{
  "fileName": "document.pdf",
  "contentType": "application/pdf"
}
```
Response:
```json
{
  "attachmentId": "uuid",
  "url": "https://s3.../presigned-url",
  "expiresAt": "2024-01-01T00:00:00Z"
}
```
Flow: 1) Get presigned URL, 2) Upload file directly to S3 using URL, 3) Confirm upload

### Confirm Upload
```
POST /items/:itemId/attachments
```
Body:
```json
{
  "attachmentId": "uuid",
  "fileName": "document.pdf",
  "contentType": "application/pdf",
  "fileSize": 1024000
}
```

### List Attachments
```
GET /items/:itemId/attachments
```

### Get Download URL
```
GET /items/:itemId/attachments/:id/download
```
Response: `{ "url": "https://s3.../download-url", "expiresAt": "..." }`

### Delete Attachment
```
DELETE /items/:itemId/attachments/:id
```

### Convert PDF to Markdown
```
POST /items/:itemId/attachments/convert-to-md
```
Body: `{ "attachmentId": "uuid" }`
Response: New attachment object with Markdown file

## Tag Endpoints

Base path: `/api/tags`

### List Tags
```
GET /tags
```
Query parameters:
- `page`, `pageSize` - Pagination
- `search` (string, optional) - Search by name
- `withCount` (boolean, optional) - Include item count per tag

### Create Tag
```
POST /tags
```
Body: `{ "name": "Machine Learning", "color": "#ff0000", "description": "ML papers" }`

### Get Tag
```
GET /tags/:id
```

### Update Tag
```
PUT /tags/:id
```
Body: `{ "name": "...", "color": "...", "description": "..." }`

### Delete Tag
```
DELETE /tags/:id
```

## Chat Endpoints

Base path: `/api/chat`

### Send Message
```
POST /chat/messages
```
Body:
```json
{
  "message": "Summarize this paper",
  "context": {
    "route": "/items/detail",
    "itemId": "uuid",
    "attId": "uuid"
  }
}
```
Response: `{ "success": true, "data": { "content": "..." } }`

### Stream Response (SSE)
```
POST /chat/messages/stream
```
Body: Same as Send Message
Response: SSE events - `agent.status`, `message.added`, `tool.started`, `tool.completed`, `completed`, `error`

### Get Chat History
```
GET /chat/history
```
Response: `{ "messages": [{ "role": "user|assistant|system", "content": [...], "ts": 123456 }] }`

### Get Copilot Status
```
GET /chat/status
```
Response: `{ "status": "idle|running", "agentId": "uuid" }`

## Attachment Categories

When attachments are returned, they include a `category` field based on MIME type:

| Category | MIME Types |
|----------|------------|
| pdf | application/pdf |
| image | image/* |
| video | video/* |
| audio | audio/* |
| markdown | text/markdown, text/x-markdown |
| document | .doc, .docx, .xls, .xlsx, .ppt, .pptx |
| archive | .zip, .rar, .7z, .tar, .gz |
| code | .json, .xml, .yaml, .py, .js, .ts, .sql |
| text | text/plain |
| unknown | other |

## Data Models

### Item
```json
{
  "id": "uuid",
  "type": "article|book",
  "title": "string",
  "subtitle": "string|null",
  "authors": ["string"],
  "abstract": "string|null",
  "year": "number|null",
  "source": "string|null",
  "doi": "string|null",
  "isbn": "string|null",
  "pmid": "string|null",
  "url": "string|null",
  "coverUrl": "string|null",
  "notes": "string|null",
  "isFavorite": "boolean",
  "rating": "number|null (1-5)",
  "customMeta": "object|null",
  "createdAt": "date",
  "updatedAt": "date",
  "tags": [{ "id": "uuid", "name": "string", "color": "string|null" }]
}
```

### Tag
```json
{
  "id": "uuid",
  "name": "string",
  "color": "string|null",
  "description": "string|null",
  "createdAt": "date",
  "itemCount": "number (if withCount=true)"
}
```

### Attachment
```json
{
  "id": "uuid",
  "itemId": "uuid",
  "fileName": "string",
  "fileType": "string (MIME type)",
  "fileSize": "number|null",
  "category": "string",
  "createdAt": "date"
}
```

## Workflows

### Adding a New Paper with PDF

1. Upload PDF and extract metadata:
   ```
   POST /api/items/extract-metadata
   ```
2. Create item with extracted data:
   ```
   POST /api/items
   { "title": "...", "authors": [...], "year": 2024, ... }
   ```
3. Get presigned upload URL:
   ```
   POST /api/items/{itemId}/attachments/upload-url
   { "fileName": "paper.pdf", "contentType": "application/pdf" }
   ```
4. Upload file to S3 (direct to presigned URL)
5. Confirm upload:
   ```
   POST /api/items/{itemId}/attachments
   { "attachmentId": "...", "fileName": "paper.pdf", "contentType": "application/pdf", "fileSize": 1234567 }
   ```

### Categorizing Items with Tags

1. Create or get existing tags:
   ```
   POST /api/tags
   { "name": "Machine Learning", "color": "#4CAF50" }
   ```
2. Set tags on item:
   ```
   PATCH /api/items/{itemId}/tags
   { "tagIds": ["tag-uuid-1", "tag-uuid-2"] }
   ```
3. Or use batch operation:
   ```
   POST /api/items/batch
   { "itemIds": [...], "operation": "addTags", "tagIds": [...] }
   ```

### Converting PDF to Markdown

1. Ensure attachment exists and is a PDF
2. Convert:
   ```
   POST /api/items/{itemId}/attachments/convert-to-md
   { "attachmentId": "attachment-uuid" }
   ```
3. New Markdown attachment is created automatically under same item
