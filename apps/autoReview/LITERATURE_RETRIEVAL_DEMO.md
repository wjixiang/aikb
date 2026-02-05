# Literature Retrieval Demonstration

This document provides a comprehensive guide to the literature retrieval functionality of the Meta-Analysis Agent.

## Overview

The literature retrieval system demonstrates how AI-powered agents can automate the process of finding, screening, and extracting data from scientific literature. It combines:

- **LLM-Powered Query Generation**: Transforms research questions into optimized PubMed search queries
- **PubMed Integration**: Direct access to PubMed's vast biomedical literature database
- **AI Screening**: Intelligent article relevance assessment
- **Structured Data Extraction**: Automated extraction of study data

## Quick Start

```bash
# View available demos
npx tsx demo-literature-retrieval.ts help

# Run a specific demo
npx tsx demo-literature-retrieval.ts query    # Query generation
npx tsx demo-literature-retrieval.ts search   # PubMed search
npx tsx demo-literature-retrieval.ts details  # Article details
npx tsx demo-literature-retrieval.ts screen   # Article screening
npx tsx demo-literature-retrieval.ts extract  # Data extraction
npx tsx demo-literature-retrieval.ts full     # Complete workflow
```

## Prerequisites

1. **GLM API Key**: Set your API key as an environment variable

   ```bash
   export GLM_API_KEY=your_api_key_here
   ```

2. **Internet Connection**: Required for accessing PubMed and GLM API

3. **Node.js**: Version 18 or higher recommended

## Demo Descriptions

### Demo 1: Query Generation

**Purpose**: Demonstrates how the LLM generates optimized PubMed search queries from research questions.

**What it shows**:

- PICO framework analysis
- MeSH term identification
- Boolean operator generation
- Filter application (study types, language, species)

**Example Input**:

```
Research Question: "In adult patients with type 2 diabetes, does SGLT2
inhibitor therapy compared to placebo reduce cardiovascular events?"

PICO:
- Population: Adults (≥18 years) with type 2 diabetes
- Intervention: SGLT2 inhibitors
- Comparison: Placebo
- Outcome: Cardiovascular events
```

**Example Output**:

```
Generated Query:
(
  "Diabetes Mellitus, Type 2"[Mesh] OR
  "type 2 diabetes"[Tiab] OR
  "T2DM"[Tiab]
) AND (
  "Sodium-Glucose Transporter 2 Inhibitors"[Mesh] OR
  "SGLT2 inhibitor*"[Tiab] OR
  "gliflozin*"[Tiab]
) AND (
  "Cardiovascular Diseases"[Mesh] OR
  "mortality"[Tiab] OR
  "heart failure"[Tiab]
) AND "Randomized Controlled Trial"[ptyp]
```

### Demo 2: PubMed Search

**Purpose**: Demonstrates flexible PubMed searching with various parameters.

**What it shows**:

- Different sorting options (date, relevance)
- Filter application (RCTs, meta-analyses, humans)
- Result pagination
- Article profile extraction

**Search Examples**:

1. **SGLT2 Inhibitors and Cardiovascular Outcomes**
   - Sort: Date (descending)
   - Filters: RCTs, Humans

2. **Thiazide Diuretics and Hypertension**
   - Sort: Relevance
   - Filters: Humans

3. **COVID-19 Meta-Analyses**
   - Sort: Date (descending)
   - Filters: Meta-analyses, Systematic Reviews

**Output Fields**:

- PMID (PubMed ID)
- Title
- Authors
- Journal Citation
- DOI
- Abstract Snippet

### Demo 3: Article Detail Retrieval

**Purpose**: Shows comprehensive article information extraction.

**What it retrieves**:

- Full title and abstract
- Complete author list with affiliations
- Journal information
- Publication types
- Keywords and MeSH terms
- DOI and citation information
- Similar articles
- References

**Example Articles**:

- PMID 28065393: EMPA-REG OUTCOME trial
- PMID 26422318: CANVAS Program
- PMID 30103216: DECLARE-TIMI 58 trial

### Demo 4: Article Screening

**Purpose**: Demonstrates AI-powered relevance screening.

**Screening Process**:

1. Population matching assessment
2. Intervention relevance check
3. Outcome measurement verification
4. Study design evaluation
5. Inclusion/exclusion decision

**Criteria Applied**:

