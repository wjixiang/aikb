// Search Strategy Adjustment for PubMed Literature Search
// Used for iterative search strategy refinement

// Single article result for relevance analysis
class ArticleResult {
  pmid string
  title string
  snippet string
  journal_citation string
}

// Search strategy with full control over all parameters
class SearchStrategy {
  // PubMed search term using MeSH terms, field tags, boolean operators
  // Examples:
  //   - "diabetes mellitus"[MeSH Terms]
  //   - "heart disease"[Title/Abstract] AND "epidemiology"[MeSH Terms]
  //   - "COVID-19" OR "SARS-CoV-2"
  term string

  // Available filters: "books and documents", "clinical trial",
  // "meta-analysis", "randomized controlled trial", "review", "systematic review"
  filters string[]

  // Sort order: "match", "date", "pubdate", "fauth", "jour"
  sort string

  reasoning string
}

// Search strategy adjustment result
class SearchStrategyAdjustment {
  // The adjusted search term
  adjusted_term string

  // Filters to add
  filters_to_add string[]

  // Filters to remove
  filters_to_remove string[]

  // Sort order to use: "match", "date", "pubdate"
  sort string

  reasoning string
}

// Search result evaluation - determines if current results are satisfactory
class SearchResultEvaluation {
  // Whether the search results meet the target requirements
  target_reached bool

  // Overall relevance score (1-10, higher is better)
  relevance_score int

  // Number of relevant articles found in top results
  relevant_article_count int

  // Detailed reasoning for the evaluation
  reasoning string

  // Suggestions for improvement (if target not reached)
  improvement_suggestions string?
}

// Generate initial search strategy for a disease
function GenerateSearchStrategy(disease: string) -> SearchStrategy {
  client MiniMax
  prompt #"
    You are an expert in PubMed search strategy for evidence-based medicine.

    Generate an initial search strategy for: {{ disease }}

    {{ ctx.output_format }}

    IMPORTANT - Available filters (ONLY use these - DO NOT use anything else):
    ["books and documents", "clinical trial", "meta-analysis", "randomized controlled trial", "review", "systematic review"]

    NEVER use these as filters (they will cause errors):
    - "humans", "english", "cross-sectional", "cohort", "case-control", "case study"
    - Any study design type not in the list above
    - Any language like "english", "chinese", etc.
    - Any species like "humans", "animals", etc.
    - Any date range like "2019:2024" or "2020/01/01:2024/12/31"

    IMPORTANT - Do NOT use date ranges as filters.
    Instead, include dates in the search term using PubMed date syntax:
    - Date range: "2019:2024[dp]" (Date of Publication)
    - Example: ("Disc Protrusion"[MeSH]) AND "2019:2024"[dp]

    IMPORTANT - Species and language CANNOT be used as filters.
    Instead, include them in the search term using field tags:
    - For humans: add "humans[MeSH]" to your term
    - For English: add "english[Language]" to your term

    Example of a complete search term:
    ("Intervertebral Disc Displacement"[MeSH] OR "Disc Protrusion"[Title/Abstract]) AND "2019:2024"[dp] AND humans[MeSH] AND english[Language]

    Consider:
    1. Use appropriate MeSH terms for the disease
    2. Consider combining with epidemiology-related terms if appropriate
    3. Use field tags like [MeSH Terms], [Title/Abstract], [All Fields]
    4. Use boolean operators (AND, OR, NOT) to refine
    5. Sort by "pubdate" to get recent literature

    Return a well-reasoned search strategy.
  "#
}

// Analyze search results and adjust strategy
function AdjustSearchStrategy(
  disease: string,
  previous_term: string,
  previous_count: int,
  top_articles: ArticleResult[],
  current_filters: string[],
  current_sort: string,
) -> SearchStrategyAdjustment {
  client MiniMax
  prompt #"
    You are an expert in PubMed search strategy for evidence-based medicine.

    Current situation:
    - Disease/Topic: {{ disease }}
    - Previous search term: {{ previous_term }}
    - Previous result count: {{ previous_count }}
    - Current filters: {{ current_filters }}
    - Current sort: {{ current_sort }}

    Top 10 search results (for relevance analysis):
    {{ top_articles }}

    {{ ctx.output_format }}

    IMPORTANT - Available filters (ONLY use these - DO NOT use anything else):
    ["books and documents", "clinical trial", "meta-analysis", "randomized controlled trial", "review", "systematic review"]

    NEVER use these as filters (they will cause errors):
    - "humans", "english", "cross-sectional", "cohort", "case-control", "case study"
    - Any study design type not in the list above
    - Any language like "english", "chinese", etc.
    - Any species like "humans", "animals", etc.
    - Any date range like "2019:2024" or "2020/01/01:2024/12/31"

    IMPORTANT - Do NOT use date ranges as filters.
    To add date filters, modify the search term using PubMed date syntax:
    - Date range: "2019:2024[dp]" (Date of Publication)
    - Example: ("Disc Protrusion"[MeSH]) AND "2019:2024"[dp]

    Goal: Find 80-150 recent, relevant epidemiology studies.

    Analyze the relevance of current results:
    1. Are the top results truly relevant to "{{ disease }}" and epidemiology?
    2. Are snippets showing actual epidemiological research (prevalence, incidence, risk factors)?
    3. Are the journals reputable medical/epidemiology journals?
    4. What specific terms in titles/snippets indicate good matches?

    Based on relevance analysis, decide if you need to:
    - Adjust search term (if results are off-topic)
    - Narrow focus (if too broad or off-target)
    - Broaden scope (if too narrow or missing relevant areas)
    - Add/remove filters

    Return your detailed analysis and recommended adjustments.
  "#
}

