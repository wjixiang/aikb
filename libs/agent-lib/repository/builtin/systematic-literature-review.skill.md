---
name: systematic-literature-review
version: 1.0.0
description: Conduct systematic literature reviews using PubMed database following PRISMA guidelines
category: medical-research
tags: [pubmed, systematic-review, meta-analysis, literature]
---

# Systematic Literature Review

Conduct systematic literature reviews using PubMed database following PRISMA guidelines.

## Capabilities

- Design and execute comprehensive search strategies for PubMed
- Screen and filter articles based on inclusion/exclusion criteria
- Extract key information from relevant articles
- Organize findings by themes and evidence quality
- Generate structured review summaries with citation tracking

## Work Direction

When conducting a systematic literature review:

1. **Define Research Question**: Clarify the PICO (Population, Intervention, Comparison, Outcome) framework
2. **Design Search Strategy**: Create comprehensive search terms with Boolean operators
3. **Execute Search**: Use `search_pubmed` with appropriate filters (Systematic Review, Meta-Analysis, RCT)
4. **Screen Results**: Review titles and abstracts for relevance
5. **Full-Text Review**: Use `view_article` to examine selected articles in detail
6. **Extract Data**: Collect key findings, methods, and outcomes
7. **Synthesize Evidence**: Organize findings by themes and quality levels

## Required Tools

- `search_pubmed`: Search PubMed database with advanced queries
- `view_article`: View detailed article information by PMID
- `navigate_page`: Navigate through search result pages
- `clear_results`: Clear search results to start new queries

## Provided Tools

### design_search_strategy

Design a comprehensive PubMed search strategy based on research question.

**Parameters:**
- `research_question` (string, required): The research question in PICO format
- `include_filters` (array, optional): Article types to include (e.g., ['Systematic Review', 'Meta-Analysis', 'Randomized Controlled Trial'])
- `date_range` (object, optional): Publication date range with `from` and `to` fields
- `max_results` (number, optional): Maximum number of results to retrieve per search. Default: 50

**Returns:**
- `search_terms` (array): List of search term combinations
- `filters` (array): Recommended filters
- `strategy_explanation` (string): Explanation of the search strategy

**Implementation:**

```typescript
async (params, context) => {
  const { research_question, include_filters = ['Systematic Review', 'Meta-Analysis'], date_range, max_results = 50 } = params;

  // Parse PICO components from research question
  const pico = extractPICO(research_question);

  // Generate search terms
  const searchTerms = [];

  // Population terms
  if (pico.population) {
    searchTerms.push(`(${pico.population.join(' OR ')})[Title/Abstract]`);
  }

  // Intervention terms
  if (pico.intervention) {
    searchTerms.push(`(${pico.intervention.join(' OR ')})[Title/Abstract]`);
  }

  // Outcome terms
  if (pico.outcome) {
    searchTerms.push(`(${pico.outcome.join(' OR ')})[Title/Abstract]`);
  }

  // Combine with AND
  const combinedQuery = searchTerms.join(' AND ');

  // Add date filter if specified
  let dateFilter = '';
  if (date_range) {
    dateFilter = ` AND ${date_range.from}:${date_range.to}[pdat]`;
  }

  return {
    search_terms: searchTerms,
    combined_query: combinedQuery + dateFilter,
    filters: include_filters,
    strategy_explanation: `Search strategy targets ${pico.population?.join(', ')} population with ${pico.intervention?.join(', ')} intervention, focusing on ${include_filters.join(', ')} article types.`,
    max_results
  };
}
```

### screen_articles

Screen articles based on inclusion/exclusion criteria.

**Parameters:**
- `articles` (array, required): Array of article objects with title, abstract, pmid
- `inclusion_criteria` (array, required): List of inclusion criteria
- `exclusion_criteria` (array, required): List of exclusion criteria

**Returns:**
- `included` (array): Articles meeting inclusion criteria
- `excluded` (array): Excluded articles with reasons
- `uncertain` (array): Articles requiring full-text review

**Implementation:**