- Population: Adults with type 2 diabetes
- Intervention: SGLT2 inhibitors
- Comparison: Placebo or standard care
- Outcome: Cardiovascular events or mortality
- Study Design: Randomized controlled trials
- Language: English
- Species: Humans

### Demo 5: Data Extraction

**Purpose**: Shows structured data extraction from articles.

**Extracted Data Points**:

- Study design and methodology
- Sample size and population characteristics
- Intervention details (dose, duration)
- Comparison group information
- Primary and secondary outcomes
- Effect sizes and confidence intervals
- Adverse events
- Study quality indicators

### Demo 6: Complete Workflow

**Purpose**: End-to-end demonstration of the entire literature retrieval process.

**Workflow Steps**:

1. **Generate Search Query** (LLM)
   - Analyze research question
   - Create PubMed search string

2. **Search PubMed**
   - Execute search
   - Retrieve article profiles

3. **Get Article Details**
   - Fetch full article information
   - Extract abstracts and metadata

4. **Screen Articles** (LLM)
   - Assess relevance
   - Apply inclusion/exclusion criteria

5. **Extract Data** (LLM)
   - Pull structured study data
   - Identify key findings

6. **Generate Report** (LLM)
   - Synthesize findings
   - Create structured report

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Literature Retrieval System                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │ Research Question│────▶│  LLM Query Gen  │                   │
│  │   (PICO)        │     │  (GLM-4.7)      │                   │
│  └─────────────────┘     └────────┬────────┘                   │
│                                   │                             │
│                                   ▼                             │
│                          ┌─────────────────┐                   │
│                          │  PubMed Search  │                   │
│                          │  (PubmedService)│                   │
│                          └────────┬────────┘                   │
│                                   │                             │
│                                   ▼                             │
│                          ┌─────────────────┐                   │
│                          │ Article Profiles│                   │
│                          │   (PMID, Title, │                   │
│                          │   Authors, etc.) │                   │
│                          └────────┬────────┘                   │
│                                   │                             │
│                                   ▼                             │
│                          ┌─────────────────┐                   │
│                          │ Get Details     │                   │
│                          │ (Abstract, MeSH,│                   │
│                          │  Full Text)     │                   │
│                          └────────┬────────┘                   │
│                                   │                             │
│                                   ▼                             │
│                          ┌─────────────────┐                   │
│                          │ LLM Screening   │                   │
│                          │ (Relevance)     │                   │
│                          └────────┬────────┘                   │
│                                   │                             │
│                                   ▼                             │
│                          ┌─────────────────┐                   │
│                          │ LLM Extraction  │                   │
│                          │ (Study Data)    │                   │
│                          └────────┬────────┘                   │
│                                   │                             │
│                                   ▼                             │
│                          ┌─────────────────┐                   │
│                          │ Structured Data │                   │
│                          └─────────────────┘                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. MetaAnalysisAgent

The main orchestrator that coordinates the entire workflow.

**Methods**:

- `runMetaAnalysis()`: Complete end-to-end workflow
- `quickSearch()`: Search only, no analysis
- `generateSearchQuery()`: LLM-powered query generation
- `searchPubMed()`: Execute PubMed search
- `getArticleDetails()`: Retrieve full article information
- `screenArticles()`: AI-powered screening
- `extractStudyData()`: Structured data extraction
- `generateReport()`: Final report synthesis

### 2. PubmedService

Direct interface to PubMed's database.

**Methods**:

- `searchByPattern()`: Search with parameters
- `getArticleDetail()`: Get full article details
- `loadArticle()`: Load article page

**Parameters**:

- `term`: Search query string
- `sort`: 'date' | 'match' | 'pubdate' | 'fauth' | 'jour'
- `sortOrder`: 'asc' | 'dsc'
- `filter`: Array of filters (e.g., 'pubt.randomizedcontrolledtrial')
- `page`: Page number for pagination

### 3. BAML Client

LLM integration via BoundaryML.

**Functions**:

- `GenerateMetaAnalysisSearchQuery`: Query generation
- `ScreenArticles`: Relevance screening
- `ExtractStudyData`: Data extraction
- `SynthesizeMetaAnalysis`: Findings synthesis
- `GenerateMetaAnalysisReport`: Report generation

## Data Structures

### ArticleProfile

```typescript
interface ArticleProfile {
  doi: string | null;
  pmid: string;
  title: string;
  authors: string;
  journalCitation: string;
  snippet: string;
  position?: number;
}
```

