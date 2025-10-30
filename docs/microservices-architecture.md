# Library Microservices Architecture

## Overview

The original monolithic `bibliograph-server` has been converted into a microservices architecture with the following services:

## Services

### 1. Library API Gateway (Port 3000)
- **Purpose**: Single entry point for all client requests
- **Responsibilities**: Request routing, load balancing, API aggregation
- **Endpoints**: All original endpoints from the monolith
- **Technology**: NestJS with HTTP client for service communication

### 2. Library Metadata Service (Port 3001)
- **Purpose**: Manage library item metadata
- **Responsibilities**: 
  - Create library items
  - Delete library items
  - Retrieve library item metadata
- **Endpoints**:
  - `POST /api/library-items` - Create new library item
  - `DELETE /api/library-items` - Delete library item
  - `GET /api/library-items/:id` - Get library item by ID

### 3. Library Content Service (Port 3002)
- **Purpose**: Manage markdown content for library items
- **Responsibilities**:
  - Update markdown content
  - Retrieve markdown content
- **Endpoints**:
  - `PUT /api/library-items/markdown` - Update markdown content
  - `GET /api/library-items/:id/markdown` - Get markdown content

### 4. Library Storage Service (Port 3003)
- **Purpose**: Handle file storage operations
- **Responsibilities**:
  - Upload PDF files
  - Download PDF files
  - Generate download URLs
- **Endpoints**:
  - `POST /api/library-items/upload` - Upload PDF file
  - `GET /api/library-items/:id/download` - Download PDF file
  - `GET /api/library-items/:id/download-url` - Get download URL

## Shared Library

### Library Shared (`@aikb/library-shared`)
- **Purpose**: Common DTOs and interfaces shared across services
- **Contents**:
  - `CreateLibraryItemDto`
  - `DeleteLibraryItemDto`
  - `UpdateMarkdownDto`
  - Common types and interfaces

## Service Communication

### HTTP Communication
- Services communicate via HTTP REST APIs
- API Gateway acts as a proxy/router
- Each service has its own database/storage layer

### Service URLs
- API Gateway: `http://localhost:3000`
- Metadata Service: `http://localhost:3001`
- Content Service: `http://localhost:3002`
- Storage Service: `http://localhost:3003`

## Data Flow

1. **Create Library Item**:
   - Client → API Gateway → Metadata Service
   - Metadata Service stores metadata in Elasticsearch

2. **Upload PDF**:
   - Client → API Gateway → Storage Service
   - Storage Service stores file in S3

3. **Update Markdown**:
   - Client → API Gateway → Content Service
   - Content Service updates markdown in storage

4. **Get Library Item**:
   - Client → API Gateway → Metadata Service
   - Metadata Service retrieves from Elasticsearch

## Deployment

### Environment Variables
- `METADATA_SERVICE_URL`: URL of metadata service (default: http://localhost:3001)
- `CONTENT_SERVICE_URL`: URL of content service (default: http://localhost:3002)
- `STORAGE_SERVICE_URL`: URL of storage service (default: http://localhost:3003)
- `PORT`: Service port (each service has different default)

### Running Services

```bash
# Start all services
nx serve library-metadata-service
nx serve library-content-service
nx serve library-storage-service
nx serve library-api-gateway
```

## Benefits of Microservices Architecture

1. **Scalability**: Each service can be scaled independently
2. **Maintainability**: Smaller, focused codebases
3. **Technology Diversity**: Different services can use different technologies
4. **Fault Isolation**: Failure in one service doesn't affect others
5. **Team Autonomy**: Different teams can work on different services

## Migration from Monolith

The original `bibliograph-server` functionality has been distributed as follows:

| Original Controller | New Service |
|-------------------|-------------|
| `createLibraryItem` | Metadata Service |
| `deleteLibraryItem` | Metadata Service |
| `updateLibraryItemMarkdown` | Content Service |
| `getLibraryItem` | Metadata Service |
| PDF operations | Storage Service |

## Future Enhancements

1. **Service Discovery**: Add service registry for dynamic service discovery
2. **Load Balancing**: Implement load balancing for high availability
3. **Circuit Breaker**: Add circuit breaker pattern for fault tolerance
4. **Distributed Tracing**: Implement request tracing across services
5. **Event-Driven Architecture**: Add event bus for asynchronous communication