```typescript
async (params, context) => {
  const { articles, inclusion_criteria, exclusion_criteria } = params;

  const included = [];
  const excluded = [];
  const uncertain = [];

  for (const article of articles) {
    const text = `${article.title} ${article.abstract}`.toLowerCase();

    // Check exclusion criteria first
    let isExcluded = false;
    let exclusionReason = '';

    for (const criterion of exclusion_criteria) {
      if (matchesCriterion(text, criterion)) {
        isExcluded = true;
        exclusionReason = criterion;
        break;
      }
    }

    if (isExcluded) {
      excluded.push({
        ...article,
        exclusion_reason: exclusionReason
      });
      continue;
    }

    // Check inclusion criteria
    let matchedCriteria = 0;
    for (const criterion of inclusion_criteria) {
      if (matchesCriterion(text, criterion)) {
        matchedCriteria++;
      }
    }

    // Require at least 70% of inclusion criteria to be met
    const threshold = inclusion_criteria.length * 0.7;

    if (matchedCriteria >= threshold) {
      included.push({
        ...article,
        matched_criteria: matchedCriteria,
        total_criteria: inclusion_criteria.length
      });
    } else if (matchedCriteria > 0) {
      uncertain.push({
        ...article,
        matched_criteria: matchedCriteria,
        total_criteria: inclusion_criteria.length
      });
    } else {
      excluded.push({
        ...article,
        exclusion_reason: 'Does not meet inclusion criteria'
      });
    }
  }

  return {
    included,
    excluded,
    uncertain,
    summary: {
      total: articles.length,
      included: included.length,
      excluded: excluded.length,
      uncertain: uncertain.length
    }
  };
}
```

### extract_study_data

Extract structured data from article details.

**Parameters:**
- `article` (object, required): Article object with full details
- `data_fields` (array, optional): Specific fields to extract. Default: ['study_design', 'sample_size', 'intervention', 'outcomes', 'conclusions']

**Returns:**
- `extracted_data` (object): Structured data extracted from article
- `quality_indicators` (object): Study quality indicators

**Implementation:**

```typescript
async (params, context) => {
  const { article, data_fields = ['study_design', 'sample_size', 'intervention', 'outcomes', 'conclusions'] } = params;

  const extracted = {};
  const text = `${article.title} ${article.abstract}`.toLowerCase();

  // Extract study design
  if (data_fields.includes('study_design')) {
    extracted.study_design = identifyStudyDesign(text);
  }

  // Extract sample size
  if (data_fields.includes('sample_size')) {
    const sizeMatch = text.match(/n\s*=\s*(\d+)/i) || text.match(/(\d+)\s+patients/i);
    extracted.sample_size = sizeMatch ? parseInt(sizeMatch[1]) : null;
  }

  // Extract intervention
  if (data_fields.includes('intervention')) {
    extracted.intervention = extractIntervention(text);
  }

  // Extract outcomes
  if (data_fields.includes('outcomes')) {
    extracted.outcomes = extractOutcomes(text);
  }

  // Extract conclusions
  if (data_fields.includes('conclusions')) {
    extracted.conclusions = extractConclusions(article.abstract);
  }

  // Quality indicators
  const quality = {
    has_abstract: !!article.abstract,
    is_peer_reviewed: article.publication_types?.includes('Journal Article'),
    is_rct: article.publication_types?.includes('Randomized Controlled Trial'),
    is_systematic_review: article.publication_types?.includes('Systematic Review'),
    has_doi: !!article.doi,
    citation_count: article.citation_count || 0
  };

  return {
    pmid: article.pmid,
    title: article.title,
    authors: article.authors,
    journal: article.journal,
    year: article.publication_date?.split('-')[0],
    extracted_data: extracted,
    quality_indicators: quality
  };
}
```

## Orchestration

Execute complete systematic literature review workflow.

**Parameters:**
- `research_question` (string, required): Research question in PICO format
- `inclusion_criteria` (array, required): Inclusion criteria
- `exclusion_criteria` (array, required): Exclusion criteria
- `filters` (array, optional): PubMed filters. Default: ['Systematic Review', 'Meta-Analysis']
- `max_articles` (number, optional): Maximum articles to review. Default: 100

**Workflow:**

```typescript
async (tools, params, context) => {
  const {
    research_question,
    inclusion_criteria,
    exclusion_criteria,
    filters = ['Systematic Review', 'Meta-Analysis'],
    max_articles = 100
  } = params;

  // Step 1: Design search strategy
  console.log('Step 1: Designing search strategy...');
  const strategy = await tools.call('systematic-literature-review__design_search_strategy', {
    research_question,
    include_filters: filters,
    max_results: max_articles
  });

  // Step 2: Execute PubMed search
  console.log('Step 2: Executing PubMed search...');
  const searchResult = await tools.call('search_pubmed', {
    term: strategy.combined_query,
    filter: strategy.filters,
    sort: 'date',
    sortOrder: 'dsc'
  });

  if (!searchResult.results || searchResult.results.length === 0) {
    return {
      status: 'no_results',
      message: 'No articles found matching the search criteria',
      search_strategy: strategy
    };
  }

  // Step 3: Screen articles by title/abstract
  console.log(`Step 3: Screening ${searchResult.results.length} articles...`);
  const screeningResult = await tools.call('systematic-literature-review__screen_articles', {
    articles: searchResult.results,
    inclusion_criteria,
    exclusion_criteria
  });

  // Step 4: Review included articles in detail
  console.log(`Step 4: Reviewing ${screeningResult.included.length} included articles...`);
  const detailedReviews = [];

  for (const article of screeningResult.included.slice(0, 20)) { // Limit to top 20
    try {
      // Get full article details
      await tools.call('view_article', { pmid: article.pmid });

      // Extract structured data
      const extracted = await tools.call('systematic-literature-review__extract_study_data', {
        article: article,
        data_fields: ['study_design', 'sample_size', 'intervention', 'outcomes', 'conclusions']
      });

      detailedReviews.push(extracted);
    } catch (error) {
      console.error(`Failed to review article ${article.pmid}:`, error);
    }
  }

  // Step 5: Synthesize findings
  console.log('Step 5: Synthesizing findings...');
  const synthesis = synthesizeFindings(detailedReviews);

  // Step 6: Generate review summary
  const summary = {
    research_question,
    search_strategy: strategy,
    screening_summary: screeningResult.summary,
    included_studies: detailedReviews.length,
    synthesis: synthesis,
    recommendations: generateRecommendations(synthesis),
    prisma_flow: {
      identified: searchResult.total_results,
      screened: searchResult.results.length,
      included: screeningResult.included.length,
      excluded: screeningResult.excluded.length,
      full_text_reviewed: detailedReviews.length
    }
  };

  return {
    status: 'completed',
    summary,
    detailed_reviews: detailedReviews,
    all_included_articles: screeningResult.included,
    excluded_articles: screeningResult.excluded
  };
}
```

