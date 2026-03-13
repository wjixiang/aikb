# bib-lib Unit Test Plan

## Overview

This document outlines a comprehensive unit test plan for the `bib-lib` library, which manages PubMed literature data with support for XML parsing, data synchronization, keyword/semantic/hybrid search, and multiple export formats.

## Current Test Status

| Module | Current Coverage | Status |
|--------|-----------------|--------|
| PrismaService | None | ❌ No tests |
| PubmedParser | None | ❌ No tests |
| SyncService | None | ❌ No tests |
| EmbedService | None | ❌ No tests |
| KeywordSearchService | None | ❌ No tests |
| SemanticSearchService | None | ❌ No tests |
| HybridSearchService | None | ❌ No tests |
| SearchService | None | ❌ No tests |
| ExportService | None | ❌ No tests |
| BiblibService | Basic | ⚠️ Placeholder only |

---

## Test Architecture

### Test Categories

```mermaid
graph TD
    A[bib-lib Tests] --> B[Unit Tests]
    A --> C[Integration Tests]
    
    B --> B1[Parser Tests]
    B --> B2[Service Logic Tests]
    B --> B3[Utility Function Tests]
    
    C --> C1[Database Tests]
    C --> C2[Search Integration Tests]
    C --> C3[End-to-End Workflow Tests]
```

### Test File Structure

```
libs/bib-lib/src/
├── prisma/
│   ├── prisma.service.ts
│   └── __tests__/
│       └── prisma.service.spec.ts
├── sync/
│   ├── sync.service.ts
│   ├── __tests__/
│   │   └── sync.service.spec.ts
│   ├── parsers/
│   │   ├── pubmed.parser.ts
│   │   └── __tests__/
│   │       └── pubmed.parser.spec.ts
│   └── embed/
│       ├── embed.service.ts
│       └── __tests__/
│           └── embed.service.spec.ts
├── search/
│   ├── search.service.ts
│   ├── __tests__/
│   │   └── search.service.spec.ts
│   ├── keyword/
│   │   ├── keyword-search.service.ts
│   │   └── __tests__/
│   │       └── keyword-search.service.spec.ts
│   ├── semantic/
│   │   ├── semantic-search.service.ts
│   │   └── __tests__/
│   │       └── semantic-search.service.spec.ts
│   └── hybrid/
│       ├── hybrid-search.service.ts
│       └── __tests__/
│           └── hybrid-search.service.spec.ts
└── export/
    ├── export.service.ts
    └── __tests__/
        └── export.service.spec.ts
```

---

## Detailed Test Specifications

### 1. PubmedParser Tests

**File**: `src/sync/parsers/__tests__/pubmed.parser.spec.ts`

#### Test Cases

| ID | Test Case | Description | Priority |
|----|-----------|-------------|----------|
| PP-01 | parseFile - valid gzipped XML | Should correctly parse a valid PubMed XML gzip file | High |
| PP-02 | parseFile - malformed XML | Should handle malformed XML gracefully | High |
| PP-03 | parseFile - missing file | Should throw appropriate error for missing file | Medium |
| PP-04 | parseFile - non-gzip file | Should handle non-gzipped files appropriately | Medium |
| PP-05 | extractArticles - complete elements | Should extract complete PubmedArticle elements | High |
| PP-06 | extractArticles - incomplete elements | Should handle incomplete elements correctly | High |
| PP-07 | extractArticles - empty input | Should return empty array for empty input | Medium |
| PP-08 | parseArticle - full article | Should parse article with all fields populated | High |
| PP-09 | parseArticle - minimal article | Should parse article with only required fields | High |
| PP-10 | parseArticle - missing PMID | Should return null for article without PMID | High |
| PP-11 | parseJournal - complete journal | Should parse journal with all fields | Medium |
| PP-12 | parseJournal - minimal journal | Should handle journal with minimal data | Medium |
| PP-13 | parseAuthors - author list | Should parse multiple authors correctly | High |
| PP-14 | parseAuthors - empty list | Should return empty array for no authors | Medium |
| PP-15 | parseMeshHeadings - MeSH terms | Should parse MeSH headings correctly | Medium |
| PP-16 | parseChemicals - chemical list | Should parse chemical substances | Medium |
| PP-17 | parseGrants - grant info | Should parse grant information | Low |
| PP-18 | parseArticleIds - all IDs | Should parse DOI, PMC, PII correctly | High |
| PP-19 | parseDate - valid date | Should parse date components correctly | Medium |
| PP-20 | parseDate - invalid date | Should handle invalid date gracefully | Medium |
| PP-21 | toArray - single item | Should convert single item to array | Low |
| PP-22 | toArray - array input | Should preserve array input | Low |

