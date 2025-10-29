# Bibliograph Server API Documentation

This document describes the LibraryItem API endpoints implemented in the bibliograph-server.

## Base URL
```
http://localhost:3000/api
```

## LibraryItem Endpoints

### 1. Create LibraryItem
**POST** `/library-items`

Creates a new library item with the provided metadata.

**Request Body:**
```json
{
  "title": "string",
  "authors": [
    {
      "firstName": "string",
      "lastName": "string",
      "middleName": "string (optional)"
    }
  ],
  "abstract": "string (optional)",
  "publicationYear": "number (optional)",
  "publisher": "string (optional)",
  "isbn": "string (optional)",
  "doi": "string (optional)",
  "url": "string (optional)",
  "tags": ["string"],
  "notes": "string (optional)",
  "collections": ["string"],
  "fileType": "pdf|article|book|other",
  "s3Key": "string (optional)",
  "fileSize": "number (optional)",
  "pageCount": "number (optional)",
  "language": "string (optional)",
  "contentHash": "string (optional)",
  "markdownContent": "string (optional)"
}
```

**Response:**
```json
{
  "id": "string",
  "title": "string",
  "authors": [...],
  "dateAdded": "string",
  "dateModified": "string",
  // ... other fields
}
```

### 2. Delete LibraryItem
**DELETE** `/library-items`

Deletes a library item by ID.

**Request Body:**
```json
{
  "id": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Library item with ID {id} has been successfully deleted"
}
```

### 3. Update LibraryItem Markdown
**PUT** `/library-items/markdown`

Updates the markdown content for a library item.

**Request Body:**
```json
{
  "id": "string",
  "markdownContent": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Markdown content for library item with ID {id} has been successfully updated"
}
```

### 4. Get LibraryItem
**GET** `/library-items/:id`

Retrieves a library item by ID.

**Response:**
```json
{
  "id": "string",
  "title": "string",
  "authors": [...],
  "dateAdded": "string",
  "dateModified": "string",
  // ... other fields
}
```

## Error Responses

All endpoints return appropriate HTTP status codes and error messages:

- **400 Bad Request**: Invalid input data or validation errors
- **404 Not Found**: Library item not found
- **500 Internal Server Error**: Server-side errors

## Example Usage

### Create a LibraryItem
```bash
curl -X POST http://localhost:3000/api/library-items \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Sample Book",
    "authors": [
      {
        "firstName": "John",
        "lastName": "Doe"
      }
    ],
    "abstract": "This is a sample book",
    "publicationYear": 2023,
    "publisher": "Sample Publisher",
    "tags": ["sample", "book"],
    "collections": ["collection1"],
    "fileType": "book"
  }'
```

### Update Markdown Content
```bash
curl -X PUT http://localhost:3000/api/library-items/markdown \
  -H "Content-Type: application/json" \
  -d '{
    "id": "your-item-id",
    "markdownContent": "# Sample Book\n\nThis is the markdown content."
  }'
```

### Delete a LibraryItem
```bash
curl -X DELETE http://localhost:3000/api/library-items \
  -H "Content-Type: application/json" \
  -d '{
    "id": "your-item-id"
  }'
```

### Get a LibraryItem
```bash
curl -X GET http://localhost:3000/api/library-items/your-item-id
```

## Implementation Details

The API is built using:
- **NestJS** framework for the server
- **class-validator** and **class-transformer** for DTO validation
- **S3ElasticSearchLibraryStorage** for data persistence
- **ItemMetadata** type from the bibliography library

All endpoints include proper error handling and validation to ensure data integrity.