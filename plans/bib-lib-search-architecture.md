# Bibliometric System search architecture

## Overview
Build a full-featured literature retrieval system for LLM agents with the following capabilities
- **Keyword search**: full-text search on title, abstract, meSH terms, chemicals
- **semantic search**: Vector similarity search using pgvector
- **hybrid search**: Combines keyword and semantic search with re-ranking
- **Filters**: by author, journal, publication year, date range, **sorting**: By relevance score
- **Pagination**: Cursor-based pagination with offset/limit
- **Facets**: Filter results by specific fields
- **Export**: multiple formats (JSON, Markdown, CSV, BibTeX)
## lLM agent integration
- **mcp tools**: Tools exposed via ToolComponent pattern for agents
- **rest api**: Alternative access method
- **gRPC**: high-performance service-to-service communication (optional)
- **GraphQL**: Further advanced query capabilities (optional)
- **Direct library usage**: Programmatic access from TypeScript/JavaScript
- **Testing**: Unit and integrated tests for search functionality

- **Documentation**: Architecture plan with diagrams

- **Implementation phases** with timeline
- **file structure** showing the needed
- **dependencies** table

- **configuration** section
- **pgvector migration** section
- **Mcp tools** section
- **search services** section
- **export** section
- **Testing** section
- **API & Documentation** sections
- **error handling** section
- **performance** section
- **security** section
- **deployment** section
            - Docker setup with pgvector extension
            - Environment configuration
            - Data migration scripts
            - Documentation
- **File structure**:
```
libs/bib-lib/src/
├── biblib.module.ts
├── biblib.controller.ts
├── biblib.service.ts
├── index.ts
├── prisma/
│   └── prisma.service.ts
├── sync/
│   ├── sync.module.ts
│   ├── sync.service.ts
│   ├── cli/
│   │   ├── sync.cli.ts
│   │   └── embed.cli.ts
├── parsers/
│   ├── pubmed.parser.ts
│   └── types.ts
└── embed/
    ├── embed.module.ts
    ├── embed.service.ts
    └── cli
        └── embed.cli.ts
```

src/generated/prisma/
│   ├── browser.ts
│   ├── client.ts
│   ├── commonInputTypes.ts
│   ├── enums.ts
│   ├── models.ts
│   └── internal/
│       ├── class.ts
│       └── prismaNamespace.ts
├── models/
│   ├── Article.ts
│   ├── ArticleEmbedding.ts
│   ├── ArticleId.ts
│   ├── Author.ts
│   ├── AuthorArticle.ts
│   ├── Chemical.ts
│   ├── Grant.ts
│   ├── Journal.ts
│   └── MeshHeading.ts
└── prisma/
    ├── prisma.module.ts
    └── prisma.service.ts
└── scripts
    └── ...
```

src/sync/sync.service.ts
    import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
    import { readdir } from 'node:fs/promises';
    import { join } from 'node:path';
    import { PrismaService } from '../prisma/prisma.service.js';
    import { PubmedParser } from './parsers/pubmed.parser.js';
    import type { ParsedArticle, SyncProgress, SyncOptions } from './parsers/types.js';

    ...
}
```