#### Mock Data Requirements

```typescript
// Sample minimal article XML
const minimalArticleXml = `
  <PubmedArticle>
    <MedlineCitation>
      <PMID>12345678</PMID>
      <Article>
        <ArticleTitle>Test Article</ArticleTitle>
        <Journal><Title>Test Journal</Title></Journal>
      </Article>
    </MedlineCitation>
  </PubmedArticle>
`;

// Sample full article XML with all fields
const fullArticleXml = `
  <PubmedArticle>
    <MedlineCitation>
      <PMID>12345678</PMID>
      <DateCompleted><Year>2024</Year><Month>01</Month><Day>15</Day></DateCompleted>
      <DateRevised><Year>2024</Year><Month>02</Month><Day>20</Day></DateRevised>
      <Article>
        <ArticleTitle>Comprehensive Study on Cancer Treatment</ArticleTitle>
        <Language>eng</Language>
        <Journal>
          <ISSN IssnType="Print">1234-5678</ISSN>
          <ISSN IssnType="Electronic">1234-5679</ISSN>
          <Volume>10</Volume>
          <Issue>2</Issue>
          <PubDate><Year>2024</Year></PubDate>
          <Title>Journal of Medical Research</Title>
          <ISOAbbreviation>J Med Res</ISOAbbreviation>
        </Journal>
        <AuthorList>
          <Author>
            <LastName>Smith</LastName>
            <ForeName>John</ForeName>
            <Initials>JM</Initials>
          </Author>
          <Author>
            <LastName>Doe</LastName>
            <ForeName>Jane</ForeName>
            <Initials>JD</Initials>
          </Author>
        </AuthorList>
        <PublicationTypeList>
          <PublicationType>Journal Article</PublicationType>
        </PublicationTypeList>
      </Article>
      <MeshHeadingList>
        <MeshHeading>
          <DescriptorName UI="D009369">Neoplasms</DescriptorName>
          <QualifierName UI="Q000188">drug therapy</QualifierName>
        </MeshHeading>
      </MeshHeadingList>
      <ChemicalList>
        <Chemical>
          <RegistryNumber>0</RegistryNumber>
          <NameOfSubstance>Antineoplastic Agents</NameOfSubstance>
        </Chemical>
      </ChemicalList>
    </MedlineCitation>
    <PubmedData>
      <ArticleIdList>
        <ArticleId IdType="doi">10.1234/test.2024.001</ArticleId>
        <ArticleId IdType="pmc">PMC1234567</ArticleId>
        <ArticleId IdType="pii">S1234-5678(24)00001-0</ArticleId>
      </ArticleIdList>
    </PubmedData>
  </PubmedArticle>
`;
```

---

### 2. SyncService Tests

**File**: `src/sync/__tests__/sync.service.spec.ts`

#### Test Cases

