# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AIKB (AI Knowledge Base) is a knowledge management system integrated with agents. It manages PubMed biomedical literature, provides embedding/chunking capabilities, and includes an agent framework for knowledge tasks. The system supports evidence-based medicine (EBM) workflows with Expert-based agent orchestration and A2A (agent-to-agent) communication.

## Build System

- **Package Manager**: pnpm (v10.7.0)
- **Monorepo**: NX with pnpm workspaces (`libs/*`, `apps/*`)
- **Build Tools**: tsup for standalone libraries, tsc for apps
- **Testing**: Vitest with unit, integrated, and e2e configurations
- **Linting**: ESLint (flat config) + Prettier (`singleQuote: true`, `trailingComma: all`)
- **Databases**: Prisma 7 with `@prisma/adapter-pg` for PostgreSQL, pgvector for vector search

## Common Commands

```bash
pnpm install                    # Install all dependencies

# Build
cd libs/<pkg> && pnpm build     # Build individual lib (tsup)
cd apps/swarm-runtime && pnpm build  # Build individual app (tsc)

# Type check
cd libs/<pkg> && pnpm type-check

# Lint
npx eslint libs/<pkg>/src       # Lint a package

# Test (Vitest)
cd libs/<pkg> && pnpm test          # Unit tests (watch)
cd libs/<pkg> && pnpm test:run      # Unit tests (single run)
cd libs/<pkg> && pnpm test:integrated  # Integration tests (real DB)

# NX targets (agent-lib)
npx nx test agent-lib               # Unit tests
npx nx integrate agent-lib          # Integration tests
npx nx run agent-lib:db-push        # Push schema
npx nx run agent-lib:gen-client     # Generate Prisma client
npx nx run agent-lib:studio         # Prisma Studio

# Prisma (bib-lib, direct)
cd libs/bib-lib
pnpm prisma:generate    # Generate Prisma client
pnpm prisma:migrate     # Run migrations
pnpm prisma:push        # Push schema to DB

# Expert CLI (agent-lib)
cd libs/agent-lib
pnpm expert:list / expert:new / expert:validate / expert:show / expert:test

# Agent CLI (agent-lib)
cd libs/agent-lib
pnpm agent:runtime:start / agent:runtime:stop / agent:runtime:status
pnpm agent:test:basic / agent:test:a2a / agent:test:redis
pnpm agent:monitor:runtime

# Development servers
cd libs/bib-lib && pnpm start       # Express server
cd apps/swarm-runtime && pnpm dev   # Fastify dev server (tsx watch)

# Docker services
cd docker && docker compose up -d   # Redis, PostgreSQL+pgvector, RustFS, LiteLLM
```

## Architecture

### Agent Framework (`libs/agent-lib`)

The core framework uses **InversifyJS** for dependency injection. Key architectural layers:

```
Agent → VirtualWorkspace → Components/Tools → Memory → API Client
```

**DI System** (`src/core/di/types.ts`): All services registered via `TYPES` symbols. Scopes:
- **Singleton**: Container, IToolManager, IMessageBus, PrismaClient, IA2AClient
- **Request**: VirtualWorkspace, MemoryModule, ApiClient (shared within agent creation)
- **Transient**: Agent, IToolProvider (new per request)

**Two-Tier Memory**:
1. `Agent._conversationHistory` — dialogue messages (always exists)
2. `MemoryModule.memoryStore` — full workspace context via ContextMemoryStore (optional)

**Component System**: `ToolComponent` base class. Components provide tools to agents. Domain components live in `libs/component-hub`, agent-specific ones in `libs/agent-lib/src/components/`.

**A2A Communication**: Agent-to-agent messaging via `MessageBus` (memory or Redis-backed). Message types: `task`, `query`, `event`. Service discovery via `IAgentRegistry`.

**Expert System**: Multi-expert orchestration with strategies (sequential, parallel, dependency-ordered, conditional). Key classes: `ExpertExecutor`, `ExpertInstance`, `ExpertOrchestrator`, `ExpertRegistry`.

**Persistence**: PostgreSQL via Prisma. Models: `AgentInstance`, `AgentSession`, `AgentMemory`, `ComponentState`, `RuntimeTask`, `A2AConversationLog`.

### Key Libraries

| Package | Purpose |
|---|---|
| `agent-lib` | Agent framework: DI, Expert system, A2A, runtime |
| `llm-api-client` | LLM API abstraction (Anthropic, OpenAI, Alibaba, GLM, LM Studio) |
| `agent-soul-hub` | Agent type registry and factory |
| `component-hub` | Domain-specific agent components (search, PICOS, PRISMA, etc.) |
| `bib-lib` | PubMed bibliography: sync, embed, search, export, library management |
| `@ai-embed/core` | Embedding providers and text chunking |
| `shared-types` | Shared TypeScript types |

### Key Applications

| App | Stack | Purpose |
|---|---|---|
| `swarm-runtime` | Fastify | Agent runtime server (one server = one runtime), A2A communication |
| `swarm-dashboard` | React 19 + Vite | Agent topology visualization and monitoring |
| `bib-max-api` | Fastify + Prisma | Bibliography API with S3 storage |
| `bib-max` | React 19 + Vite | Bibliography management frontend |
| `case-hub` | NestJS + Prisma | Medical case management with LLM generation |
| `auto-review` | Fastify + Prisma | Literature review automation |

### Infrastructure (Docker)

Services in `docker/docker-compose.yml`:
- **PostgreSQL** (pgvector/pgvector:pg16) — port 5432
- **Redis** — port 6379 (MessageBus backend)
- **RustFS** — ports 9000/9001 (S3-compatible storage)
- **LiteLLM** — port 4000 (LLM proxy: MiniMax, GLM, Kimi models)

### Testing Patterns

- `*.spec.ts` — Unit tests
- `*.integrated.test.ts` — Integration tests (real DB connections)
- `*.e2e.test.ts` — End-to-end tests
- `vitest.unit.config.ts` / `vite.config.mts` — Unit test configs
- `vitest.integrated.config.ts` / `vite.config.integrated.mts` — Integration test configs

### Environment Variables

- `DATABASE_URL`, `AGENT_DATABASE_URL`, `BIB_DATABASE_URL` — PostgreSQL connections
- `OPENAI_API_KEY`, `GLM_API_KEY`, `MINIMAX_API_KEY`, `KIMI_API_KEY` — LLM providers
- `A2A_MESSAGE_BUS_MODE` — `memory` or `redis`
- `A2A_REDIS_URL` — Redis URL for MessageBus
- AWS S3 credentials for storage services