## Helper Functions

```typescript
// Extract PICO components from research question
function extractPICO(question: string): {
  population?: string[];
  intervention?: string[];
  comparison?: string[];
  outcome?: string[];
} {
  const pico: any = {};

  // Simple keyword extraction (in production, use NLP)
  const lowerQuestion = question.toLowerCase();

  // Population keywords
  if (lowerQuestion.includes('patient') || lowerQuestion.includes('adult') || lowerQuestion.includes('children')) {
    pico.population = ['patients', 'adults', 'children'].filter(term => lowerQuestion.includes(term));
  }

  // Intervention keywords
  const interventionKeywords = ['treatment', 'therapy', 'drug', 'intervention', 'surgery'];
  pico.intervention = interventionKeywords.filter(term => lowerQuestion.includes(term));

  // Outcome keywords
  const outcomeKeywords = ['mortality', 'survival', 'efficacy', 'safety', 'outcome'];
  pico.outcome = outcomeKeywords.filter(term => lowerQuestion.includes(term));

  return pico;
}

// Check if text matches criterion
function matchesCriterion(text: string, criterion: string): boolean {
  const keywords = criterion.toLowerCase().split(/\s+/);
  return keywords.some(keyword => text.includes(keyword));
}

// Identify study design from text
function identifyStudyDesign(text: string): string {
  if (text.includes('randomized controlled trial') || text.includes('rct')) {
    return 'Randomized Controlled Trial';
  } else if (text.includes('systematic review')) {
    return 'Systematic Review';
  } else if (text.includes('meta-analysis')) {
    return 'Meta-Analysis';
  } else if (text.includes('cohort study')) {
    return 'Cohort Study';
  } else if (text.includes('case-control')) {
    return 'Case-Control Study';
  } else if (text.includes('cross-sectional')) {
    return 'Cross-Sectional Study';
  }
  return 'Other';
}

// Extract intervention details
function extractIntervention(text: string): string {
  // Look for common intervention patterns
  const patterns = [
    /treated with ([^.,]+)/i,
    /received ([^.,]+)/i,
    /administered ([^.,]+)/i,
    /intervention[:\s]+([^.,]+)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return 'Not specified';
}

// Extract outcomes
function extractOutcomes(text: string): string[] {
  const outcomes = [];
  const outcomeKeywords = ['mortality', 'survival', 'efficacy', 'safety', 'adverse events', 'quality of life'];

  for (const keyword of outcomeKeywords) {
    if (text.includes(keyword)) {
      outcomes.push(keyword);
    }
  }

  return outcomes;
}

// Extract conclusions from abstract
function extractConclusions(abstract: string): string {
  if (!abstract) return 'No abstract available';

  // Look for conclusion section
  const conclusionMatch = abstract.match(/conclusion[s]?[:\s]+([^.]+\.)/i);
  if (conclusionMatch) {
    return conclusionMatch[1];
  }

  // Return last sentence as conclusion
  const sentences = abstract.split(/\.\s+/);
  return sentences[sentences.length - 1] || 'No conclusion found';
}

// Synthesize findings from multiple studies
function synthesizeFindings(reviews: any[]): any {
  const synthesis = {
    total_studies: reviews.length,
    study_designs: {},
    sample_sizes: {
      total: 0,
      mean: 0,
      range: { min: Infinity, max: 0 }
    },
    common_interventions: {},
    common_outcomes: {},
    quality_summary: {
      high_quality: 0,
      medium_quality: 0,
      low_quality: 0
    }
  };

  for (const review of reviews) {
    // Count study designs
    const design = review.extracted_data?.study_design || 'Unknown';
    synthesis.study_designs[design] = (synthesis.study_designs[design] || 0) + 1;

    // Aggregate sample sizes
    const sampleSize = review.extracted_data?.sample_size;
    if (sampleSize) {
      synthesis.sample_sizes.total += sampleSize;
      synthesis.sample_sizes.range.min = Math.min(synthesis.sample_sizes.range.min, sampleSize);
      synthesis.sample_sizes.range.max = Math.max(synthesis.sample_sizes.range.max, sampleSize);
    }

    // Count interventions
    const intervention = review.extracted_data?.intervention;
    if (intervention) {
      synthesis.common_interventions[intervention] = (synthesis.common_interventions[intervention] || 0) + 1;
    }

    // Count outcomes
    const outcomes = review.extracted_data?.outcomes || [];
    for (const outcome of outcomes) {
      synthesis.common_outcomes[outcome] = (synthesis.common_outcomes[outcome] || 0) + 1;
    }

    // Assess quality
    const quality = review.quality_indicators;
    if (quality.is_rct || quality.is_systematic_review) {
      synthesis.quality_summary.high_quality++;
    } else if (quality.is_peer_reviewed && quality.has_abstract) {
      synthesis.quality_summary.medium_quality++;
    } else {
      synthesis.quality_summary.low_quality++;
    }
  }

  // Calculate mean sample size
  const validSampleSizes = reviews.filter(r => r.extracted_data?.sample_size).length;
  if (validSampleSizes > 0) {
    synthesis.sample_sizes.mean = Math.round(synthesis.sample_sizes.total / validSampleSizes);
  }

  return synthesis;
}

// Generate recommendations based on synthesis
function generateRecommendations(synthesis: any): string[] {
  const recommendations = [];

  // Quality recommendation
  const highQualityRatio = synthesis.quality_summary.high_quality / synthesis.total_studies;
  if (highQualityRatio < 0.3) {
    recommendations.push('Consider including more high-quality studies (RCTs or systematic reviews)');
  }

  // Sample size recommendation
  if (synthesis.sample_sizes.mean < 100) {
    recommendations.push('Studies have relatively small sample sizes. Consider meta-analysis for increased power');
  }

  // Study design recommendation
  const hasRCTs = synthesis.study_designs['Randomized Controlled Trial'] > 0;
  if (!hasRCTs) {
    recommendations.push('No RCTs found. Consider expanding search to include randomized controlled trials');
  }

  // General recommendation
  if (synthesis.total_studies < 5) {
    recommendations.push('Limited number of studies. Consider broadening inclusion criteria or search terms');
  }

  return recommendations;
}
```