| ID | Test Case | Description | Priority |
|----|-----------|-------------|----------|
| SS-01 | syncFromDirectory - success | Should sync all files from directory | High |
| SS-02 | syncFromDirectory - empty directory | Should handle empty directory | Medium |
| SS-03 | syncFromDirectory - invalid path | Should throw error for invalid path | High |
| SS-04 | syncFromDirectory - with progress callback | Should call progress callback | Medium |
| SS-05 | syncFromDirectory - with concurrency | Should respect concurrency option | Medium |
| SS-06 | processFile - valid file | Should process valid XML file | High |
| SS-07 | processFile - batch processing | Should process in correct batch sizes | High |
| SS-08 | syncBatch - insert new articles | Should insert new articles via UPSERT | High |
| SS-09 | syncBatch - update existing articles | Should update existing articles via UPSERT | High |
| SS-10 | syncBatch - handle duplicates | Should handle duplicate PMIDs | High |
| SS-11 | syncChunk - create new journals | Should create new journal entries | Medium |
| SS-12 | syncChunk - reuse existing journals | Should reuse existing journals from cache | Medium |
| SS-13 | syncChunk - create new authors | Should create new author entries | Medium |
| SS-14 | syncChunk - reuse existing authors | Should reuse existing authors from cache | Medium |
| SS-15 | preloadCache - load journals | Should preload journal cache correctly | Medium |
| SS-16 | preloadCache - load authors | Should preload author cache correctly | Medium |
| SS-17 | getXmlFiles - find all XML files | Should find all .xml.gz files | Medium |
| SS-18 | getXmlFiles - recursive search | Should search recursively | Low |
| SS-19 | error handling - parser error | Should handle parser errors gracefully | High |
| SS-20 | error handling - database error | Should handle database errors | High |

#### Mock Setup

```typescript
// Mock PrismaService
const mockPrismaService = {
  article: {
    upsert: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  journal: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  author: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  authorArticle: {
    create: vi.fn(),
  },
  meshHeading: {
    create: vi.fn(),
  },
  chemical: {
    create: vi.fn(),
  },
  grant: {
    create: vi.fn(),
  },
  articleId: {
    create: vi.fn(),
  },
  $transaction: vi.fn((fn) => fn()),
};
```

---

### 3. EmbedService Tests

**File**: `src/sync/embed/__tests__/embed.service.spec.ts`

#### Test Cases

| ID | Test Case | Description | Priority |
|----|-----------|-------------|----------|
| ES-01 | embedArticles - success | Should embed articles successfully | High |
| ES-02 | embedArticles - skip existing | Should skip articles with existing embeddings | High |
| ES-03 | embedArticles - progress callback | Should call progress callback | Medium |
| ES-04 | embedArticles - embedding failure | Should handle embedding API failures | High |
| ES-05 | embedArticles - provider option | Should use specified provider | Medium |
| ES-06 | embedArticles - model option | Should use specified model | Medium |
| ES-07 | embedArticlesBatch - batch processing | Should process in batches | High |
| ES-08 | embedArticlesBatch - batch size option | Should respect batch size | Medium |
| ES-09 | buildTextToEmbed - title only | Should build text with title only | Medium |
| ES-10 | buildTextToEmbed - title and abstract | Should include abstract when available | Medium |
| ES-11 | buildTextToEmbed - title and mesh | Should include MeSH terms | Medium |
| ES-12 | buildConfig - default values | Should use default config values | Low |
| ES-13 | buildConfig - custom values | Should override with custom values | Low |
| ES-14 | upsert embedding - create new | Should create new embedding record | High |
| ES-15 | upsert embedding - update existing | Should update existing embedding | High |

#### Mock Setup

```typescript
// Mock Embedding service
const mockEmbedding = {
  embed: vi.fn(),
};

// Mock PrismaService
const mockPrismaService = {
  article: {
    findMany: vi.fn(),
  },
  articleEmbedding: {
    upsert: vi.fn(),
  },
};
```

---

### 4. KeywordSearchService Tests

**File**: `src/search/keyword/__tests__/keyword-search.service.spec.ts`

#### Test Cases

