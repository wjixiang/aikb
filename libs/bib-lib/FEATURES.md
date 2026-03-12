# bib-lib 功能文档

## 项目概述

bib-lib 是一个用于管理 PubMed 文献数据的 NestJS 库，支持从 PubMed XML 数据同步到 PostgreSQL 数据库，并提供关键词搜索、语义搜索和混合搜索功能。

---

## 已实现功能

### 1. 数据库层

#### 1.1 Prisma Schema
- **数据库**: PostgreSQL + pgvector 扩展
- **模型**:
  - `Article` - 文章主表 (PMID 唯一索引)
  - `Journal` - 期刊信息
  - `Author` - 作者信息
  - `AuthorArticle` - 作者-文章关联表
  - `MeshHeading` - MeSH 主题词
  - `Chemical` - 化学物质
  - `Grant` - 资助信息
  - `ArticleId` - 文章标识符 (DOI, PMC, PII)
  - `ArticleEmbedding` - 文章向量嵌入 (pgvector 类型)

#### 1.2 Prisma 服务
- `PrismaService` - 数据库连接和查询服务

---

### 2. 数据同步模块 (`src/sync/`)

#### 2.1 XML 解析器
- `pubmed.parser.ts` - 使用 `fast-xml-parser` 解析 PubMed XML 文件
- `parsers/types.ts` - 解析结果类型定义

#### 2.2 同步服务
- `sync.service.ts` - 核心同步逻辑
  - `syncFromDirectory(dirPath)` - 从目录同步
  - `syncFile(filePath)` - 同步单个文件
  - `syncBatch(articles)` - 批量写入数据库
  - UPSERT 支持 (根据 pmid 判断新增或更新)
  - 批量插入 (每批 200 条)
  - 进度报告

#### 2.3 Embedding 服务
- `embed.service.ts` - 生成文章向量嵌入
- 支持多种 embedding provider

#### 2.4 CLI 命令
- `sync.cli.ts` - 数据同步命令行工具
- `embed.cli.ts` - 向量化命令行工具

---

### 3. 搜索模块 (`src/search/`)

#### 3.1 搜索类型定义
- `search/types.ts` - 完整的类型定义
  - `SearchQuery` - 搜索查询
  - `SearchFilters` - 搜索过滤器
  - `SearchResult` - 搜索结果
  - `SearchResponse` - 搜索响应
  - `KeywordSearchOptions` - 关键词搜索选项
  - `SemanticSearchOptions` - 语义搜索选项
  - `HybridSearchOptions` - 混合搜索选项

#### 3.2 关键词搜索
- `keyword/keyword-search.service.ts`
  - 基于 Prisma 的全文搜索
  - 支持多字段过滤 (作者、期刊、年份、MeSH 词等)
  - `getSuggestions()` - 搜索建议 (自动补全)

#### 3.3 语义搜索
- `semantic/semantic-search.service.ts`
  - 基于 pgvector 的向量相似度搜索
  - 支持多种相似度计算方式:
    - `cosine` (余弦相似度)
    - `euclidean` (欧几里得距离)
    - `dot` (点积)
  - 使用原始 SQL 查询 (`<=>` 操作符)

#### 3.4 混合搜索
- `hybrid/hybrid-search.service.ts`
  - 结合关键词和语义搜索结果
  - 可配置权重 (keywordWeight, semanticWeight)
  - 支持结果重排序 (rerank)

#### 3.5 统一搜索服务
- `search/search.service.ts`
  - 统一入口，自动选择搜索模式
  - 集成 Embedding 服务
  - `getFacets()` - 获取搜索 facets

---

### 4. 导出模块 (`src/export/`)

#### 4.1 支持的格式
- **JSON** - 结构化 JSON 导出
- **CSV** - 逗号分隔值
- **BibTeX** - BibTeX 引用格式
- **Markdown** - Markdown 格式的参考文献列表

#### 4.2 导出选项
- `includeAbstract` - 是否包含摘要
- `includeMesh` - 是否包含 MeSH 词
- `includeAuthors` - 是否包含作者
- `includeJournal` - 是否包含期刊信息

---

### 5. 模块导出