### MetaAnalysisRequest

```typescript
interface MetaAnalysisRequest {
  question: string; // Research question
  context?: string; // Additional context
  population: string; // PICO - Population
  intervention: string; // PICO - Intervention
  comparison: string; // PICO - Comparison
  outcome: string; // PICO - Outcome
  maxArticles?: number; // Limit results
  dateFrom?: string; // Date range start
  dateTo?: string; // Date range end
}
```

### MetaAnalysisProgress

```typescript
interface MetaAnalysisProgress {
  step: string; // Current step (e.g., "1/6")
  message: string; // Progress message
  details?: any; // Additional details
}
```

## Use Cases

### 1. Systematic Reviews

Automate the literature search and screening process for systematic reviews.

```typescript
const request: MetaAnalysisRequest = {
  question:
    'What is the efficacy of mindfulness-based interventions for anxiety disorders?',
  population: 'Adults with diagnosed anxiety disorders',
  intervention: 'Mindfulness-based interventions (MBSR, MBCT, ACT)',
  comparison: 'Waitlist, treatment-as-usual, or active control',
  outcome: 'Anxiety symptom reduction, remission rates, quality of life',
  maxArticles: 100,
};
```

### 2. Clinical Evidence Summaries

Quickly gather and summarize evidence for clinical questions.

```typescript
const request: MetaAnalysisRequest = {
  question:
    'In patients with atrial fibrillation, does left atrial appendage closure reduce stroke risk compared to anticoagulation?',
  population: 'Patients with non-valvular atrial fibrillation',
  intervention: 'Left atrial appendage closure (Watchman, Amplatzer)',
  comparison: 'Oral anticoagulation (warfarin, DOACs)',
  outcome: 'Stroke, systemic embolism, bleeding, mortality',
  maxArticles: 50,
};
```

### 3. Drug Safety Surveillance

Monitor literature for adverse drug events.

```typescript
const request: MetaAnalysisRequest = {
  question:
    'What are the reported adverse events associated with SGLT2 inhibitors?',
  population: 'Patients with type 2 diabetes',
  intervention: 'SGLT2 inhibitors',
  comparison: 'None (safety surveillance)',
  outcome: 'Adverse events, serious adverse events, discontinuation',
  maxArticles: 200,
};
```

## Performance Considerations

### API Rate Limits

- **GLM API**: Approximately 2-3 requests per second
- **PubMed**: No strict rate limit, but be respectful

### Batch Processing

Articles are processed in batches of 5 to avoid overwhelming servers.

### Caching

Consider implementing caching for:

- PubMed search results
- Article details
- LLM responses

## Limitations

1. **Single Database**: Only searches PubMed (not Embase, Cochrane, etc.)
2. **LLM Accuracy**: Screening and extraction depend on LLM performance
3. **No Full Text**: Uses abstracts only (full text requires subscription)
4. **Language**: Primarily optimized for English
5. **Real-Time**: No offline mode

## Future Enhancements

1. **Multi-Database Search**: Add Embase, Cochrane, Web of Science
2. **Full Text Integration**: PDF parsing and analysis
3. **Quality Assessment**: Cochrane RoB2, ROBINS-I tools
4. **Statistical Analysis**: Meta-analysis with effect size pooling
5. **Export Formats**: PRISMA diagrams, forest plots, CSV/Excel
6. **Collaboration**: Multi-user review and annotation
7. **Notifications**: New article alerts for saved searches

## Troubleshooting

### GLM API Key Not Found

```bash
# Set the environment variable
export GLM_API_KEY=your_key_here

# Or create a .env file
echo "GLM_API_KEY=your_key_here" > .env
```

### PubMed Search Returns No Results

- Check your search query syntax
- Verify filter terms are correct
- Try broader search terms
- Check PubMed status

### LLM Screening Errors

- Verify API key is valid
- Check API quota/limits
- Reduce batch size
- Check internet connection

## Related Documentation

- [META_ANALYSIS_README.md](./META_ANALYSIS_README.md) - Main meta-analysis documentation
- [REAL_API_DEMO_RESULTS.md](./REAL_API_DEMO_RESULTS.md) - Real API test results
- [meta-analysis-agent.ts](./src/lib/meta-analysis-agent.ts) - Core implementation

## License

MIT