| ID | Test Case | Description | Priority |
|----|-----------|-------------|----------|
| KS-01 | search - basic query | Should search with basic text query | High |
| KS-02 | search - pagination limit | Should respect limit parameter | High |
| KS-03 | search - pagination offset | Should respect offset parameter | High |
| KS-04 | search - empty query | Should return all results for empty query | Medium |
| KS-05 | search - no results | Should return empty results | Medium |
| KS-06 | buildWhereClause - author filter | Should build author filter correctly | High |
| KS-07 | buildWhereClause - journal filter | Should build journal filter correctly | High |
| KS-08 | buildWhereClause - year range | Should build year range filter | High |
| KS-09 | buildWhereClause - date range | Should build date range filter | Medium |
| KS-10 | buildWhereClause - language filter | Should build language filter | Medium |
| KS-11 | buildWhereClause - publication type | Should build publication type filter | Medium |
| KS-12 | buildWhereClause - MeSH terms | Should build MeSH terms filter | Medium |
| KS-13 | buildWhereClause - has abstract | Should filter by abstract presence | Low |
| KS-14 | buildWhereClause - combined filters | Should combine multiple filters | High |
| KS-15 | transformResult - full data | Should transform result with all includes | Medium |
| KS-16 | transformResult - minimal data | Should handle minimal article data | Medium |
| KS-17 | getSuggestions - basic | Should return search suggestions | Medium |
| KS-18 | getSuggestions - with limit | Should limit suggestions count | Low |
| KS-19 | search response - hasMore flag | Should calculate hasMore correctly | High |
| KS-20 | search response - nextCursor | Should return nextCursor when applicable | Medium |

#### Mock Setup

```typescript
const mockPrismaService = {
  article: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
};

// Sample article data
const mockArticle = {
  id: 'article-1',
  pmid: BigInt(12345678),
  articleTitle: 'Test Article Title',
  language: 'eng',
  publicationType: 'Journal Article',
  journal: {
    id: 'journal-1',
    title: 'Test Journal',
    isoAbbreviation: 'Test J',
    pubYear: 2024,
    volume: '10',
    issue: '2',
  },
  authors: [
    {
      author: {
        id: 'author-1',
        lastName: 'Smith',
        foreName: 'John',
        initials: 'JM',
      },
    },
  ],
  meshHeadings: [
    { descriptorName: 'Neoplasms', qualifierName: 'drug therapy' },
  ],
  chemicals: [{ registryNumber: '0', nameOfSubstance: 'Test Chemical' }],
  grants: [{ grantId: 'R01', agency: 'NIH', country: 'USA' }],
  articleIds: [{ doi: '10.1234/test' }],
};
```

---

### 5. SemanticSearchService Tests

**File**: `src/search/semantic/__tests__/semantic-search.service.spec.ts`

#### Test Cases

| ID | Test Case | Description | Priority |
|----|-----------|-------------|----------|
| SSem-01 | search - basic semantic search | Should perform vector similarity search | High |
| SSem-02 | search - with embedding | Should use provided embedding vector | High |
| SSem-03 | search - cosine similarity | Should use cosine similarity correctly | High |
| SSem-04 | search - euclidean distance | Should use euclidean distance correctly | Medium |
| SSem-05 | search - dot product | Should use dot product correctly | Medium |
| SSem-06 | search - with filters | Should apply filters before vector search | High |
| SSem-07 | search - no matching embeddings | Should return empty results | Medium |
| SSem-08 | search - pagination | Should paginate results correctly | High |
| SSem-09 | search - provider/model filter | Should filter by embedding provider/model | High |
| SSem-10 | buildWhereClause - filters | Should build Prisma where clause | Medium |
| SSem-11 | arrayToVector - conversion | Should convert array to PostgreSQL vector | Medium |
| SSem-12 | transformResult - with similarity | Should include similarity score | High |
| SSem-13 | transformResult - similarity threshold | Should filter by similarity threshold | Medium |
| SSem-14 | search response - hasMore flag | Should calculate hasMore correctly | High |
| SSem-15 | search response - searchTime | Should include search time | Low |

#### Mock Setup

```typescript
const mockPrismaService = {
  article: {
    findMany: vi.fn(),
  },
  $queryRawUnsafe: vi.fn(),
};

// Sample embedding vector
const mockEmbedding = new Array(1024).fill(0).map(() => Math.random());

// Sample raw query result
const mockSimilarArticles = [
  { id: 'article-1', similarity: 0.95 },
  { id: 'article-2', similarity: 0.89 },
  { id: 'article-3', similarity: 0.82 },
];
```

---

### 6. HybridSearchService Tests

**File**: `src/search/hybrid/__tests__/hybrid-search.service.spec.ts`

#### Test Cases