## Test Cases

### Test Case 1: Complete Systematic Review

**Input:**
```json
{
  "research_question": "What is the efficacy of metformin in treating type 2 diabetes in adult patients?",
  "inclusion_criteria": [
    "type 2 diabetes",
    "metformin",
    "adult patients",
    "clinical trial"
  ],
  "exclusion_criteria": [
    "type 1 diabetes",
    "pediatric",
    "animal study",
    "in vitro"
  ],
  "filters": ["Randomized Controlled Trial", "Systematic Review"],
  "max_articles": 50
}
```

**Expected Output:**
```json
{
  "status": "completed",
  "summary": {
    "research_question": "What is the efficacy of metformin in treating type 2 diabetes in adult patients?",
    "screening_summary": {
      "total": 50,
      "included": 15,
      "excluded": 30,
      "uncertain": 5
    },
    "included_studies": 15,
    "prisma_flow": {
      "identified": 150,
      "screened": 50,
      "included": 15,
      "excluded": 30,
      "full_text_reviewed": 15
    }
  }
}
```

### Test Case 2: Search Strategy Design

**Input:**
```json
{
  "research_question": "Does exercise improve outcomes in heart failure patients?",
  "include_filters": ["Meta-Analysis", "Systematic Review"],
  "date_range": {
    "from": "2020",
    "to": "2024"
  }
}
```

**Expected Output:**
```json
{
  "search_terms": [
    "(heart failure OR cardiac failure)[Title/Abstract]",
    "(exercise OR physical activity)[Title/Abstract]",
    "(outcomes OR mortality OR survival)[Title/Abstract]"
  ],
  "combined_query": "...",
  "filters": ["Meta-Analysis", "Systematic Review"],
  "strategy_explanation": "Search strategy targets heart failure population with exercise intervention..."
}
```

## Metadata

- **Author**: AI Knowledge Base Team
- **Created**: 2025-02-17
- **Last Updated**: 2025-02-17
- **Complexity**: High
- **Domain**: Medical Research
- **Follows**: PRISMA Guidelines
