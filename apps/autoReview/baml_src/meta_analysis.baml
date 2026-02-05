// ============================================================================
// Meta-Analysis Agent - Automated Literature Retrieval and Analysis
// ============================================================================

// ============================================================================
// Meta-Analysis Workflow Types
// ============================================================================

/// Research question for meta-analysis
class MetaAnalysisQuestion {
    /// The research question
    question string @description(#"Clear, focused research question"#)
    
    /// Context and background
    context string? @description(#"Additional context about the research question"#)
    
    /// Population
    population string @description(#"Population/Patient group"#)
    
    /// Intervention
    intervention string @description(#"Intervention/Exposure"#)
    
    /// Comparison
    comparison string @description(#"Comparison/Control"#)
    
    /// Outcome
    outcome string @description(#"Outcome measures"#)
}

/// Search configuration for literature retrieval
class SearchConfig {
    /// Maximum number of articles to retrieve
    max_articles int @description(#"Maximum articles to retrieve (default: 100)"#)
    
    /// Date range for search
    date_range SearchDateRange @description(#"Publication date range"#)
    
    /// Study types to include
    study_types string[] @description(#"e.g., ['RCT', 'Cohort Study', 'Systematic Review']"#)
    
    /// Language filter
    languages string[] @description(#"Languages to include, default: ['English']"#)
    
    /// Minimum sample size
    min_sample_size int? @description(#"Minimum sample size requirement"#)
}

/// Date range for publication filter
class SearchDateRange {
    /// Start date (YYYY-MM-DD)
    from_date string? @description(#"Start date in YYYY-MM-DD format"#)
    
    /// End date (YYYY-MM-DD)
    to_date string? @description(#"End date in YYYY-MM-DD format"#)
    
    /// Last N years
    last_n_years int? @description(#"Publications from last N years"#)
}

/// Retrieved article information
class Article {
    /// PubMed ID
    pmid string @description(#"PubMed identifier"#)
    
    /// Article title
    title string @description(#"Article title"#)
    
    /// Authors
    authors string @description(#"Author list"#)
    
    /// Journal citation
    journal string @description(#"Journal information"#)
    
    /// Publication date
    pub_date string @description(#"Publication date"#)
    
    /// Abstract text
    abstract string @description(#"Article abstract"#)
    
    /// DOI
    doi string? @description(#"Digital Object Identifier"#)
    
    /// Study design
    study_design string? @description(#"Type of study (RCT, cohort, etc.)"#)
    
    /// Sample size
    sample_size int? @description(#"Study sample size"#)
    
    /// Key findings
    key_findings string[] @description(#"Key findings from the study"#)
    
    /// Relevance score
    relevance_score float? @description(#"Relevance to research question (0-1)"#)
}

/// Study extraction results
class StudyExtraction {
    /// Article information
    article Article @description(#"Article details"#)
    
    /// Study population
    population string @description(#"Study population description"#)
    
    /// Intervention details
    intervention string @description(#"Intervention description"#)
    
    /// Comparison details
    comparison string @description(#"Comparison/control description"#)
    
    /// Primary outcomes
    primary_outcomes string[] @description(#"Primary outcome measures"#)
    
    /// Secondary outcomes
    secondary_outcomes string[] @description(#"Secondary outcome measures"#)
    
    /// Results summary
    results_summary string @description(#"Summary of main results"#)
    
    /// Effect size data
    effect_size EffectSize? @description(#"Effect size information if available"#)
    
    /// Risk of bias assessment
    risk_of_bias string? @description(#"Risk of bias assessment"#)
    
    /// Quality score
    quality_score float? @description(#"Study quality score (0-10)"#)
}

/// Effect size information
class EffectSize {
    /// Effect size type (e.g., MD, SMD, RR, OR)
    type string @description(#"Type of effect size"#)
    
    /// Effect size value
    value float @description(#"Effect size estimate"#)
    
    /// Confidence interval lower bound
    ci_lower float @description(#"Lower bound of confidence interval"#)
    
    /// Confidence interval upper bound
    ci_upper float @description(#"Upper bound of confidence interval"#)
    
    /// P-value
    p_value float? @description(#"Statistical significance p-value"#)
    
    /// Outcome measure
    outcome string @description(#"Outcome this effect size represents"#)
}

/// Meta-analysis results
class MetaAnalysisResult {
    /// Research question
    research_question string @description(#"Original research question"#)
    
    /// Search strategy used
    search_strategy string @description(#"Search strategy description"#)
    
    /// Total articles found
    total_found int @description(#"Total articles found in search"#)
    
    /// Articles included after screening
    articles_included int @description(#"Number of articles included in analysis"#)
    
    /// Extracted studies
    studies StudyExtraction[] @description(#"Extracted study data"#)
    
    /// Synthesis findings
    synthesis string @description(#"Qualitative synthesis of findings"#)
    
    /// Pooled effect size (if applicable)
    pooled_effect EffectSize? @description(#"Pooled effect size across studies"#)
    
    /// Heterogeneity measure
    heterogeneity string? @description(#"Heterogeneity assessment (I²)"#)
    
    /// Publication bias assessment
    publication_bias string? @description(#"Publication bias assessment"#)
    
    /// Limitations
    limitations string[] @description(#"Limitations of the analysis"#)
    
    /// Conclusions
    conclusions string @description(#"Main conclusions"#)
    
    /// Recommendations
    recommendations string[] @description(#"Recommendations for practice/research"#)
}

/// Screening decision
class ScreeningDecision {
    /// PMID
    pmid string @description(#"PubMed ID"#)
    
    /// Include or exclude
    include bool @description(#"Whether to include the article"#)
    
    /// Reason for decision
    reason string @description(#"Reason for inclusion/exclusion"#)
    
    /// Relevance score
    relevance_score float? @description(#"Relevance score (0-1)"#)
}

/// Search result evaluation
class SearchResultEvaluation {
    /// Total articles found
    total_found int @description(#"Total articles returned by search"#)
    
    /// Relevant articles count
    relevant_count int @description(#"Number of relevant articles"#)
    
    /// Average relevance score
    avg_relevance float @description(#"Average relevance score (0-1)"#)
    
    /// Quality assessment
    quality string @description(#"Overall quality of results: excellent, good, fair, poor"#)
    
    /// Issues identified
    issues string[] @description(#"Specific issues with the search results"#)
    
    /// Recommendations
    recommendations string[] @description(#"Recommendations for improving the search"#)
    
    /// Needs refinement
    needs_refinement bool @description(#"Whether the search query needs refinement"#)
}

/// Query refinement suggestion
class QueryRefinement {
    /// Original query
    original_query string @description(#"Original search query"#)
    
    /// Refined query
    refined_query string @description(#"Improved search query"#)
    
    /// Changes made
    changes string[] @description(#"List of changes made to the query"#)
    
    /// Reasoning
    reasoning string @description(#"Explanation of why these changes were made"#)
    
    /// Expected improvement
    expected_improvement string @description(#"Expected improvement in results"#)
}

// ============================================================================
// Functions
// ============================================================================

/// Evaluate search results and determine if refinement is needed
function EvaluateSearchResults(
    research_question: string,
    search_query: string,
    articles: Article[],
    iteration: int
) -> SearchResultEvaluation {
  client DefaultClient
  prompt #"
    {{_.role("system")}}
    You are an expert in systematic review methodology and literature search strategies.
    
    Your task is to evaluate the quality of search results and determine if the search query needs refinement.
    
    {{_.role("user")}}
    Research Question: {{ research_question }}
    
    Search Query Used: {{ search_query }}
    
    Iteration: {{ iteration }}
    
    Search Results:
    - Total articles found: {{ articles | length }}
    
    Articles:
    {{ articles }}
    
    Evaluate the search results based on:
    1. QUANTITY: Are there enough relevant articles? (ideal: 10-50 highly relevant articles)
    2. QUALITY: Are the articles high-quality (RCTs, systematic reviews, meta-analyses)?
    3. RELEVANCE: Do the articles directly address the research question?
    4. PRECISION: What percentage of articles are truly relevant?
    5. COMPLETENESS: Are important aspects of the question covered?
    
    Provide:
    1. Overall quality assessment (excellent/good/fair/poor)
    2. Specific issues identified (e.g., too few results, low relevance, missing key studies)
    3. Recommendations for improvement
    4. Whether refinement is needed (true if quality is fair/poor or <5 highly relevant articles)
  "#
}

/// Refine search query based on evaluation feedback

function RefineSearchQuery(
    research_question: string,
    current_query: string,
    evaluation: SearchResultEvaluation,
    iteration: int
) -> QueryRefinement {
  client DefaultClient
  prompt #"
    {{_.role("system")}}
    You are an expert librarian specializing in systematic review search strategies for medical research.
    
    Your task is to refine a PubMed search query based on evaluation feedback to improve search results.
    
    {{_.role("user")}}
    Research Question: {{ research_question }}
    
    Current Search Query: {{ current_query }}
    
    Evaluation Feedback:
    - Total found: {{ evaluation.total_found }}
    - Relevant count: {{ evaluation.relevant_count }}
    - Average relevance: {{ evaluation.avg_relevance }}
    - Quality: {{ evaluation.quality }}
    - Issues: {{ evaluation.issues }}
    - Recommendations: {{ evaluation.recommendations }}
    
    Iteration: {{ iteration }}
    
    Refine the search query to address the issues identified. Consider:
    1. If TOO FEW RESULTS: Broaden search by removing restrictive terms, using synonyms, expanding MeSH terms
    2. If TOO MANY/LOW RELEVANCE: Narrow search by adding specific terms, using more precise MeSH terms, adding filters
    3. If LOW QUALITY: Add study type filters (RCT, systematic review), focus on major journals
    4. If MISSING ASPECTS: Add specific terms for missing PICO elements
    
    Provide:
    1. Refined query (must be valid PubMed query syntax)
    2. List of specific changes made
    3. Reasoning for each change
    4. Expected improvement in results
    
    The refined query should be directly executable in PubMed.
  "#
}

/// Step 1: Generate search strategy from research question
function GenerateMetaAnalysisSearchQuery(
    question: MetaAnalysisQuestion
) -> string {
  client DefaultClient
  prompt #"
    {{_.role("system")}}
    You are an expert librarian and information specialist specializing in systematic review search strategies for medical research.
    
    Your task is to generate a comprehensive PubMed search query from a research question using PICO framework.
    
    {{_.role("user")}}
    Research Question: {{ question.question }}
    
    Context: {{ question.context }}
    
    PICO Elements:
    - Population: {{ question.population }}
    - Intervention: {{ question.intervention }}
    - Comparison: {{ question.comparison }}
    - Outcome: {{ question.outcome }}
    
    Generate a PubMed search query that:
    1. Uses appropriate MeSH terms and keywords for each PICO element
    2. Includes synonyms and related terms
    3. Uses proper Boolean operators (AND, OR)
    4. Uses field tags appropriately ([tiab], [mesh], [tw])
    5. Filters for relevant study types (RCTs, systematic reviews, meta-analyses)
    6. Limits to human studies and English language
    
    Return ONLY the search query string that can be directly used in PubMed.
  "#
}

/// Step 2: Screen articles for relevance
function ScreenArticles(
    research_question: string,
    articles: Article[]
) -> ScreeningDecision[] {
  client DefaultClient
  prompt #"
    {{_.role("system")}}
    You are an expert in systematic review methodology. Your task is to screen articles for inclusion in a meta-analysis.
    
    {{_.role("user")}}
    Research Question: {{ research_question }}
    
    Articles to Screen:
    {{ articles }}
    
    For each article, determine:
    1. Whether it should be INCLUDED or EXCLUDED based on:
       - Relevance to the research question
       - Study design (prioritize RCTs, systematic reviews, meta-analyses)
       - Population match
       - Intervention/exposure match
       - Outcome relevance
    2. A brief reason for your decision
    3. A relevance score (0-1, where 1 is highly relevant)
    
    Focus on including high-quality studies that directly address the research question.
  "#
}

/// Step 3: Extract study data from articles
function ExtractStudyData(
    research_question: string,
    articles: Article[]
) -> StudyExtraction[] {
  client DefaultClient
  prompt #"
    {{_.role("system")}}
    You are an expert in data extraction for systematic reviews and meta-analyses.
    
    Your task is to extract key study information from articles for meta-analysis.
    
    {{_.role("user")}}
    Research Question: {{ research_question }}
    
    Articles:
    {{ articles }}
    
    For each article, extract:
    1. Study population (description, sample size)
    2. Intervention details (type, dose, duration)
    3. Comparison/control details
    4. Primary outcomes (what was measured)
    5. Secondary outcomes
    6. Results summary (main findings)
    7. Effect size data if available (type, value, CI, p-value, outcome)
    8. Risk of bias assessment
    9. Quality score (0-10 based on study design and reporting)
    
    Be thorough and accurate in your extraction.
  "#
}

/// Step 4: Synthesize findings and generate meta-analysis
function SynthesizeMetaAnalysis(
    research_question: string,
    studies: StudyExtraction[]
) -> MetaAnalysisResult {
  client DefaultClient
  prompt #"
    {{_.role("system")}}
    You are an expert in meta-analysis methodology and evidence synthesis.
    
    Your task is to synthesize findings from multiple studies and generate a comprehensive meta-analysis report.
    
    {{_.role("user")}}
    Research Question: {{ research_question }}
    
    Included Studies:
    {{ studies }}
    
    Provide a comprehensive meta-analysis including:
    1. Qualitative synthesis of findings across studies
    2. Pooled effect size if data allows (calculate or describe)
    3. Heterogeneity assessment (I² statistic if applicable)
    4. Publication bias assessment
    5. Limitations of the analysis
    6. Main conclusions
    7. Recommendations for practice and future research
    
    Be thorough, balanced, and evidence-based in your synthesis.
  "#
}

/// Step 5: Generate final report
function GenerateMetaAnalysisReport(
    result: MetaAnalysisResult
) -> string {
  client DefaultClient
  prompt #"
    {{_.role("system")}}
    You are an expert scientific writer specializing in medical literature reviews.
    
    Your task is to generate a comprehensive, well-structured meta-analysis report.
    
    {{_.role("user")}}
    Meta-Analysis Results:
    {{ result }}
    
    Generate a comprehensive report with the following sections:
    1. Abstract (background, methods, results, conclusions)
    2. Introduction (research question, context, objectives)
    3. Methods (search strategy, inclusion criteria, data extraction, analysis)
    4. Results (study selection, study characteristics, synthesis, effect sizes)
    5. Discussion (summary of findings, limitations, interpretation)
    6. Conclusions (main findings, implications)
    7. References
    
    Use clear, professional scientific writing. Include specific data and findings.
  "#
}

// ============================================================================
// Tests
// ============================================================================

test GenerateMetaAnalysisSearchQuery_Diabetes {
  functions [GenerateMetaAnalysisSearchQuery]
  args {
    question {
      question #"
        In adult patients with type 2 diabetes, does SGLT2 inhibitor therapy
        compared to placebo or other antidiabetic medications reduce
        cardiovascular events and mortality?
      "#
      context #"
        SGLT2 inhibitors are a newer class of diabetes medications that have
        shown potential cardiovascular benefits. We want to systematically review
        the evidence on their cardiovascular outcomes.
      "#
      population #"
        Adults (≥18 years) with type 2 diabetes mellitus
      "#
      intervention #"
        SGLT2 inhibitors (empagliflozin, canagliflozin, dapagliflozin)
      "#
      comparison #"
        Placebo or other antidiabetic medications
      "#
      outcome #"
        Major adverse cardiovascular events (MACE), cardiovascular mortality,
        all-cause mortality, hospitalization for heart failure
      "#
    }
  }
}

test ScreenArticles_Example {
  functions [ScreenArticles]
  args {
    research_question #"
      In adult patients with type 2 diabetes, does SGLT2 inhibitor therapy 
      compared to placebo reduce cardiovascular events?
    "#
    articles [{
      pmid "28065393"
      title "Empagliflozin, Cardiovascular Outcomes, and Mortality in Type 2 Diabetes"
      authors "Zinman B, et al."
      journal "N Engl J Med. 2015;373:2117-28"
      pub_date "2015"
      abstract #"
        BACKGROUND: We assessed the cardiovascular outcomes of empagliflozin.
        METHODS: We randomly assigned patients with type 2 diabetes to empagliflozin or placebo.
        RESULTS: Empagliflozin reduced cardiovascular death and heart failure hospitalization.
      "#
      doi "10.1056/NEJMoa1504720"
      study_design "Randomized Controlled Trial"
      sample_size 7020
      key_findings ["Reduced CV death by 38%", "Reduced heart failure hospitalization by 35%"]
      relevance_score 0.95
    }, {
      pmid "26422318"
      title "Management of Hyperglycemia in Type 2 Diabetes"
      authors "American Diabetes Association"
      journal "Diabetes Care"
      pub_date "2016"
      abstract "Clinical practice guideline for diabetes management."
      doi null
      study_design "Guideline"
      sample_size null
      key_findings []
      relevance_score 0.2
    }]
  }
}

test ExtractStudyData_Example {
  functions [ExtractStudyData]
  args {
    research_question #"
      In adult patients with type 2 diabetes, does SGLT2 inhibitor therapy 
      compared to placebo reduce cardiovascular events?
    "#
    articles [{
      pmid "28065393"
      title "Empagliflozin, Cardiovascular Outcomes, and Mortality in Type 2 Diabetes"
      authors "Zinman B, et al."
      journal "N Engl J Med. 2015;373:2117-28"
      pub_date "2015"
      abstract #"
        BACKGROUND: We assessed the cardiovascular outcomes of empagliflozin in patients 
        with type 2 diabetes at high cardiovascular risk.
        METHODS: We randomly assigned 7020 patients to receive empagliflozin (10 mg or 25 mg) 
        or placebo once daily. The primary composite outcome was death from cardiovascular 
        causes, nonfatal myocardial infarction, or nonfatal stroke.
        RESULTS: The primary outcome occurred in 490 of 4687 patients (10.5%) in the 
        empagliflozin group and in 282 of 2333 patients (12.1%) in the placebo group 
        (hazard ratio, 0.86; 95% CI, 0.74 to 0.99; P=0.04 for superiority).
        Cardiovascular death occurred in 172 of 4687 patients (3.7%) in the empagliflozin 
        group and in 121 of 2333 patients (5.2%) in the placebo group (hazard ratio, 0.62; 
        95% CI, 0.49 to 0.77; P<0.001).
      "#
      doi "10.1056/NEJMoa1504720"
      study_design "Randomized Controlled Trial"
      sample_size 7020
      key_findings ["Reduced CV death by 38%", "Reduced heart failure hospitalization by 35%"]
      relevance_score 0.95
    }]
  }
}

test SynthesizeMetaAnalysis_Example {
  functions [SynthesizeMetaAnalysis]
  args {
    research_question #"
      In adult patients with type 2 diabetes, does SGLT2 inhibitor therapy 
      compared to placebo reduce cardiovascular events?
    "#
    studies [{
      article {
        pmid "28065393"
        title "Empagliflozin, Cardiovascular Outcomes, and Mortality in Type 2 Diabetes"
        authors "Zinman B, et al."
        journal "N Engl J Med. 2015;373:2117-28"
        pub_date "2015"
        abstract "EMPA-REG OUTCOME trial"
        doi "10.1056/NEJMoa1504720"
        study_design "Randomized Controlled Trial"
        sample_size 7020
        key_findings ["Reduced CV death by 38%"]
        relevance_score 0.95
      }
      population "7020 patients with type 2 diabetes at high CV risk"
      intervention "Empagliflozin 10mg or 25mg daily"
      comparison "Placebo"
      primary_outcomes ["CV death", "Nonfatal MI", "Nonfatal stroke"]
      secondary_outcomes ["Heart failure hospitalization", "All-cause mortality"]
      results_summary "Empagliflozin reduced the primary outcome by 14% (HR 0.86, 95% CI 0.74-0.99)"
      effect_size {
        type "Hazard Ratio"
        value 0.86
        ci_lower 0.74
        ci_upper 0.99
        p_value 0.04
        outcome "Primary composite outcome"
      }
      risk_of_bias "Low risk of bias"
      quality_score 9.0
    }]
  }
}