| ID | Test Case | Description | Priority |
|----|-----------|-------------|----------|
| HS-01 | search - basic hybrid | Should combine keyword and semantic results | High |
| HS-02 | search - with embedding | Should use provided embedding | High |
| HS-03 | search - default weights | Should use default weights 0.5/0.5 | Medium |
| HS-04 | search - custom weights | Should apply custom weights | High |
| HS-05 | search - keyword heavy | Should weight keyword results higher | Medium |
| HS-06 | search - semantic heavy | Should weight semantic results higher | Medium |
| HS-07 | search - with rerank | Should rerank results when enabled | High |
| HS-08 | search - pagination | Should paginate combined results | High |
| HS-09 | combineResults - merge results | Should merge keyword and semantic results | High |
| HS-10 | combineResults - deduplicate | Should deduplicate by article ID | High |
| HS-11 | combineResults - score calculation | Should calculate combined scores correctly | High |
| HS-12 | combineResults - weight normalization | Should normalize weights correctly | Medium |
| HS-13 | rerankResults - basic reranking | Should rerank based on query terms | Medium |
| HS-14 | rerankResults - topN limit | Should limit reranked results | Medium |
| HS-15 | search response - hasMore flag | Should calculate hasMore correctly | High |

#### Mock Setup

```typescript
const mockKeywordSearch = {
  search: vi.fn(),
};

const mockSemanticSearch = {
  search: vi.fn(),
};

const mockPrismaService = {};

// Sample keyword results
const mockKeywordResults = {
  results: [
    { id: 'article-1', articleTitle: 'Cancer Treatment Study', score: 0.9 },
    { id: 'article-2', articleTitle: 'Novel Therapy Approach', score: 0.8 },
  ],
  total: 2,
};

// Sample semantic results
const mockSemanticResults = {
  results: [
    { id: 'article-1', articleTitle: 'Cancer Treatment Study', score: 0.95 },
    { id: 'article-3', articleTitle: 'Oncology Research', score: 0.88 },
  ],
  total: 2,
};
```

---

### 7. SearchService Tests

**File**: `src/search/__tests__/search.service.spec.ts`

#### Test Cases

| ID | Test Case | Description | Priority |
|----|-----------|-------------|----------|
| USS-01 | search - keyword mode | Should route to keyword search | High |
| USS-02 | search - semantic mode | Should route to semantic search | High |
| USS-03 | search - hybrid mode | Should route to hybrid search | High |
| USS-04 | search - default mode | Should use keyword mode by default | Medium |
| USS-05 | search - generate embedding | Should generate embedding for semantic | High |
| USS-06 | search - embedding failure | Should handle embedding generation failure | High |
| USS-07 | keywordSearchOnly - basic | Should call keyword search directly | Medium |
| USS-08 | semanticSearchOnly - with embedding | Should call semantic search with embedding | Medium |
| USS-09 | hybridSearchOnly - with embedding | Should call hybrid search with embedding | Medium |
| USS-10 | buildEmbeddingText - basic | Should build text for embedding | Medium |
| USS-11 | buildEmbeddingText - max length | Should truncate to max length | Low |
| USS-12 | getSuggestions - basic | Should return suggestions from keyword service | Medium |
| USS-13 | getFacets - basic | Should return facet aggregations | Medium |
| USS-14 | constructor - embedding init | Should initialize embedding service | Low |

#### Mock Setup

```typescript
const mockKeywordSearch = { search: vi.fn(), getSuggestions: vi.fn() };
const mockSemanticSearch = { search: vi.fn() };
const mockHybridSearch = { search: vi.fn() };
const mockPrismaService = {};

// Mock Embedding constructor
vi.mock('@ai-embed/core', () => ({
  Embedding: vi.fn().mockImplementation(() => ({
    embed: vi.fn().mockResolvedValue({
      success: true,
      embedding: new Array(1024).fill(0),
    }),
  })),
  defaultEmbeddingConfig: { batchSize: 10 },
}));
```

---

### 8. ExportService Tests

**File**: `src/export/__tests__/export.service.spec.ts`

#### Test Cases

