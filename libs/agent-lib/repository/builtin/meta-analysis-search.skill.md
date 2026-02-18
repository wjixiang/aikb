---
name: meta-analysis-search
version: 1.0.0
description: Conduct systematic literature searches for meta-analysis studies following PRISMA guidelines
category: medical-research
tags: [meta-analysis, pubmed, systematic-search, PRISMA, evidence-synthesis]
---

# Meta-Analysis Literature Search

Conduct systematic literature searches for meta-analysis studies following PRISMA guidelines.

## Capabilities

- Design comprehensive search strategies using PICO/PICOS framework
- Construct complex Boolean queries with field constraints
- Apply appropriate filters (Meta-Analysis, Systematic Review, RCT, etc.)
- Navigate and manage large result sets efficiently
- Extract key information from article abstracts and metadata
- Identify relevant MeSH terms and keywords
- Assess article relevance based on inclusion/exclusion criteria
- Generate PRISMA-compliant search documentation

## Work Direction

When conducting a meta-analysis literature search, follow this structured workflow:

### Phase 1: Define Research Question (PICO/PICOS)

Before searching, clarify with the user:
- **P**opulation: Target patient/population characteristics
- **I**ntervention: Treatment, exposure, or diagnostic test
- **C**omparison: Control group or alternative intervention
- **O**utcome: Primary and secondary outcomes of interest
- **S**tudy design: RCT, cohort, case-control (if applicable)

### Phase 2: Develop Search Strategy

1. **Identify key concepts** from each PICO element
2. **Generate synonyms and related terms** for each concept
3. **Find relevant MeSH terms** using PubMed's controlled vocabulary
4. **Construct Boolean query**:
   - Use OR to combine synonyms within each concept
   - Use AND to combine different PICO elements
   - Use NOT sparingly to exclude irrelevant results

Example query construction:
```
(diabetes mellitus OR type 2 diabetes OR T2DM) AND (metformin OR glucophage) AND (HbA1c OR glycemic control)
```

### Phase 3: Execute Search

Use `search_pubmed` tool with the following parameters:

1. **Start with a broad search** to estimate result volume:
   ```json
   {
     "term": "your constructed query",
     "sort": "date",
     "sortOrder": "dsc"
   }
   ```

2. **Apply filters progressively** for meta-analysis:
   ```json
   {
     "term": "your query",
     "filter": ["Meta-Analysis", "Systematic Review"],
     "sort": "match"
   }
   ```

3. **Supported filter types**:
   - Meta-Analysis
   - Systematic Review
   - Randomized Controlled Trial
   - Clinical Trial
   - Review
   - Books and Documents

4. **Sort options**:
   - `match`: By relevance (recommended for initial search)
   - `date`: By entry date
   - `pubdate`: By publication date
   - `fauth`: By first author
   - `jour`: By journal

### Phase 4: Screen Results

1. Review titles and abstracts from search results
2. Use `view_article` to examine promising articles:
   ```json
   {
     "pmid": "12345678"
   }
   ```
3. Note key information:
   - Study design and sample size
   - Intervention details
   - Outcome measures
   - Potential for inclusion

4. Use `navigate_page` to browse through results:
   ```json
   {
     "direction": "next"
   }
   ```

### Phase 5: Document and Report

1. Record total hits at each search stage
2. Note reasons for exclusion
3. Prepare PRISMA flow diagram data:
   - Records identified
   - Duplicates removed
   - Records screened
   - Records excluded
   - Full-text assessed
   - Studies included

4. Use `clear_results` before starting a new search strategy

### Search Tips

- Start broad, then narrow down with filters
- Use quotation marks for exact phrases: `"heart failure"`
- Combine PICO elements with AND
- Use OR for synonyms within each element
- Apply date filters for recent evidence
- Check MeSH terms for standardized vocabulary
- Consider publication bias by varying search terms

### Quality Indicators for Search Strategy

- Comprehensive coverage of key concepts
- Reproducible search strategy (document exact terms)
- Appropriate use of Boolean operators
- Balanced sensitivity vs. specificity
- Multiple filter combinations tested

## Required Tools

- `search_pubmed`: Search PubMed database with term, filters, and sorting options
  - Parameters:
    - `term` (string): Search query with Boolean operators
    - `sort` (enum): match | date | pubdate | fauth | jour
    - `sortOrder` (enum): asc | dsc
    - `filter` (array): Article type filters
    - `page` (number): Page number for pagination

- `view_article`: View detailed article information by PMID
  - Parameters:
    - `pmid` (string): PubMed ID of the article

- `navigate_page`: Navigate through paginated search results
  - Parameters:
    - `direction` (enum): next | prev

- `clear_results`: Clear current search results and start fresh

## Test Cases

### Test Case 1: Basic Meta-Analysis Search

**Input:**
```json
{
  "tool": "search_pubmed",
  "params": {
    "term": "(diabetes mellitus OR type 2 diabetes) AND (metformin) AND (efficacy OR effectiveness)",
    "filter": ["Meta-Analysis", "Systematic Review"],
    "sort": "date",
    "sortOrder": "dsc"
  }
}
```

**Expected Behavior:**
- Returns list of meta-analyses and systematic reviews
- Results sorted by most recent first
- Each result includes PMID, title, authors, journal, abstract

### Test Case 2: View Article Details

**Input:**
```json
{
  "tool": "view_article",
  "params": {
    "pmid": "35123456"
  }
}
```

**Expected Behavior:**
- Returns full article details including MeSH terms
- Shows publication type, DOI, and citation information

### Test Case 3: Paginated Search

**Input:**
```json
{
  "tool": "navigate_page",
  "params": {
    "direction": "next"
  }
}
```

**Expected Behavior:**
- Loads next page of search results
- Maintains current search query and filters

## Metadata

- **Author**: AI Knowledge Base Team
- **Created**: 2025-02-18
- **Last Updated**: 2025-02-18
- **Complexity**: Medium
- **Domain**: Medical Research
- **Follows**: PRISMA Guidelines
- **Required Component**: BibliographySearchComponent
