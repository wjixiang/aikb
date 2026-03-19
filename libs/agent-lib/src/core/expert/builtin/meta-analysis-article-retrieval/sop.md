# Meta-Analysis Article Retrieval - Standard Operating Procedure

## Overview

This Expert guides the LLM through systematic literature retrieval for meta-analysis, producing standardized search strategies and comprehensive article lists.

## Responsibilities

- Perform systematic literature retrieval for meta-analysis
- Decompose broad clinical questions into focused sub-questions when needed
- Develop and refine PubMed search strategies with MeSH terms and Boolean operators
- Execute iterative searches to achieve appropriate result volumes (<100 per sub-question)
- Retrieve comprehensive article lists without screening
- Document standardized search formulas for reproducibility
- Aggregate and deduplicate results from multiple searches

## Constraints

- MUST NOT screen or filter articles during retrieval
- MUST document every search iteration
- MUST use exact search syntax for reproducibility
- SHOULD prioritize recall over precision
- MAY skip to Phase 1 if initial search returns ≤100 results

## Workflow

### Phase: Preparation (Question Decomposition)

**CRITICAL**: If the initial search returns >100 results, decompose the clinical question into focused sub-questions.

1. **Assess Question Breadth**
   - Execute a preliminary broad search
   - If results >100: Proceed to decomposition
   - If results ≤100: Skip to Phase 1 with single question

2. **Decompose into Sub-Questions**
   - Identify natural divisions in the clinical question:
     - By intervention subtypes (e.g., different drug classes)
     - By population subgroups (e.g., age groups, disease stages)
     - By outcome categories (e.g., mortality vs. morbidity)
     - By comparison groups (e.g., different control conditions)

3. **Validate Decomposition**
   - Each sub-question MUST be clinically meaningful
   - Sub-questions SHOULD be mutually exclusive or minimally overlapping
   - Union of sub-questions MUST cover the original question

### Phase: Search Strategy Development

1. **Understand the Research Question**
   - Identify PICO elements (Population, Intervention, Comparison, Outcome)
   - Extract key concepts and synonyms
   - Identify relevant MeSH terms

2. **Build Initial Search Formula**
   - Use Boolean operators (AND, OR, NOT) appropriately
   - Combine MeSH terms with free-text keywords

3. **Execute Initial Search**
   - Use `search_pubmed` tool with your search formula

### Phase: Search Refinement

4. **Evaluate Result Volume**
   - Too few results (<20): Broaden search
   - Too many results (>100): Further decompose or add filters
   - Appropriate range (20-100): Proceed to retrieval

5. **Refine and Re-search**
   - Modify search formula based on evaluation
   - Document each iteration and rationale

### Phase: Complete Retrieval

6. **Collect All Results**
   - Use `navigate_page` to systematically page through all results
   - Record article metadata (PMID, title, authors, journal, year)
   - Do NOT apply inclusion/exclusion criteria at this stage

7. **Document Search Strategy**
   - Record the final search formula exactly as executed

### Phase: Aggregation

8. **Combine Sub-Question Results**
   - Merge article lists from all sub-questions
   - Identify and remove duplicate PMIDs

9. **Export Aggregated Article List**
   - Compile complete list with all unique PMIDs

## Examples

**Basic diabetes treatment search:**

Input:
```
Research question: Diabetes treatment outcomes
```

Output:
```
## Search Strategy
- Sub-Q1: "metformin[MeSH] OR diabetes[Title/Abstract]" → 45 results
- Sub-Q2: "insulin[MeSH] OR diabetes[Title/Abstract]" → 67 results

## Article List
1. PMID: 12345678 - Title...
2. PMID: 12345679 - Title...

## Total: 89 unique articles
```
