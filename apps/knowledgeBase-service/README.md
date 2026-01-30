# Knowledge Base API Service

## Overview

This is a NestJS-based API service for managing knowledge base entities, vertices, properties, edges, and version control operations.

## Features

- **Entity Management**: CRUD operations for knowledge entities with nomenclature and abstract data
- **Vertex Management**: Manage knowledge graph vertices with content and metadata
- **Property Management**: Handle property data storage and retrieval
- **Edge Management**: Manage relationships between entities, vertices, and properties
- **Search**: Text-based search and vector similarity search
- **Version Control**: Git-style version control for knowledge data
- **Event-Driven Architecture**: Event sourcing and audit trails

## API Endpoints

### Entities
- `POST /entities` - Create new entity
- `GET /entities/:id` - Get entity by ID
- `GET /entities` - Get all entities (with pagination)
- `PUT /entities/:id` - Update entity
- `DELETE /entities/:id` - Delete entity
- `GET /entities/:id/exists` - Check if entity exists

### Vertices
- `POST /vertices` - Create new vertex
- `GET /vertices/:id` - Get vertex by ID
- `GET /vertices` - Get all vertices (with pagination)
- `PUT /vertices/:id` - Update vertex
- `DELETE /vertices/:id` - Delete vertex
- `GET /vertices/:id/exists` - Check if vertex exists

### Properties
- `POST /properties` - Create new property
- `GET /properties/:id` - Get property by ID
- `GET /properties` - Get all properties (with pagination)
- `PUT /properties/:id` - Update property
- `DELETE /properties/:id` - Delete property
- `GET /properties/:id/exists` - Check if property exists

### Edges
- `POST /edges` - Create new edge
- `GET /edges/:id` - Get edge by ID
- `GET /edges` - Get all edges (with pagination)
- `PUT /edges/:id` - Update edge
- `DELETE /edges/:id` - Delete edge
- `GET /edges/:id/exists` - Check if edge exists
- `GET /edges/by-type/:type` - Find edges by type
- `GET /edges/by-nodes/:inId/:outId` - Find edges between nodes

### Search
- `POST /search` - Search all data types
- `GET /search/entities` - Search entities
- `GET /search/similar` - Find similar entities by vector

### Version Control
- `POST /version-control/branches` - Create branch
- `GET /version-control/branches` - List branches
- `GET /version-control/branches/:name` - Get branch details
- `POST /version-control/commits` - Create commit
- `GET /version-control/commits` - List commits
- `GET /version-control/commits/:id` - Get commit details
- `POST /version-control/merge` - Merge branches
- `PUT /version-control/branches/:name/checkout` - Checkout branch
- `POST /version-control/tags` - Create tag
- `GET /version-control/tags` - List tags
- `GET /version-control/history/:entityId` - Get entity history
- `POST /version-control/revert/:commitId` - Revert commit

## Data Models

### Entity
```json
{
  "nomenclature": [
    {
      "name": "Artificial Intelligence",
      "acronym": "AI",
      "language": "en"
    }
  ],
  "abstract": {
    "description": "The simulation of human intelligence in machines",
    "embedding": {
      "model": "text-embedding-ada-002",
      "dimensions": 1536,
      "vector": [0.1, 0.2, 0.3, ...]
    }
  }
}
```

### Vertex
```json
{
  "content": "Machine Learning",
  "type": "concept",
  "metadata": {
    "category": "technology"
  }
}
```

### Property
```json
{
  "content": "Property value"
}
```

### Edge
```json
{
  "type": "start",
  "in": "entity-id",
  "out": "vertex-id"
}
```

## Running the Application

```bash
# Install dependencies
npm install

# Run in development mode
npm run start:dev

# Run in production mode
npm run start:prod

# Run tests
npm test
```

## Architecture

The application follows an event-driven architecture with:

- **Controllers**: Handle HTTP requests and responses
- **Services**: Business logic and orchestration
- **Storage**: In-memory storage implementations
- **Event Bus**: Event publishing and subscription
- **Version Control**: Git-style version management

## Technology Stack

- **Framework**: NestJS
- **Language**: TypeScript
- **Validation**: class-validator
- **Storage**: In-memory (for development)
- **Events**: Custom event bus implementation
- **Version Control**: Git-style implementation

## Development

The project uses Nx for monorepo management. All services are fully tested with unit tests and integration tests.

## Next Steps

1. Add persistent storage (database integration)
2. Implement authentication and authorization
3. Add rate limiting and caching
4. Implement real-time updates (WebSocket)
5. Add API versioning
6. Deploy to production environment