| ID | Test Case | Description | Priority |
|----|-----------|-------------|----------|
| ESvc-01 | export - JSON format | Should export to JSON format | High |
| ESvc-02 | export - CSV format | Should export to CSV format | High |
| ESvc-03 | export - BibTeX format | Should export to BibTeX format | High |
| ESvc-04 | export - Markdown format | Should export to Markdown format | High |
| ESvc-05 | export - unsupported format | Should throw error for unsupported format | Medium |
| ESvc-06 | toJson - include all options | Should include all data when options enabled | Medium |
| ESvc-07 | toJson - exclude authors | Should exclude authors when option disabled | Medium |
| ESvc-08 | toJson - exclude journal | Should exclude journal when option disabled | Medium |
| ESvc-09 | toCsv - escape special chars | Should escape commas and quotes | High |
| ESvc-10 | toCsv - header row | Should include correct headers | Medium |
| ESvc-11 | toBibtex - article key | Should generate valid BibTeX key | Medium |
| ESvc-12 | toBibtex - all fields | Should include all BibTeX fields | Medium |
| ESvc-13 | toBibtex - missing fields | Should handle missing optional fields | Medium |
| ESvc-14 | toMarkdown - numbered list | Should create numbered list | Medium |
| ESvc-15 | toMarkdown - DOI link | Should include DOI as link | Medium |
| ESvc-16 | flattenResult - full data | Should flatten result correctly | Medium |
| ESvc-17 | flattenResult - include abstract | Should include abstract when enabled | Medium |
| ESvc-18 | flattenResult - include mesh | Should include MeSH terms when enabled | Low |
| ESvc-19 | escapeCsv - comma | Should escape comma correctly | High |
| ESvc-20 | escapeCsv - quote | Should escape quote correctly | High |
| ESvc-21 | escapeCsv - newline | Should escape newline correctly | Medium |
| ESvc-22 | generateBibtexKey - with author | Should use author name in key | Low |
| ESvc-23 | generateBibtexKey - no author | Should use index when no author | Low |

#### Mock Data

```typescript
// Sample search results for export
const mockSearchResults: SearchResult[] = [
  {
    id: 'article-1',
    pmid: BigInt(12345678),
    articleTitle: 'Test Article Title',
    language: 'eng',
    publicationType: 'Journal Article',
    journal: {
      title: 'Journal of Medical Research',
      isoAbbreviation: 'J Med Res',
      pubYear: 2024,
      volume: '10',
      issue: '2',
    },
    authors: [
      { foreName: 'John', lastName: 'Smith', initials: 'JM' },
      { foreName: 'Jane', lastName: 'Doe', initials: 'JD' },
    ],
    meshHeadings: ['Neoplasms', 'Drug Therapy'],
    articleIds: [{ doi: '10.1234/test.2024.001' }],
  },
];
```

---

### 9. PrismaService Tests

**File**: `src/prisma/__tests__/prisma.service.spec.ts`

#### Test Cases

| ID | Test Case | Description | Priority |
|----|-----------|-------------|----------|
| PS-01 | constructor - with valid URL | Should initialize with valid DATABASE_URL | High |
| PS-02 | constructor - missing URL | Should throw error when DATABASE_URL missing | High |
| PS-03 | onModuleInit - connect | Should connect on module init | High |
| PS-04 | onModuleDestroy - disconnect | Should disconnect on module destroy | High |
| PS-05 | connection - reuse | Should reuse connection across calls | Medium |

#### Mock Setup

```typescript
// Mock environment
vi.mock('process.env', {
  BIB_DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
});

// Mock pg Pool
vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    end: vi.fn(),
  })),
}));
```

---

## Test Execution Strategy

### Running Tests

```bash
# Run unit tests only
pnpm --filter @libs/bib-lib test:unit

# Run integration tests only
pnpm --filter @libs/bib-lib test:integrated

# Run all tests with coverage
pnpm --filter @libs/bib-lib test:coverage

# Run specific test file
pnpm --filter @libs/bib-lib test -- sync/parsers/__tests__/pubmed.parser.spec.ts
```

### Test Priority Execution Order

