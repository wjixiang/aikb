# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AIKB (AI Knowledge Base) is a knowledge management system integrated with agents. It manages PubMed biomedical literature, provides embedding/chunking capabilities, and includes an agent framework for knowledge tasks. The system supports evidence-based medicine (EBM) workflows with Expert-based agent orchestration.

## Build System

- **Package Manager**: pnpm (v10.7.0)
- **Monorepo**: NX with pnpm workspaces
- **Build Tools**: tsup for standalone libraries
- **Testing**: Vitest with unit, integrated, and e2e test configurations

## Common Commands

### Install Dependencies
```bash
pnpm install
```

### Build Libraries
```bash
# Build all libs with NX
npx nx run-many -t build -p bib-lib agent-lib

# Or build individual libs (they use tsup)
cd libs/bib-lib && pnpm build
cd libs/ai-embed && pnpm build
cd libs/agent-lib && pnpm build
```

### Test
```bash
# Run unit tests via NX
npx nx test agent-lib

# Run tests directly with vitest
cd libs/bib-lib && pnpm test          # unit tests
cd libs/bib-lib && pnpm test:run      # run once
cd libs/bib-lib && pnpm test:integrated
cd libs/ai-embed && pnpm test
```

### Database (Prisma)

```bash
# bib-lib
cd libs/bib-lib
pnpm prisma:generate    # Generate Prisma client
pnpm prisma:migrate     # Run migrations
pnpm prisma:push        # Push schema to DB

# agent-lib (uses NX)
npx nx run agent-lib:db-pull
npx nx run agent-lib:db-push
npx nx run agent-lib:gen-client
npx nx run agent-lib:studio
```

### Development Servers

```bash
# bib-lib standalone server
cd libs/bib-lib && pnpm start

# Run sync CLI
cd libs/bib-lib && pnpm sync
cd libs/bib-lib && pnpm embed
```

### Expert CLI (ebm-agent)
```bash
cd apps/ebm-agent
pnpm expert:new <name>     # Create new Expert
pnpm expert:list            # List all Experts
pnpm expert:validate       # Validate Expert configs
pnpm expert:show <name>    # Show Expert details
pnpm expert:test           # Run Expert tests
```

## Project Structure

```
/
├── apps/                    # NX applications
│   ├── auth-service/       # Authentication service (NestJS)
│   ├── bibliography-service/
│   ├── pdf2md-service/
│   └── ebm-agent/         # Evidence-based medicine agent (Expert system)
├── libs/                   # Libraries
│   ├── bib-lib/           # PubMed bibliography management
│   │   ├── prisma/        # Database schema
│   │   └── src/
│   │       ├── sync/     # PubMed sync & embedding
│   │       ├── search/   # Keyword, semantic, hybrid search
│   │       └── export/   # Export functionality
│   ├── ai-embed/          # @ai-embed/core - Embedding/chunking
│   ├── agent-lib/        # Agent framework with Expert system
│   │   └── src/
│   │       ├── core/
│   │       │   ├── expert/    # Expert orchestration system
│   │       │   ├── api-client/  # LLM API clients
│   │       │   ├── di/       # Dependency injection (InversifyJS)
│   │       │   └── memory/   # Agent memory
│   │       ├── tools/          # Tool definitions
│   │       └── baml_client/    # BAML integration
│   ├── component-hub/     # Reusable agent components
│   ├── knowledgeBase/     # Knowledge graph system
│   │   ├── knowledge-db/
│   │   │   ├── entity-db/  # Entity storage (Prisma)
│   │   │   ├── graph-db/   # Graph storage (Prisma)
│   │   │   └── property-db/
│   │   └── knowledgeBase-lib/  # Knowledge management
│   ├── pdf-converter/     # PDF to Markdown conversion
│   ├── mineru-client/     # MinerU PDF parser client
│   ├── embedding/         # Embedding utilities
│   ├── chunking/          # Text chunking
│   └── ...
├── ml/                     # Python ML utilities
├── docker/                 # Docker compose configurations
├── docs/                  # Architecture documentation
├── pnpm-workspace.yaml
└── package.json
```

## Key Libraries

### @ai-embed/core (`libs/ai-embed`)
Simplified embedding and chunking library. Exports:
- `Embedding` class - wraps embedding provider responses
- `EmbeddingProvider` enum - supported providers (OpenAI, Alibaba, Ollama)
- Chunking functions for text splitting

Used by bib-lib for article embeddings.

### bib-lib (`libs/bib-lib`)
PubMed bibliography management with:
- **Prisma 7** with PostgreSQL adapter and pgvector for vector search
- **Sync**: Fetch and parse PubMed XML data
- **Embed**: Generate article embeddings using @ai-embed/core
- **Search**: Keyword, semantic (vector), and hybrid search
- **Export**: Export bibliography in various formats

Key models: `Article`, `Journal`, `Author`, `ArticleEmbedding`, `MeshHeading`, `Chemical`, `Grant`, `ArticleId`

### agent-lib (`libs/agent-lib`)
Agent framework with:
- **BAML integration** for structured output
- **Tool system** for agent actions
- **Memory** components
- **API clients** for OpenAI-compatible endpoints
- **Expert system** for multi-agent orchestration
- **Dependency Injection** using InversifyJS

Key Expert classes:
- `ExpertExecutor` - Creates and executes Expert instances
- `ExpertInstance` - Running Expert with Agent
- `ExpertOrchestrator` - Multi-expert orchestration
- `ExpertRegistry` - Expert configuration management

### component-hub (`libs/componentHub`)
Reusable agent components for EBM workflows:
- `bibliographySearch` - PubMed literature search
- `paperAnalysis` - Scientific paper analysis
- `PICOS` - PICO framework extraction
- `PRISMA` - PRISMA checklist compliance

### ebm-agent (`apps/ebm-agent`)
Evidence-based medicine agent application using the Expert system:
- Expert-based agent orchestration
- Built-in Experts: `hi-agent`, `pubmed-retrieve`
- Configurable via `config.json` and `sop.yaml`

## Database

- **Prisma 7** with `@prisma/adapter-pg` for PostgreSQL
- **pgvector** extension enabled for similarity search
- Multiple databases: bib-lib, agent-lib, knowledgeBase (entity/graph/property)

## Testing Patterns

Tests use Vitest with different configurations:
- `vitest.unit.config.ts` - Unit tests (mocked dependencies)
- `vitest.integrated.config.ts` - Integration tests (real DB)
- `vite.config.mts` - Standard config
- `vite.config.integrated.mts` - Integration config

Test files:
- `*.spec.ts` - Unit tests
- `*.integrated.test.ts` - Integration tests
- `*.e2e.test.ts` - End-to-end tests

## Environment Variables

Key environment files:
- `libs/bib-lib/.env` - Database connection, embedding providers
- `libs/bib-lib/.env.example`

Typical variables:
- `DATABASE_URL` - PostgreSQL connection
- `OPENAI_API_KEY` - For embeddings
- Provider-specific API keys
