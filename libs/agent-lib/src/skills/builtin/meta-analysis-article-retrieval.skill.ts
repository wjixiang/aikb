import { defineSkill } from '../SkillDefinition.js';

/**
 * Meta-Analysis Article Retrieval Skill
 *
 * Guides LLM through systematic literature retrieval for meta-analysis,
 * producing standardized search strategies and comprehensive article lists.
 */

export default defineSkill({
    name: 'meta-analysis-article-retrieval',
    displayName: 'Meta-Analysis Article Retrieval',
    description: 'Systematic literature retrieval for meta-analysis, producing standardized search strategies and comprehensive article lists',
    version: '1.0.0',
    category: 'meta-analysis',
    tags: ['meta-analysis', 'literature-retrieval', 'pubmed', 'systematic-review', 'search-strategy'],
    triggers: [
        'meta analysis retrieval',
        'literature search',
        'systematic search',
        'pubmed search strategy',
        'article retrieval'
    ],

    capabilities: [
        'Decompose broad clinical questions into focused sub-questions for manageable retrieval',
        'Design and refine PubMed search strategies using Boolean operators and MeSH terms',
        'Execute iterative searches to achieve appropriate result volumes (<100 per sub-question)',
        'Retrieve comprehensive article lists without screening or filtering',
        'Document standardized search formulas for reproducibility',
        'Navigate and collect paginated search results',
        'Aggregate results from multiple sub-question searches',
        'Export complete bibliographic records for downstream analysis'
    ],

    workDirection: `You are conducting the literature retrieval phase of a meta-analysis. Your goal is to produce:
1. A standardized, reproducible search strategy (possibly decomposed into sub-questions)
2. A comprehensive list of all retrieved articles (NO screening at this stage)

## Workflow

### Phase 0: Question Decomposition (for Broad Questions)
**CRITICAL**: If the initial search returns >100 results, decompose the clinical question into focused sub-questions.

1. **Assess Question Breadth**
   - Execute a preliminary broad search
   - If results >100: Proceed to decomposition
   - If results ≤100: Skip to Phase 1 with single question

2. **Decompose into Sub-Questions**
   - Identify natural divisions in the clinical question:
     * By intervention subtypes (e.g., different drug classes)
     * By population subgroups (e.g., age groups, disease stages)
     * By outcome categories (e.g., mortality vs. morbidity)
     * By comparison groups (e.g., different control conditions)

   - Example: "Antihypertensive drugs for cardiovascular outcomes" →
     * Sub-Q1: ACE inhibitors for cardiovascular outcomes
     * Sub-Q2: Beta-blockers for cardiovascular outcomes
     * Sub-Q3: Calcium channel blockers for cardiovascular outcomes
     * Sub-Q4: Diuretics for cardiovascular outcomes

3. **Validate Decomposition**
   - Each sub-question should be clinically meaningful
   - Sub-questions should be mutually exclusive or minimally overlapping
   - Union of sub-questions should cover the original question
   - Target: Each sub-question retrieves <100 articles

### Phase 1: Search Strategy Development (Per Sub-Question)
For each sub-question (or the single question if no decomposition):

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
   - Use \`search_pubmed\` tool with your search formula
   - Record the number of results returned
   - Target: <100 results per sub-question

### Phase 2: Search Refinement (Iterative, Per Sub-Question)
4. **Evaluate Result Volume**
   - Too few results (<20): Search may be too narrow
     * Remove restrictive filters
     * Add synonyms and related terms
     * Broaden MeSH term hierarchy
   - Too many results (>100): Search is too broad
     * **FIRST**: Consider further decomposition into smaller sub-questions
     * If already maximally decomposed:
       - Add more specific intervention terms
       - Add specific outcome measures
       - Include study type filters [pt] (e.g., "randomized controlled trial"[pt])
       - Add date restrictions if appropriate
   - Appropriate range (20-100): Proceed to retrieval

5. **Refine and Re-search**
   - Modify search formula based on evaluation
   - Document each iteration and rationale
   - Use \`clear_results\` before new searches to avoid confusion
   - Repeat until result volume is appropriate (<100)

### Phase 3: Complete Retrieval (Per Sub-Question)
6. **Collect All Results**
   - Use \`navigate_page\` to systematically page through all results
   - For each page, record article metadata (PMID, title, authors, journal, year)
   - Continue until all pages are retrieved
   - Do NOT apply inclusion/exclusion criteria at this stage

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
   - Format for reproducibility in methods section

10. **Export Aggregated Article List**
    - Compile complete list with all unique PMIDs
    - Include basic metadata for each article
    - Tag each article with its source sub-question(s)
    - Prepare for downstream screening phase (not part of this skill)

## Best Practices

- **Question Decomposition**: When facing broad questions, decompose early to keep sub-searches manageable (<100 results each)
- **Transparency**: Document every search iteration, decomposition decision, and modification
- **Reproducibility**: Use exact search syntax that can be re-executed
- **Comprehensiveness**: Prioritize recall over precision at this stage
- **No Premature Filtering**: Retrieve ALL results; screening comes later
- **Systematic Navigation**: Use pagination tools to ensure complete retrieval
- **Deduplication**: Track and remove duplicate PMIDs when aggregating sub-question results
- **Version Control**: Save each search formula iteration with timestamps
- **Sub-Question Traceability**: Tag articles with their source sub-question for analysis

## Common Search Operators

- **Boolean**: AND, OR, NOT
- **Field Tags**: [Title/Abstract], [MeSH], [Author], [Journal], [pt] (publication type)
- **Wildcards**: * (e.g., "diabet*" matches diabetes, diabetic)
- **Phrases**: Use quotes for exact phrases (e.g., "type 2 diabetes")
- **Date Filters**: ("2020/01/01"[Date - Publication] : "2024/12/31"[Date - Publication])

## Output Format

At completion, provide:

**For Single-Question Searches:**
1. **Final Search Strategy**: Exact formula with operator syntax
2. **Search Metadata**: Database, date, total results
3. **Article List**: Complete list with PMIDs and basic metadata
4. **Retrieval Log**: Summary of iterations and refinements

**For Decomposed Searches:**
1. **Decomposition Rationale**: Why and how the question was split
2. **Sub-Question List**: All sub-questions with their search formulas
3. **Per-Sub-Question Results**: Results count and key metadata for each
4. **Aggregated Article List**: Deduplicated complete list with PMIDs and metadata
5. **Traceability Map**: Which sub-question(s) retrieved each article
6. **Total Statistics**: Total unique articles, overlap statistics
7. **Retrieval Log**: Summary of all iterations and refinements

Remember: This is RETRIEVAL only. Do not screen, filter, or assess quality at this stage.`,

    onActivate: async () => {
        console.log('[MetaAnalysisRetrieval] Skill activated - ready for systematic literature retrieval');
    },

    onDeactivate: async () => {
        console.log('[MetaAnalysisRetrieval] Skill deactivated - search strategy and article list should be documented');
    },

    metadata: {
        author: 'AI Knowledge Base Team',
        created: '2025-02-19',
        updated: '2025-02-20',
        complexity: 'Medium',
        requiredWorkspace: 'MetaAnalysisWorkspace',
        requiredTools: 'search_pubmed, view_article, navigate_page, clear_results',
        phase: 'retrieval',
        nextPhase: 'screening',
        targetResultsPerSubQuestion: '<100',
        decompositionStrategy: 'intervention-population-outcome'
    }
});