// Evaluate search results to determine if target is reached
function EvaluateSearchResults(
  disease: string,
  current_term: string,
  result_count: int,
  top_articles: ArticleResult[],
  current_filters: string[],
  target_count_min: int,
  target_count_max: int,
) -> SearchResultEvaluation {
  client MiniMax
  prompt #"
    You are an expert in PubMed literature search for evidence-based medicine and systematic reviews.

    Current search situation:
    - Disease/Topic: {{ disease }}
    - Search term: {{ current_term }}
    - Result count: {{ result_count }}
    - Target range: {{ target_count_min }} - {{ target_count_max }} results
    - Current filters: {{ current_filters }}

    Top 10 search results:
    {{ top_articles }}

    {{ ctx.output_format }}

    Evaluate the search results based on the following criteria:

    1. Result Count Assessment:
       - Is the count within the target range ({{ target_count_min }}-{{ target_count_max }})?
       - Too few results may indicate an overly narrow search or rare topic
       - Too many results may indicate a broad search that needs refinement

    2. Relevance Assessment:
       - Examine titles and snippets of top articles
       - Are they truly relevant to "{{ disease }}" and epidemiology?
       - Do they show epidemiological research (prevalence, incidence, risk factors)?
       - Are they from reputable medical/epidemiology journals?
       - Are there duplicates or clearly irrelevant articles in top results?

    3. Study Quality Assessment:
       - Do the top results show high-quality studies (RCTs, cohorts, systematic reviews)?
       - Is there diversity in study types or are they all the same?
       - Are the journals well-known in the field?

    4. Coverage Assessment:
       - Does the search capture different aspects of the disease/epidemiology?
       - Are there multiple perspectives or approaches represented?

    Based on your analysis:
    - Set target_reached to true only if BOTH count is in range AND relevance is high (relevance_score >= 7)
    - Provide a relevance score (1-10) based on overall quality of top results
    - Count how many of the top 10 articles are actually relevant
    - Give detailed reasoning explaining your assessment
    - If target not reached, provide specific improvement suggestions

    Be conservative with target_reached = true. It's better to continue refining than to accept poor results.
  "#
}

// Test: Generate initial strategy for a common disease
test generate_diabetes_strategy {
  functions [GenerateSearchStrategy]
  args {
    disease "Type 2 Diabetes Mellitus"
  }
}

// Test: Generate initial strategy for a rare disease
test generate_rare_disease_strategy {
  functions [GenerateSearchStrategy]
  args {
    disease "Ebola hemorrhagic fever"
  }
}

// Test: Adjust strategy when results are too broad
test adjust_broad_results {
  functions [AdjustSearchStrategy]
  args {
    disease "cancer"
    previous_term "cancer"
    previous_count 50000
    top_articles [
      { pmid: "12345", title: "Breast Cancer Overview", snippet: "This review covers various aspects of breast cancer epidemiology...", journal_citation: "N Engl J Med. 2023;379(20):1890-1900." },
      { pmid: "12346", title: "Lung Cancer Diagnosis", snippet: "Lung cancer incidence and mortality rates are analyzed in this study...", journal_citation: "Lancet Respir Med. 2023;11(8):678-689." }
    ]
    current_filters []
    current_sort "pubdate"
  }
}

// Test: Adjust strategy when results are too narrow
test adjust_narrow_results {
  functions [AdjustSearchStrategy]
  args {
    disease "mitochondrial diabetes"
    previous_term "mitochondrial diabetes"
    previous_count 15
    top_articles []
    current_filters []
    current_sort "pubdate"
  }
}

// Test: Good results - minimal adjustment needed
test adjust_good_results {
  functions [AdjustSearchStrategy]
  args {
    disease "hypertension epidemiology"
    previous_term "hypertension[MeSH Terms] AND epidemiology[MeSH Terms]"
    previous_count 120
    top_articles [
      { pmid: "12347", title: "Hypertension prevalence in urban populations", snippet: "We conducted a cross-sectional study on hypertension prevalence in 10,000 adults...", journal_citation: "J Epidemiol Community Health. 2024;78(3):145-152." },
      { pmid: "12348", title: "Epidemiology of resistant hypertension", snippet: "This study examines the epidemiological features and risk factors of resistant hypertension...", journal_citation: "Hypertension. 2023;80(6):1123-1135." }
    ]
    current_filters []
    current_sort "pubdate"
  }
}