`index.ts` 导出了所有模块:
- Prisma 模块和服务
- 同步模块和服务
- Embed 模块和服务
- 搜索模块和服务
- 导出模块和服务

---

## 未实现功能

### 1. MCP Tools
- 尚未实现用于 agent 集成的 MCP tools
- 需要根据 Agent 需求定义具体工具

### 2. REST API
- ✅ 已实现 HTTP API 端点
- 已实现以下端点:
  - `GET /api/search` - 搜索接口
  - `GET /api/suggestions` - 搜索建议
  - `GET /api/facets` - 搜索 facets
  - `GET /api/export` - 导出接口
  - `GET /api/health` - 健康检查

### 3. 测试
- 已实现搜索服务和导出服务的单元测试 (69 个测试用例)
- 集成测试覆盖不足

### 4. 向量化
- ✅ `ArticleEmbedding` 表已有 schema
- ✅ 已实现 EmbedService 用于生成向量嵌入
- ✅ 支持多种 embedding provider (OpenAI, Alibaba, Ollama, ONNX)
- ✅ 支持 HNSW 索引优化向量搜索

### 5. 搜索增强
- ✅ 高亮显示 (highlights) - 基于查询词的高亮片段
- ✅ 搜索建议 (suggestions) - 使用 contains 实现智能自动补全
- ✅ 分页游标 (cursor) - 支持 nextCursor 分页

### 6. 性能优化
- ✅ GIN 索引 - 已添加 trigram 索引优化关键词搜索
- ✅ 向量索引 - 已添加 HNSW 索引优化语义搜索
- ✅ 数据库初始化脚本 - `npm run db:init` 自动配置
- 批量导出可优化内存使用

---

## 使用示例

### 数据同步

```bash
# 同步整个目录
npm run sync -- /mnt/disk1/pubmed-mirror/baseline/2026

# 同步单个文件
npm run sync -- --file /path/to/file.xml.gz
```

### 搜索服务

```typescript
import { SearchService, SearchModule } from '@libs/bib-lib';

// 关键词搜索
const result = await searchService.search(
  { query: 'cancer treatment', limit: 20 },
  { mode: 'keyword' }
);

// 语义搜索
const result = await searchService.search(
  { query: 'cancer treatment', limit: 20 },
  { mode: 'semantic', embeddingProvider: 'alibaba', embeddingModel: 'text-embedding-v4' }
);

// 混合搜索
const result = await searchService.search(
  { query: 'cancer treatment', limit: 20 },
  { mode: 'hybrid', keywordWeight: 0.5, semanticWeight: 0.5 }
);
```

### 导出

```typescript
import { ExportService } from '@libs/bib-lib';

const exportService = new ExportService();
const result = exportService.export(results, { format: 'bibtex' });
console.log(result.content); // BibTeX 格式内容
```

---

## 技术栈

- **运行时**: Node.js
- **框架**: NestJS
- **数据库**: PostgreSQL + pgvector
- **ORM**: Prisma
- **XML 解析**: fast-xml-parser
- **构建**: tsup
- **测试**: Vitest

---

## 文件结构

```
libs/bib-lib/src/
├── index.ts                    # 入口文件
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── sync/
│   ├── sync.module.ts
│   ├── sync.service.ts
│   ├── parsers/
│   │   ├── pubmed.parser.ts
│   │   └── types.ts
│   ├── embed/
│   │   ├── embed.module.ts
│   │   └── embed.service.ts
│   └── cli/
│       ├── sync.cli.ts
│       └── embed.cli.ts
├── search/
│   ├── search.module.ts
│   ├── search.service.ts
│   ├── types.ts
│   ├── keyword/
│   │   └── keyword-search.service.ts
│   ├── semantic/
│   │   └── semantic-search.service.ts
│   └── hybrid/
│       └── hybrid-search.service.ts
└── export/
    ├── export.module.ts
    ├── export.service.ts
    └── types.ts
```

---

## 注意事项

1. pgvector 扩展需要在数据库中手动创建: `CREATE EXTENSION IF NOT EXISTS vector;`
2. 同步大文件时注意内存使用，建议分批处理
3. 语义搜索需要先为文章生成 embedding
4. 搜索服务依赖 Embedding 服务，需要配置 provider
