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
        'Design and refine PubMed search strategies using Boolean operators and MeSH terms',
        'Execute iterative searches to achieve appropriate result volumes',
        'Retrieve comprehensive article lists without screening or filtering',
        'Document standardized search formulas for reproducibility',
        'Navigate and collect paginated search results',
        'Export complete bibliographic records for downstream analysis'
    ],

    workDirection: `You are conducting the literature retrieval phase of a meta-analysis. Your goal is to produce:
1. A standardized, reproducible search strategy
2. A comprehensive list of all retrieved articles (NO screening at this stage)

## Workflow

### Phase 1: Search Strategy Development
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
   - Note: Aim for 100-3000 results for typical meta-analyses

### Phase 2: Search Refinement (Iterative)
4. **Evaluate Result Volume**
   - Too few results (<50): Search may be too narrow
     * Remove restrictive filters
     * Add synonyms and related terms
     * Broaden MeSH term hierarchy
   - Too many results (>5000): Search may be too broad
     * Add specific outcome terms
     * Include study type filters [pt] (e.g., "randomized controlled trial"[pt])
     * Add date restrictions if appropriate
   - Appropriate range (100-3000): Proceed to retrieval

5. **Refine and Re-search**
   - Modify search formula based on evaluation
   - Document each iteration and rationale
   - Use \`clear_results\` before new searches to avoid confusion
   - Repeat until result volume is appropriate

### Phase 3: Complete Retrieval
6. **Collect All Results**
   - Use \`navigate_page\` to systematically page through all results
   - For each page, record article metadata (PMID, title, authors, journal, year)
   - Continue until all pages are retrieved
   - Do NOT apply inclusion/exclusion criteria at this stage

7. **Document Final Search Strategy**
   - Record the final search formula exactly as executed
   - Note the database (PubMed), date of search, and total results
   - Format for reproducibility in methods section

8. **Export Article List**
   - Compile complete list with all PMIDs
   - Include basic metadata for each article
   - Prepare for downstream screening phase (not part of this skill)

## Best Practices

- **Transparency**: Document every search iteration and modification
- **Reproducibility**: Use exact search syntax that can be re-executed
- **Comprehensiveness**: Prioritize recall over precision at this stage
- **No Premature Filtering**: Retrieve ALL results; screening comes later
- **Systematic Navigation**: Use pagination tools to ensure complete retrieval
- **Version Control**: Save each search formula iteration with timestamps

## Common Search Operators

- **Boolean**: AND, OR, NOT
- **Field Tags**: [Title/Abstract], [MeSH], [Author], [Journal], [pt] (publication type)
- **Wildcards**: * (e.g., "diabet*" matches diabetes, diabetic)
- **Phrases**: Use quotes for exact phrases (e.g., "type 2 diabetes")
- **Date Filters**: ("2020/01/01"[Date - Publication] : "2024/12/31"[Date - Publication])

## Output Format

At completion, provide:
1. **Final Search Strategy**: Exact formula with operator syntax
2. **Search Metadata**: Database, date, total results
3. **Article List**: Complete list with PMIDs and basic metadata
4. **Retrieval Log**: Summary of iterations and refinements

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
        updated: '2025-02-19',
        complexity: 'Medium',
        requiredWorkspace: 'MetaAnalysisWorkspace',
        requiredTools: 'search_pubmed, view_article, navigate_page, clear_results',
        phase: 'retrieval',
        nextPhase: 'screening'
    }
});
