# Meta-Analysis Article Retrieval - Direction

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

3. **Validate Decomposition**
   - Each sub-question MUST be clinically meaningful
   - Sub-questions SHOULD be mutually exclusive or minimally overlapping
   - Union of sub-questions MUST cover the original question

### Phase 1: Search Strategy Development

1. **Understand the Research Question**
   - Identify PICO elements (Population, Intervention, Comparison, Outcome)
   - Extract key concepts and synonyms
   - Identify relevant MeSH terms

2. **Build Initial Search Formula**
   - Use Boolean operators (AND, OR, NOT) appropriately
   - Combine MeSH terms with free-text keywords

3. **Execute Initial Search**
   - Use `search_pubmed` tool with your search formula

### Phase 2: Search Refinement

4. **Evaluate Result Volume**
   - Too few results (<20): Broaden search
   - Too many results (>100): Further decompose or add filters
   - Appropriate range (20-100): Proceed to retrieval

5. **Refine and Re-search**
   - Modify search formula based on evaluation
   - Document each iteration and rationale

### Phase 3: Complete Retrieval

6. **Collect All Results**
   - Use `navigate_page` to systematically page through all results
   - Record article metadata (PMID, title, authors, journal, year)
   - Do NOT apply inclusion/exclusion criteria at this stage

7. **Document Search Strategy**
   - Record the final search formula exactly as executed

### Phase 4: Aggregation

8. **Combine Sub-Question Results**
   - Merge article lists from all sub-questions
   - Identify and remove duplicate PMIDs

9. **Export Aggregated Article List**
   - Compile complete list with all unique PMIDs

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

## Total: 89 unique articles
```