1. **Phase 1 - Core Parsing** (High Priority)
   - PubmedParser tests
   - SyncService tests

2. **Phase 2 - Search Services** (High Priority)
   - KeywordSearchService tests
   - SemanticSearchService tests
   - HybridSearchService tests
   - SearchService tests

3. **Phase 3 - Export & Embedding** (Medium Priority)
   - ExportService tests
   - EmbedService tests

4. **Phase 4 - Infrastructure** (Lower Priority)
   - PrismaService tests

---

## Coverage Goals

| Module | Target Coverage | Critical Paths |
|--------|----------------|----------------|
| PubmedParser | 90% | XML parsing, error handling |
| SyncService | 85% | Batch processing, UPSERT logic |
| EmbedService | 80% | Embedding generation, error handling |
| KeywordSearchService | 85% | Query building, filtering |
| SemanticSearchService | 85% | Vector search, similarity |
| HybridSearchService | 85% | Result combination, weighting |
| SearchService | 80% | Mode routing, embedding generation |
| ExportService | 90% | All export formats, escaping |
| PrismaService | 70% | Connection lifecycle |

---

## Test Data Fixtures

### Fixture Files Location

```
libs/bib-lib/src/__fixtures__/
├── articles/
│   ├── minimal-article.xml
│   ├── full-article.xml
│   ├── malformed-article.xml
│   └── batch-articles.xml.gz
├── search/
│   ├── sample-results.json
│   └── sample-embeddings.json
└── export/
    └── sample-search-results.json
```

### Creating Test XML Files

```bash
# Create minimal test gzip file
echo '<PubmedArticleSet><PubmedArticle>...</PubmedArticle></PubmedArticleSet>' | gzip > minimal.xml.gz
```

---

## Integration Test Considerations

### Database Requirements

- Test database with pgvector extension
- Isolated test schema
- Seed data for consistent testing

### Environment Variables

```env
# Test environment
BIB_DATABASE_URL=postgresql://test:test@localhost:5432/biblib_test
EMBEDDING_PROVIDER=mock
```

### Test Database Setup

```typescript
// test-setup.ts
import { PrismaService } from '../prisma/prisma.service';

beforeAll(async () => {
  // Initialize test database
});

afterAll(async () => {
  // Cleanup test database
});

afterEach(async () => {
  // Truncate tables between tests
});
```

---

## Implementation Checklist

### Phase 1: Parser & Sync Tests

- [ ] Create `pubmed.parser.spec.ts` with all 22 test cases
- [ ] Create `sync.service.spec.ts` with all 20 test cases
- [ ] Create test fixtures for XML parsing
- [ ] Set up mock PrismaService

### Phase 2: Search Tests

- [ ] Create `keyword-search.service.spec.ts` with all 20 test cases
- [ ] Create `semantic-search.service.spec.ts` with all 15 test cases
- [ ] Create `hybrid-search.service.spec.ts` with all 15 test cases
- [ ] Create `search.service.spec.ts` with all 14 test cases
- [ ] Set up mock embedding service

### Phase 3: Export & Embed Tests

- [ ] Create `export.service.spec.ts` with all 23 test cases
- [ ] Create `embed.service.spec.ts` with all 15 test cases

### Phase 4: Infrastructure Tests

- [ ] Create `prisma.service.spec.ts` with all 5 test cases

### Phase 5: Integration Tests

- [ ] Set up test database
- [ ] Create integrated test configuration
- [ ] Write end-to-end workflow tests

---

## Summary

| Module | Test Cases | Priority |
|--------|-----------|----------|
| PubmedParser | 22 | High |
| SyncService | 20 | High |
| EmbedService | 15 | Medium |
| KeywordSearchService | 20 | High |
| SemanticSearchService | 15 | High |
| HybridSearchService | 15 | High |
| SearchService | 14 | High |
| ExportService | 23 | Medium |
| PrismaService | 5 | Low |
| **Total** | **149** | - |

This test plan provides comprehensive coverage for all core functionality of the bib-lib library, focusing on the critical paths for XML parsing, data synchronization, search operations, and export functionality.
