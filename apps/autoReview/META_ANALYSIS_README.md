# Meta-Analysis Agent

Automated literature retrieval and analysis for systematic reviews and meta-analyses using LLM agents and PubMed.

## Overview

This is a proof-of-concept system that demonstrates an AI-powered meta-analysis workflow. It combines:

- **BAML** (BoundaryML) for LLM function orchestration
- **PubMed** for literature retrieval
- **AI agents** for screening, data extraction, and synthesis

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Meta-Analysis Workflow                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Research Question (PICO)                                     │
│     └─> Generate Search Strategy (LLM)                           │
│         └─> PubMed Query                                        │
│                                                                   │
│  2. Literature Retrieval                                         │
│     └─> Search PubMed                                           │
│     └─> Get Article Details                                     │
│                                                                   │
│  3. Article Screening (LLM)                                      │
│     └─> Relevance Assessment                                     │
│     └─> Inclusion/Exclusion Decisions                            │
│                                                                   │
│  4. Data Extraction (LLM)                                       │
│     └─> Study Population                                        │
│     └─> Intervention/Comparison                                  │
│     └─> Outcomes & Effect Sizes                                 │
│     └─> Quality Assessment                                      │
│                                                                   │
│  5. Synthesis (LLM)                                             │
│     └─> Qualitative Synthesis                                   │
│     └─> Pooled Effect Sizes (if applicable)                     │
│     └─> Heterogeneity & Bias Assessment                        │
│                                                                   │
│  6. Report Generation (LLM)                                     │
│     └─> Structured Meta-Analysis Report                         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Module Structure

```
apps/autoReview/
├── baml_src/
│   ├── generators.baml              # BAML workflow functions
│   ├── clients.baml                 # LLM client configuration
│   └── types.baml                   # Shared types
├── src/
│   ├── baml_client/                 # Generated BAML client
│   └── lib/
│       ├── meta-analysis-agent.ts   # Main agent service
│       └── meta-analysis-demo.ts    # Demo examples
├── demo-literature-retrieval.ts     # Literature retrieval demos
├── demo-real-api.ts                 # Real API demo script
├── LITERATURE_RETRIEVAL_DEMO.md     # Literature retrieval documentation
├── META_ANALYSIS_README.md          # This file
└── REAL_API_DEMO_RESULTS.md         # Real API test results
```

## Usage

### Basic Example

```typescript
import { MetaAnalysisAgent, MetaAnalysisRequest } from '@autoReview';

// Create agent with PubMed service
const agent = new MetaAnalysisAgent(pubmedService);

// Define research question
const request: MetaAnalysisRequest = {
  question:
    'In adult patients with type 2 diabetes, does SGLT2 inhibitor therapy compared to placebo reduce cardiovascular events?',
  population: 'Adults (≥18 years) with type 2 diabetes mellitus',
  intervention: 'SGLT2 inhibitors (empagliflozin, canagliflozin)',
  comparison: 'Placebo',
  outcome: 'Major adverse cardiovascular events, cardiovascular mortality',
  maxArticles: 100,
};

// Run meta-analysis with progress updates
const report = await agent.runMetaAnalysis(request, (progress) => {
  console.log(`[${progress.step}] ${progress.message}`);
});

console.log(report);
```

### With Progress Callback

```typescript
await agent.runMetaAnalysis(request, (progress) => {
  switch (progress.step) {
    case '1/6':
      console.log('Generating search strategy...');
      break;
    case '2/6':
      console.log('Searching PubMed...');
      console.log('Query:', progress.details.query);
      break;
    case '3/6':
      console.log('Retrieving article details...');
      break;
    case '4/6':
      console.log('Screening articles...');
      break;
    case '5/6':
      console.log('Extracting study data...');
      break;
    case '6/6':
      console.log('Generating report...');
      break;
  }
});
```

### Quick Search Only

```typescript
// Get articles without full analysis
const articles = await agent.quickSearch(request);
console.log(`Found ${articles.length} articles`);
```

