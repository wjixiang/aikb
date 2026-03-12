# Meta-Analysis Article Retrieval

## Overview
This Expert guides the LLM through systematic literature retrieval for meta-analysis, producing standardized search strategies and comprehensive article lists.

## When to Use
Use this Expert when you need to conduct systematic literature searches for meta-analysis or systematic reviews. This includes tasks like: searching PubMed for clinical studies, building search strategies with MeSH terms and Boolean operators, retrieving comprehensive article lists, or conducting literature searches for evidence-based medicine research.

## Parameters
- **research_question** (required): The clinical question or topic for the meta-analysis
- **databases** (optional, default: "PubMed"): Search databases to use
- **target_results_per_query** (optional, default: "<100"): Target number of results per sub-question

## Steps

### Phase 0: Question Decomposition (for Broad Questions)
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
   - Example: "Antihypertensive drugs for cardiovascular outcomes" →
     - Sub-Q1: ACE inhibitors for cardiovascular outcomes
     - Sub-Q2: Beta-blockers for cardiovascular outcomes
     - Sub-Q3: Calcium channel blockers for cardiovascular outcomes
     - Sub-Q4: Diuretics for cardiovascular outcomes

3. **Validate Decomposition**
   - Each sub-question MUST be clinically meaningful
   - Sub-questions SHOULD be mutually exclusive or minimally overlapping
   - Union of sub-questions MUST cover the original question
   - Target: Each sub-question retrieves <100 articles

### Phase 1: Search Strategy Development (Per Sub-Question)

1. **Understand the Research Question**
   - Identify PICO elements (Population, Intervention, Comparison, Outcome)
   - Extract key concepts and synonyms
   - Identify relevant MeSH terms

2. **Build Initial Search Formula**
   - Use Boolean operators (AND, OR, NOT) appropriately
   - Combine MeSH terms with free-text keywords
   - Structure: (Population terms) AND (Intervention terms) AND (Outcome terms)
   - Example: ("diabetes mellitus"[MeSH] OR diabetes[Title/Abstract]) AND ("metformin"[MeSH] OR metformin[Title/Abstract])

3. **Execute Initial Search**
   - Use `search_pubmed` tool with your search formula
   - You MUST record the number of results returned
   - Target: <100 results per sub-question

### Phase 2: Search Refinement (Iterative, Per Sub-Question)

4. **Evaluate Result Volume**
   - Too few results (<20): Search may be too narrow
     - You SHOULD remove restrictive filters
     - You SHOULD add synonyms and related terms
     - You MAY broaden MeSH term hierarchy
   - Too many results (>100): Search is too broad
     - You MUST first consider further decomposition into smaller sub-questions
     - If already maximally decomposed:
       - You SHOULD add more specific intervention terms
       - You SHOULD add specific outcome measures
       - You MAY include study type filters [pt]
       - You MAY add date restrictions if appropriate
   - Appropriate range (20-100): Proceed to retrieval

5. **Refine and Re-search**
   - Modify search formula based on evaluation
   - You MUST document each iteration and rationale
   - Use `clear_results` before new searches to avoid confusion
   - Repeat until result volume is appropriate (<100)

### Phase 3: Complete Retrieval (Per Sub-Question)

6. **Collect All Results**
   - Use `navigate_page` to systematically page through all results
   - For each page, record article metadata (PMID, title, authors, journal, year)
   - Continue until all pages are retrieved
   - You MUST NOT apply inclusion/exclusion criteria at this stage

7. **Document Search Strategy**
   - Record the final search formula exactly as executed
   - Note the sub-question identifier (if decomposed)
   - Note the database (PubMed), date of search, and total results

### Phase 4: Aggregation (If Decomposed)

8. **Combine Sub-Question Results**
   - Merge article lists from all sub-questions
   - Identify and remove duplicate PMIDs
   - Document total unique articles retrieved
   - Preserve sub-question tags for traceability

9. **Document Complete Search Strategy**
   - List all sub-questions and their search formulas
   - Provide rationale for decomposition approach
   - Report results per sub-question and total unique articles

10. **Export Aggregated Article List**
    - Compile complete list with all unique PMIDs
    - Include basic metadata for each article
    - Tag each article with its source sub-question(s)

## Examples

**Input:**
```
Research question: Diabetes treatment outcomes
```

**Expected Output:**
```
## Search Strategy
- Sub-Q1: "metformin[MeSH] OR diabetes[Title/Abstract]" → 45 results
- Sub-Q2: "insulin[MeSH] OR diabetes[Title/Abstract]" → 67 results

## Article List
1. PMID: 12345678 - Title...
2. PMID: 12345679 - Title...
...

## Total: 89 unique articles
```

## Constraints
- You MUST NOT screen or filter articles during retrieval
- You MUST document every search iteration
- You MUST use exact search syntax for reproducibility
- You SHOULD prioritize recall over precision
- You MAY skip to Phase 1 if initial search returns ≤100 results