src/sync/embed/embed.service.ts
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Embedding, EmbeddingProvider, defaultEmbeddingConfig } from '@ai-embed/core';
...
```
## Current System analysis

Based on the analysis, I'll now design a comprehensive architecture for a full-featured literature retrieval system for LLM agents. Here's the architecture design:

## Architecture Overview

The system is designed as a multi-layer architecture with clear separation of concerns:
- **Data Layer**: PostgreSQL with Prisma ORM + pgvector extension
- **Service Layer**: NestJS modules for keyword, semantic, and hybrid search services
- **Agent Layer**: MCP tools for LLM agent integration
- **API Layer**: REST API and optional gRPC for external access
- **Integration Layer**: Connects to existing agent-lib framework

```mermaid
flowchart TD
    subgraph["Data Layer"]
        A[("PostgreSQL + Prisma")]
        B[("pgvector")]
    end
    
    subgraph["Service Layer"]
        C[("Search Services")
        B[("Embedding Service")
    end
    
    subgraph["Agent Layer"]
        D[("MCP Tools")
        E[("Tool Components")
    end
    
    subgraph["API Layer"]
        F[("REST API")]
        G[("Optional gRPC")
    end
```

## Data Model
The current Prisma schema has a well-designed structure for PubMed data:
 - **Article**: Main entity with PMID, title, language, publication type, dates
- **Journal**: ISSN, title, volume, issue, publication year
- **Author**: Name information with many-to-many relationship to articles
- **MeshHeading**: MeSH terms with qualifiers and major topic flags
- **Chemical**: Chemical substances with registry numbers
- **Grant**: Funding information
- **ArticleId**: External identifiers (DOI, PMC, PII)
- **ArticleEmbedding**: Vector embeddings with provider/model metadata

### Proposed Schema changes
1. **Add pgvector extension** to ArticleEmbedding model:
   ```prisma
   model ArticleEmbedding {
     ...
-    vector      Vector  // pgvector vector type
+    ...
+    isActive    Boolean  @default(true)
+    ...
   }
   ```

2. **Create search-specific services** in bib-lib:
- [`KeywordSearchService`](libs/bib-lib/src/search/keyword/keyword-search.service.ts) - Full-text search on title, abstract, meSH terms, chemicals
- [`SemanticSearchService`](libs/bib-lib/src/search/semantic/semantic-search.service.ts) - Vector similarity search using pgvector
- [`HybridSearchService`](libs/bib-lib/src/search/hybrid/hybrid-search.service.ts) - Combines keyword and semantic search with re-ranking
- [`SearchService`](libs/bib-lib/src/search/search.service.ts) - Unified search interface
- [`ArticleRepository`](libs/bib-lib/src/repositories/article.repository.ts) - Data access layer with caching

- [`SearchToolsComponent`](libs/bib-lib/src/components/search/search-tools.component.ts) - ToolComponent for agent-lib integration
- [`SearchSkill`](libs/bib-lib/src/skills/search.skill.ts) - Skill definition for agent skills
- [`SearchTypes`](libs/bib-lib/src/search/types.ts) - Type definitions for search queries and results
- [`SearchSchemas`](libs/bib-lib/src/search/schemas.ts) - Zod schemas for validation
- [`SearchUtils`](libs/bib-lib/src/search/utils.ts) - Utility functions for query building, pagination
- [`MCP Tool Definitions`](libs/bib-lib/src/mcp/search-mcp-tools.ts) - MCP tool implementations for agents
- [`Search MCP Server`](libs/bib-lib/src/mcp/search-mcp-server.ts) - MCP server implementation

- [`Search MCP Client`](libs/bib-lib/src/mcp/search-mcp-client.ts) - Client for MCP server

- [`MCP Types`](libs/bib-lib/src/mcp/types.ts) - Type definitions for MCP protocol
- [`MCP Resources`](libs/bib-lib/src/mcp/resources.ts) - Resource templates for MCP responses
- [`MCP Config](libs/bib-lib/src/mcp/mcp-config.ts) - Configuration for MCP server
- [`MCP Server Tests`](libs/bib-lib/src/mcp/__tests__/search-mcp-server.test.ts) - Tests for MCP server
- [`MCP Integration Tests`](libs/bib-lib/src/mcp/__tests__/search-mcp-client.test.ts) - Tests for MCP client
- [`Search Service Tests`](libs/bib-lib/src/search/__tests__/search-service.test.ts) - Tests for search services
- [`Hybrid Search Tests`](libs/bib-lib/src/search/__tests__/hybrid-search.test.ts) - Tests for hybrid search
- [`MCP Tool Tests`](libs/bib-lib/src/mcp/__tests__/search-mcp-tools.test.ts) - Tests for MCP tools
- [`Integration Tests`](libs/bib-lib/src/__tests__/integration.test.ts) - End-to-end integration tests
- [`Performance Tests`](libs/bib-lib/src/__tests__/performance.test.ts) - Performance benchmarks
- [`Migration Tests`](libs/bib-lib/src/__tests__/migration.test.ts) - Tests for JSON to pgvector migration
- [`E2E Tests`](libs/bib-lib/src/__tests__/e2e.test.ts) - End-to-end tests
- [`CLI Tests`](libs/bib-lib/src/__tests__/cli.test.ts) - Tests for CLI commands
- [`Documentation`](libs/bib-lib/docs/) - API documentation,- Architecture diagrams
- Usage examples
- Migration guide
- [`Configuration`](libs/bib-lib/src/config/) - Environment variables
- Search settings
- Embedding settings
- MCP server settings
- [`Dependencies`](libs/bib-lib/package.json) - New dependencies needed
- [`Scripts`](libs/bib-lib/scripts/) - Database migration script
- Seed data script
- Test data fixtures
- [`Docker`](libs/bib-lib/docker/) - Dockerfile for the service
- Docker Compose for development
- [`CI`](libs/bib-lib/src/cli/) - CLI for sync and embedding management
- [`Testing`](libs/bib-lib/src/__tests__/) - Unit tests, integration tests, e2e tests
- [`CI`](libs/bib-lib/src/cli/) - Command-line interface for sync and embedding
- [`Types`](libs/bib-lib/src/types.ts) - Shared type definitions
- [`Constants`](libs/bib-lib/src/constants.ts) - Application constants
- [`Utils`](libs/bib-lib/src/utils/) - Utility functions
- [`Config`](libs/bib-lib/src/config/config.ts) - Configuration management
- [`Logger`](libs/bib-lib/src/utils/logger.ts) - Logging utility
- [`Exceptions`](libs/bib-lib/src/utils/exceptions.ts) - Custom exceptions
- [`Pagination`](libs/bib-lib/src/utils/pagination.ts) - Pagination helpers
- [`Query Builder`](libs/bib-lib/src/utils/query-builder.ts) - Query construction utilities
- [`Date Utils`](libs/bib-lib/src/utils/date.ts) - Date parsing utilities
- [`Text Utils`](libs/bib-lib/src/utils/text.ts) - Text processing utilities
- [`Validation`](libs/bib-lib/src/utils/validation.ts) - Input validation
- [`Cache`](libs/bib-lib/src/utils/cache.ts) - Caching utilities
- **Tests**:
- `__tests__/` directory structure:
  - `unit/` - Unit tests for individual modules
  - `integration/` - Integration tests for service interactions
  - `e2e/` - End-to-end tests for API and database
  - `performance/` - Performance tests for search speed
  - `migration/` - Tests for JSON to pgvector migration
  - `mcp/` - Tests for MCP server and tools
  - `cli/` - Tests for CLI commands
- `search/` - Tests for search services
  - `hybrid/` - Tests for hybrid search
  - `utils/` - Tests for utility functions
- `config/` - Tests for configuration
- `types/` - Tests for type definitions
- `schemas/` - Tests for Zod schemas
- `repositories/` - Tests for repositories
  - `components/` - Tests for components
  - `skills/` - Tests for skills
  - `mcp/` - Tests for MCP integration

- `api/` - Tests for REST API (optional)
- `grpc/` - Tests for gRPC (optional)
- `docker/` - Tests for Docker setup
- `scripts/` - Tests for migration scripts
- `seed/` - Tests for seed data
- `cli/` - Tests for CLI commands
- `documentation/` - Tests for documentation examples
- `deployment/` - Tests for deployment configuration
- **Dependencies**:
- `@nestjs/common` - NestJS framework
- `@nestjs/core` - NestJS core
- `@prisma/client` - Prisma ORM
 - `@ai-embed/core` - Embedding library (existing)
- `zod` - Schema validation
- `pgvector` - PostgreSQL vector extension (new)
- `@modelcontextprotocol/sdk` - MCP SDK (new)
- `fast-xml-parser` - XML parsing
- `dotenv` - Environment variables
- `reflect-metadata` - TypeScript decorators
- `tslib` - TypeScript helpers
- `vitest` - Testing framework
- `tsx` - TypeScript execution
- **Configuration**:
- `BIB_DATABASE_URL` - PostgreSQL connection string
- `ALIBABA_api_key` - Alibaba embedding API key
- `openai_api_key` - OpenAI embedding API key (optional)
- `openai_api_base` - OpenAI API base URL (optional)
- `ollama_base_url` - Ollama base URL (optional)
- `mcp_server_port` - MCP server port (default: 3001)
- `mcp_server_host` - MCP server host (default: localhost)
- `search_default_limit` - Default search limit (default: 100)
- `search_max_limit` - Maximum search limit (default: 1000)
- `embedding_batch_size` - Embedding batch size (default: 20)
- `embedding_provider` - Default embedding provider (default: alibaba)
- `embedding_model` - Default embedding model (default: text-embedding-v4)
- `embedding_dimension` - Default embedding dimension (default: 1024)
- `log_level` - Logging level (default: info)
- `cache_ttl_seconds` - Cache TTL (default: 3600)
- `cache_max_items` - Maximum cache items (default: 1000)
- **Scripts**:
- `migration:pgvector.ts` - Database migration script
- `seed:test-data.ts` - Test data seeding
- `generate-test-data.ts` - Generate test data
- **Docker**:
- `Dockerfile` - Docker image definition
- `docker-compose.yml` - Docker Compose configuration
- **Documentation**:
- `README.md` - Main documentation
- `API.md` - API documentation
- `MCP.md` - MCP integration guide
- `ARCHITECTURE.md` - Architecture overview
- `MIGRATION.md` - Migration guide from JSON to pgvector
- **Testing**:
- `vitest.config.ts` - Vitest configuration
- `tsconfig.json` - TypeScript configuration
- `tsup.config.ts` - Build configuration
- `.env.example` - Environment variable template
- `prisma.config.ts` - Prisma configuration
- `package.json` - Package definition
- `project.json` - Nx project configuration (if using Nx)