## Running the Demo

### Literature Retrieval Demo (Recommended)

```bash
# View available literature retrieval demos
npx tsx apps/autoReview/demo-literature-retrieval.ts help

# Run specific demos
npx tsx apps/autoReview/demo-literature-retrieval.ts query    # Query generation demo
npx tsx apps/autoReview/demo-literature-retrieval.ts search   # PubMed search demo
npx tsx apps/autoReview/demo-literature-retrieval.ts details  # Article details demo
npx tsx apps/autoReview/demo-literature-retrieval.ts screen   # Article screening demo
npx tsx apps/autoReview/demo-literature-retrieval.ts extract  # Data extraction demo
npx tsx apps/autoReview/demo-literature-retrieval.ts full     # Complete workflow demo
```

See [LITERATURE_RETRIEVAL_DEMO.md](./LITERATURE_RETRIEVAL_DEMO.md) for detailed documentation.

### Meta-Analysis Demo

```bash
# Run SGLT2 cardiovascular meta-analysis demo
npx tsx apps/autoReview/src/lib/meta-analysis-demo.ts sglt2

# Run quick search demo
npx tsx apps/autoReview/src/lib/meta-analysis-demo.ts search
```

### Real API Demo

```bash
# Run with real GLM API and PubMed
npx tsx apps/autoReview/demo-real-api.ts sglt2

# Quick search with real APIs
npx tsx apps/autoReview/demo-real-api.ts search
```

## BAML Functions

The system uses the following BAML functions:

### 1. GenerateMetaAnalysisSearchQuery

Generates a PubMed search query from a research question using PICO framework.

### 2. ScreenArticles

Screens articles for relevance using LLM-based inclusion/exclusion criteria.

### 3. ExtractStudyData

Extracts structured study data from articles (population, intervention, outcomes, effect sizes).

### 4. SynthesizeMetaAnalysis

Synthesizes findings across studies and generates meta-analysis results.

### 5. GenerateMetaAnalysisReport

Generates a comprehensive, structured meta-analysis report.

## Integration with PubMed

The agent requires a PubMed service that implements:

```typescript
interface IPubmedService {
  searchByPattern(params: {
    term: string;
    sort?: string;
    sortOrder?: string;
    filter?: string[];
    page?: number;
  }): Promise<{
    totalResults: number | null;
    totalPages: number | null;
    articleProfiles: ArticleProfile[];
    html: string;
  }>;

  getArticleDetail(pmid: string): Promise<{
    title: string;
    authors: Array<{ name: string }>;
    journalInfo: { title?: string; pubDate?: string };
    abstract: string;
    doi: string;
    publicationTypes: string[];
  }>;
}
```

Use the existing `PubmedService` from `@medDatabasePortal/pubmed` for production.

## Limitations

This is a proof-of-concept system with the following limitations:

1. **LLM Accuracy**: Screening and data extraction depend on LLM accuracy
2. **No Statistical Analysis**: Effect size pooling is descriptive, not statistical
3. **Single Database**: Only searches PubMed (not Embase, Cochrane, etc.)
4. **No Human Review**: Doesn't include human-in-the-loop validation
5. **Limited Bias Assessment**: Basic quality scoring without formal tools

## Future Improvements

1. **Multi-Database Search**: Add Embase, Cochrane, Web of Science
2. **Statistical Analysis**: Integrate R/metafor for pooled effect sizes
3. **Risk of Bias Tools**: Add Cochrane RoB2, ROBINS-I
4. **Human Review**: Add review interface for validation
5. **Export Formats**: Generate PRISMA flow diagrams, forest plots
6. **Caching**: Cache PubMed results and LLM responses
7. **Batch Processing**: Process multiple studies in parallel

## Testing

Run BAML tests:

```bash
cd apps/autoReview
npx baml-cli test --from baml_src
```

Run TypeScript tests:

```bash
npx vitest run --config apps/autoReview/vite.config.mts
```

## License

MIT
