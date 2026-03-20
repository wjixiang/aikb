// Search Strategy for Systematic Review Article Search
// Specialized prompts for different review sections

// Single article result for relevance analysis
class ArticleResult {
  pmid string
  title string
  snippet string
  journal_citation string
}

// Search strategy with full control over all parameters
class SearchStrategy {
  term string
  filters string[]
  sort string
  reasoning string
}

// Search strategy adjustment result
class SearchStrategyAdjustment {
  adjusted_term string
  filters_to_add string[]
  filters_to_remove string[]
  sort string
  reasoning string
}

// Search result evaluation
class SearchResultEvaluation {
  target_reached bool
  relevance_score int
  relevant_article_count int
  reasoning string
  improvement_suggestions string?
}

// ============================================================================
// EPIDEMIOLOGY - Prevalence, incidence, risk factors, population studies
// ============================================================================

function GenerateEpidemiologyStrategy(disease: string) -> SearchStrategy {
  client MiniMax
  prompt #"
    You are an expert in epidemiological research and PubMed search strategy for systematic reviews.

    Generate a comprehensive search strategy for EPIDEMIOLOGICAL studies of: {{ disease }}

    {{ ctx.output_format }}

    EPIDEMIOLOGY SEARCH STRATEGY GUIDELINES:

    1. CORE EPIDEMIOLOGICAL CONCEPTS TO INCLUDE:
       - Prevalence and incidence rates
       - Risk factors (genetic, environmental, behavioral)
       - Population-based studies
       - Cohort and case-control studies
       - Cross-sectional surveys
       - Disease burden analysis
       - Mortality and survival rates
       - Demographic patterns (age, sex, ethnicity)

    2. RECOMMENDED MESH TERMS:
       - "[Epidemiology]" or "epidemiology"[MeSH]
       - "[Mortality]" or "[Incidence]"
       - "[Risk Factors]" or "[Prevalence]"
       - "[Population Surveillance]"
       - "[Cross-Sectional Studies]"
       - "[Cohort Studies]"
       - "[Case-Control Studies]"

    3. AVAILABLE FILTERS (use these EXACT strings):
       ["books and documents", "clinical trial", "meta-analysis", "randomized controlled trial", "review", "systematic review"]

    4. NEVER USE AS FILTERS (will cause errors):
       - "humans", "english", "cross-sectional", "cohort", "case-control"
       - Any language filter
       - Any species filter
       - Any date range as filter

    5. DATE FILTERING: Use PubMed date syntax in search term:
       - "2015:2024"[dp] for date range
       - Example: ("Disease"[MeSH]) AND "2015:2024"[dp]

    6. EXAMPLE SEARCH TERM:
       ("{{ disease }}"[MeSH] OR "{{ disease }}"[Title/Abstract]) AND ("epidemiology"[MeSH] OR "prevalence"[MeSH] OR "incidence"[MeSH] OR "risk factors"[MeSH]) AND "2015:2024"[dp]

    7. PREFERRED STUDY TYPES FOR EPIDEMIOLOGY:
       - Systematic reviews of epidemiological studies
       - Meta-analyses of risk factors
       - Large cohort studies
       - Population-based cross-sectional studies
       - Registry-based studies

    Return a detailed search strategy optimized for epidemiological research.
  "#
}

function AdjustEpidemiologyStrategy(
  disease: string,
  previous_term: string,
  previous_count: int,
  top_articles: ArticleResult[],
  current_filters: string[],
) -> SearchStrategyAdjustment {
  client MiniMax
  prompt #"
    You are an expert in epidemiological research and PubMed search strategy.

    Current epidemiology search for: {{ disease }}
    Previous term: {{ previous_term }}
    Result count: {{ previous_count }}
    Current filters: {{ current_filters }}

    Top 10 results:
    {{ top_articles }}

    {{ ctx.output_format }}

    EVALUATE THESE RESULTS FOR EPIDEMIOLOGY RELEVANCE:

    1. RELEVANCE CHECK - Are results truly about:
       - Disease prevalence/incidence in populations?
       - Risk factor identification and quantification?
       - Population-level disease burden?
       - Demographic patterns of disease?

    2. QUALITY INDICATORS - Look for:
       - Large sample sizes (>1000 participants typical for good epidemiology)
       - Population-based recruitment
       - Proper epidemiological methodology descriptions
       - Confidence intervals and effect measures (OR, RR, HR)
       - P-values and statistical significance

    3. COMMON OFF-TOPIC RESULTS TO EXCLUDE:
       - Basic science/bench research
       - Clinical trials of treatments
       - Case reports or small case series
       - Animal studies
       - Studies focused only on treatment efficacy

    4. ADJUSTMENT STRATEGIES:
       - TOO MANY (>150): Add "epidemiology"[MeSH] or filter by "systematic review"
       - TOO FEW (<80): Remove restrictive filters, add "cross-sectional" OR broaden date
       - OFF-TOPIC: Add specific epidemiological MeSH terms
       - TOO CLINICAL: Focus on population/risk factor terms

    5. RECOMMENDED FILTERS:
       ["systematic review", "meta-analysis", "review"] for quality epidemiological overviews

    Provide detailed analysis and specific adjustments.
  "#
}

function EvaluateEpidemiologyResults(
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
    You are an expert epidemiologist evaluating search results for a systematic review.

    Evaluate epidemiology search results for: {{ disease }}
    Search term: {{ current_term }}
    Result count: {{ result_count }}
    Target: {{ target_count_min }}-{{ target_count_max }}
    Filters: {{ current_filters }}

    Top 10 results:
    {{ top_articles }}

    {{ ctx.output_format }}

    EVALUATION CRITERIA FOR EPIDEMIOLOGY:

    1. COUNT ASSESSMENT:
       - {{ target_count_min }}-{{ target_count_max }} is target range
       - <80: Search may be too narrow
       - >150: Search may be too broad
       - 80-150: Good range for epidemiology

    2. RELEVANCE SCORING (1-10):
       Score based on epidemiological relevance:
       - 9-10: Population-based studies, proper epidemiology methodology
       - 7-8: Relevant with some clinical/advisory content
       - 5-6: Partially relevant, mixed content
       - 3-4: Marginally relevant, mostly clinical
       - 1-2: Not relevant (basic science, treatment only)

    3. KEY QUALITY MARKERS IN EPIDEMIOLOGY:
       - Study design mentioned (cohort, case-control, cross-sectional)
       - Sample size indications
       - Statistical measures (OR, RR, 95% CI, p-values)
       - Population/demographic descriptions
       - "population", "cohort", "incidence", "prevalence" in text

    4. RELEVANCE COUNT:
       Count how many of top 10 are truly epidemiological studies

    5. COVERAGE ASSESSMENT:
       - Multiple aspects covered? (prevalence, risk factors, demographics)
       - Geographic diversity of studies?
       - Recent vs older studies balance?

    OUTPUT:
    - target_reached: true only if count in range AND relevance >= 7
    - Be conservative - epidemiology requires proper methodology
  "#
}

// ============================================================================
// PATHOPHYSIOLOGY - Disease mechanisms, cellular, molecular processes
// ============================================================================

function GeneratePathophysiologyStrategy(disease: string) -> SearchStrategy {
  client MiniMax
  prompt #"
    You are an expert in pathophysiology and molecular biology research for systematic reviews.

    Generate a comprehensive search strategy for PATHOPHYSIOLOGICAL studies of: {{ disease }}

    {{ ctx.output_format }}

    PATHOPHYSIOLOGY SEARCH STRATEGY GUIDELINES:

    1. CORE PATHOPHYSIOLOGICAL CONCEPTS:
       - Cellular and molecular disease mechanisms
       - Biochemical and physiological changes
       - Organ system dysfunction
       - Disease etiology and pathogenesis
       - Genetic and molecular basis
       - Signal transduction pathways
       - Inflammation and immune response
       - Tissue and organ damage

    2. RECOMMENDED MESH TERMS:
       - "[Pathology]" or "[Pathophysiology]"
       - "[Cells]" or "[Cell Biology]"
       - "[Molecular Biology]" or "[Genetics]"
       - "[Inflammation]" or "[Immune Response]"
       - "[Signal Transduction]"
       - "[Gene Expression Regulation]"
       - "[Apoptosis]" or "[Cell Death]"
       - "[Metabolism]" or "[Biochemical Phenomena]"

    3. AVAILABLE FILTERS:
       ["books and documents", "clinical trial", "meta-analysis", "randomized controlled trial", "review", "systematic review"]

    4. NEVER USE AS FILTERS:
       - "humans", "english", "cross-sectional", "cohort"
       - Any language or species filter
       - Date ranges as filters

    5. DATE FILTERING: Use in search term:
       "2015:2024"[dp]

    6. EXAMPLE SEARCH:
       ("{{ disease }}"[MeSH] OR "{{ disease }}"[Title/Abstract]) AND ("pathophysiology"[MeSH] OR "molecular"[MeSH] OR "cellular"[MeSH] OR "gene expression"[MeSH])

    7. PREFERRED STUDIES:
       - Basic science reviews
       - Molecular pathway analyses
       - Animal and in vitro studies with mechanistic insights
       - Genetic association studies
       - Biomarker discovery studies

    Return a detailed search strategy optimized for pathophysiology research.
  "#
}

function AdjustPathophysiologyStrategy(
  disease: string,
  previous_term: string,
  previous_count: int,
  top_articles: ArticleResult[],
  current_filters: string[],
) -> SearchStrategyAdjustment {
  client MiniMax
  prompt #"
    You are an expert in pathophysiology and molecular biology research.

    Current pathophysiology search for: {{ disease }}
    Previous term: {{ previous_term }}
    Result count: {{ previous_count }}
    Current filters: {{ current_filters }}

    Top 10 results:
    {{ top_articles }}

    {{ ctx.output_format }}

    EVALUATE FOR PATHOPHYSIOLOGY RELEVANCE:

    1. RELEVANCE CHECK - Are results about:
       - Molecular and cellular mechanisms?
       - Disease pathophysiology?
       - Signal transduction pathways?
       - Genetic and protein mechanisms?
       - Biochemical alterations?
       - Organ system dysfunction?

    2. QUALITY MARKERS:
       - Pathway or mechanism descriptions
       - Molecular targets identified
       - "mechanism", "pathway", "molecular", "cellular" terms
       - Protein/gene expression data
       - Animal model studies with mechanistic insights

    3. OFF-TOPIC RESULTS:
       - Purely clinical outcome studies
       - Treatment efficacy without mechanism
       - Epidemiology without pathophysiology
       - Case reports
       - Diagnostic studies without mechanism

    4. ADJUSTMENT STRATEGIES:
       - TOO MANY: Add specific pathway or molecular MeSH terms
       - TOO FEW: Add "molecular" OR "cellular" OR broaden date
       - OFF-TOPIC: Remove clinical terms, focus on basic science
       - NEED MORE MECHANISM: Add specific pathway terms

    5. KEY MeSH ADDITIONS:
       Consider: "Signal Transduction", "Gene Expression", "Apoptosis", "Inflammation", "Cellular Senescence"

    Provide specific adjustments for pathophysiology focus.
  "#
}

function EvaluatePathophysiologyResults(
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
    You are an expert in pathophysiology evaluating search results.

    Evaluate pathophysiology search for: {{ disease }}
    Search term: {{ current_term }}
    Result count: {{ result_count }}
    Target: {{ target_count_min }}-{{ target_count_max }}

    Top 10 results:
    {{ top_articles }}

    {{ ctx.output_format }}

    EVALUATION FOR PATHOPHYSIOLOGY:

    1. COUNT ASSESSMENT:
       Target range: {{ target_count_min }}-{{ target_count_max }}
       Physiology often has fewer studies than treatment/epidemiology

    2. RELEVANCE SCORING (1-10):
       Score pathophysiology relevance:
       - 9-10: Clear mechanistic studies, molecular/cellular focus
       - 7-8: Relevant basic science, some clinical correlation
       - 5-6: Mixed, some mechanism but mostly clinical
       - 3-4: Minimal pathophysiology, mostly clinical
       - 1-2: Not relevant (epidemiology, treatment only)

    3. QUALITY MARKERS:
       - Molecular, cellular, pathway terminology
       - "mechanism", "pathway", "signaling", "receptor"
       - Protein/gene targets mentioned
       - In vitro or animal model descriptions
       - "pathophysiology", "etiology", "pathogenesis"

    4. RELEVANT ARTICLE COUNT:
       Count top 10 with clear pathophysiology focus

    5. COVERAGE:
       - Multiple mechanisms covered?
       - Cellular and molecular aspects?
       - Tissue/organ level?

    OUTPUT:
    - target_reached: true if count reasonable AND relevance >= 7
    - Pathology may have fewer results - adjust expectations
  "#
}

// ============================================================================
// CLINICAL - Signs, symptoms, diagnosis, clinical presentation, complications
// ============================================================================

function GenerateClinicalStrategy(disease: string) -> SearchStrategy {
  client MiniMax
  prompt #"
    You are an expert in clinical medicine and diagnostic research for systematic reviews.

    Generate a comprehensive search strategy for CLINICAL MANIFESTATIONS of: {{ disease }}

    {{ ctx.output_format }}

    CLINICAL SEARCH STRATEGY GUIDELINES:

    1. CORE CLINICAL CONCEPTS:
       - Signs and symptoms
       - Clinical presentation patterns
       - Diagnostic criteria and methods
       - Disease classification and staging
       - Natural history and progression
       - Complications and comorbidities
       - Physical examination findings
       - Laboratory and imaging findings
       - Prognostic indicators

    2. RECOMMENDED MESH TERMS:
       - "[Signs and Symptoms]" or "[Clinical Presentation]"
       - "[Diagnosis]" or "[Diagnostic Criteria]"
       - "[Physical Examination]"
       - "[Laboratory]" and "[Diagnostic Imaging]"
       - "[Complications]" or "[Comorbidity]"
       - "[Disease Progression]" or "[Natural History]"
       - "[Classification]" or "[Staging]"

    3. AVAILABLE FILTERS:
       ["books and documents", "clinical trial", "meta-analysis", "randomized controlled trial", "review", "systematic review"]

    4. NEVER USE AS FILTERS:
       - "humans", "english", "cross-sectional"
       - Any language or species filter

    5. DATE FILTERING: "2015:2024"[dp]

    6. EXAMPLE SEARCH:
       ("{{ disease }}"[MeSH]) AND ("symptoms"[MeSH] OR "diagnosis"[MeSH] OR "clinical"[MeSH] OR "complications"[MeSH])

    7. PREFERRED STUDIES:
       - Clinical reviews and systematic reviews
       - Diagnostic accuracy studies
       - Cohort studies of presentation
       - Cross-sectional descriptive studies
       - Clinical practice guidelines
       - Consensus documents

    Return clinical-focused search strategy.
  "#
}

function AdjustClinicalStrategy(
  disease: string,
  previous_term: string,
  previous_count: int,
  top_articles: ArticleResult[],
  current_filters: string[],
) -> SearchStrategyAdjustment {
  client MiniMax
  prompt #"
    You are an expert in clinical medicine evaluation.

    Current clinical search for: {{ disease }}
    Previous term: {{ previous_term }}
    Result count: {{ previous_count }}
    Filters: {{ current_filters }}

    Top 10 results:
    {{ top_articles }}

    {{ ctx.output_format }}

    EVALUATE CLINICAL RELEVANCE:

    1. RELEVANCE CHECK - Are results about:
       - Signs and symptoms patients present with?
       - How disease is diagnosed?
       - Clinical presentation patterns?
       - Disease complications?
       - Diagnostic test performance?
       - Clinical classification/staging?

    2. QUALITY MARKERS:
       - Clear symptom or sign descriptions
       - Diagnostic criteria mentioned
       - "clinical presentation", "diagnosis", "symptoms"
       - Patient population described
       - Sensitivity/specificity for diagnostics
       - Staging or classification systems

    3. OFF-TOPIC:
       - Basic science without clinical correlation
       - Treatment studies without clinical findings
       - Pure epidemiology without clinical features
       - Animal studies

    4. ADJUSTMENT STRATEGIES:
       - TOO BROAD: Add specific symptom or diagnostic terms
       - TOO NARROW: Add clinical synonyms, broaden date
       - NEED DIAGNOSIS: Add "diagnosis" or "diagnostic"
       - NEED COMPLICATIONS: Add "complications" or "adverse"
       - CLINICAL VARIANTS: Add classification terms

    5. FILTERS TO CONSIDER:
       ["systematic review", "review"] for comprehensive clinical overviews

    Provide specific clinical-focused adjustments.
  "#
}

function EvaluateClinicalResults(
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
    You are a clinical expert evaluating systematic review search results.

    Evaluate clinical search for: {{ disease }}
    Search term: {{ current_term }}
    Result count: {{ result_count }}
    Target: {{ target_count_min }}-{{ target_count_max }}

    Top 10 results:
    {{ top_articles }}

    {{ ctx.output_format }}

    CLINICAL EVALUATION:

    1. COUNT ASSESSMENT:
       Target: {{ target_count_min }}-{{ target_count_max }}
       Clinical literature is typically extensive

    2. RELEVANCE SCORING (1-10):
       Clinical relevance:
       - 9-10: Clear clinical presentation, diagnosis, symptoms
       - 7-8: Relevant clinical content, good description
       - 5-6: Some clinical content, mixed with other types
       - 3-4: Minimal clinical focus, mostly other content
       - 1-2: Not relevant (basic science, treatment only)

    3. QUALITY MARKERS:
       - "symptoms", "signs", "clinical presentation"
       - "diagnosis", "diagnostic criteria"
       - "complications", "prognosis"
       - Patient-reported outcomes
       - Clinical classification systems

    4. COVERAGE ASSESSMENT:
       - Signs AND symptoms covered?
       - Diagnostic approaches included?
       - Complications addressed?
       - Different disease stages?

    5. DIVERSITY:
       - Multiple study types?
       - Various clinical manifestations?
       - Geographic/population diversity?

    OUTPUT:
    - target_reached: true if count in range AND relevance >= 7
    - Clinical should show practical relevance for patient care
  "#
}

// ============================================================================
// TREATMENT - Therapeutic interventions, drugs, procedures, outcomes
// ============================================================================

function GenerateTreatmentStrategy(disease: string) -> SearchStrategy {
  client MiniMax
  prompt #"
    You are an expert in evidence-based medicine and therapeutic research for systematic reviews.

    Generate a comprehensive search strategy for TREATMENT STUDIES of: {{ disease }}

    {{ ctx.output_format }}

    TREATMENT SEARCH STRATEGY GUIDELINES:

    1. CORE TREATMENT CONCEPTS:
       - Therapeutic interventions (pharmacological and non-pharmacological)
       - Drug treatments and pharmacotherapy
       - Surgical and procedural interventions
       - Rehabilitation and recovery
       - Treatment outcomes and efficacy
       - Safety and adverse effects
       - Comparative effectiveness
       - Treatment guidelines
       - Quality of life outcomes

    2. RECOMMENDED MESH TERMS:
       - "[Therapeutics]" or "[Treatment]" or "[Therapy]"
       - "[Drug Therapy]" or "[Pharmacology]"
       - "[Surgical Procedures]" or "[Rehabilitation]"
       - "[Treatment Outcome]" or "[Therapeutic Use]"
       - "[Adverse Effects]" or "[Drug Safety]"
       - "[Comparative Effectiveness]"
       - "[Quality of Life]"
       - "[Clinical Trials]" or "[Controlled Clinical Trial]"

    3. AVAILABLE FILTERS:
       ["books and documents", "clinical trial", "meta-analysis", "randomized controlled trial", "review", "systematic review"]

    4. NEVER USE AS FILTERS:
       - "humans", "english", "cross-sectional"
       - Language or species filters

    5. DATE FILTERING: "2015:2024"[dp]

    6. EXAMPLE SEARCH:
       ("{{ disease }}"[MeSH]) AND ("therapy"[MeSH] OR "treatment"[MeSH] OR "drug therapy"[MeSH] OR "surgery"[MeSH])

    7. PREFERRED STUDIES:
       - Randomized controlled trials (RCTs)
       - Systematic reviews of treatments
       - Meta-analyses of therapeutic interventions
       - Comparative effectiveness research
       - Head-to-head trials
       - Real-world evidence studies

    Return treatment-focused search strategy.
  "#
}

function AdjustTreatmentStrategy(
  disease: string,
  previous_term: string,
  previous_count: int,
  top_articles: ArticleResult[],
  current_filters: string[],
) -> SearchStrategyAdjustment {
  client MiniMax
  prompt #"
    You are an expert in therapeutic research evaluation.

    Current treatment search for: {{ disease }}
    Previous term: {{ previous_term }}
    Result count: {{ previous_count }}
    Filters: {{ current_filters }}

    Top 10 results:
    {{ top_articles }}

    {{ ctx.output_format }}

    EVALUATE TREATMENT RELEVANCE:

    1. RELEVANCE CHECK - Are results about:
       - Treatment interventions (drugs, surgery, therapy)?
       - Treatment efficacy and outcomes?
       - Adverse effects and safety?
       - Comparative effectiveness?
       - Treatment guidelines?
       - Patient response to treatment?

    2. QUALITY MARKERS FOR TREATMENT:
       - RCT or systematic review notation
       - Intervention descriptions
       - Outcome measures defined
       - "randomized", "controlled trial", "efficacy"
       - "adverse effects", "safety", "tolerability"
       - Statistical significance reported

    3. OFF-TOPIC FOR TREATMENT:
       - Pure pathophysiology without treatment
       - Epidemiology without treatment focus
       - Basic science mechanisms
       - Diagnostic studies without treatment
       - Case reports

    4. ADJUSTMENT STRATEGIES:
       - TOO MANY: Add "randomized controlled trial" filter or specific intervention terms
       - TOO FEW: Remove restrictive filters, add broader therapy terms
       - NEED RCTs: Add "randomized" or use RCT filter
       - NEED SAFETY: Add "adverse effects" or "safety"
       - TOO MIXED: Focus with specific treatment type terms

    5. RECOMMENDED FILTERS:
       ["systematic review", "meta-analysis", "randomized controlled trial", "clinical trial"]

    Provide specific treatment-focused adjustments.
  "#
}

function EvaluateTreatmentResults(
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
    You are an expert in therapeutic research evaluation for systematic reviews.

    Evaluate treatment search for: {{ disease }}
    Search term: {{ current_term }}
    Result count: {{ result_count }}
    Target: {{ target_count_min }}-{{ target_count_max }}

    Top 10 results:
    {{ top_articles }}

    {{ ctx.output_format }}

    TREATMENT EVALUATION:

    1. COUNT ASSESSMENT:
       Target: {{ target_count_min }}-{{ target_count_max }}
       Treatment literature is usually abundant

    2. RELEVANCE SCORING (1-10):
       Treatment relevance:
       - 9-10: RCTs, systematic reviews of treatments, clear intervention focus
       - 7-8: Relevant treatment content, some methodology issues
       - 5-6: Some treatment relevance, mixed content
       - 3-4: Limited treatment content, other types dominate
       - 1-2: Not relevant (pathophysiology, epidemiology only)

    3. QUALITY MARKERS:
       - "randomized", "controlled trial", "RCT"
       - "systematic review", "meta-analysis"
       - "intervention", "treatment outcome"
       - "efficacy", "effectiveness"
       - "adverse effects", "safety"

    4. THERAPEUTIC CONTENT:
       - Specific treatments mentioned?
       - Intervention types varied?
       - Outcomes clearly defined?
       - Head-to-head comparisons?

    5. STUDY TYPE DIVERSITY:
       - RCTs present?
       - Systematic reviews included?
       - Real-world evidence?
       - Different intervention types?

    OUTPUT:
    - target_reached: true if count in range AND relevance >= 7
    - Treatment should have high-quality intervention studies
  "#
}

// ============================================================================
// LEGACY FUNCTIONS - For backward compatibility
// ============================================================================

// Generic function that delegates based on search_focus
function GenerateSearchStrategy(disease: string, search_focus: string) -> SearchStrategy {
  client MiniMax
  prompt #"
    You are an expert in PubMed search strategy for systematic reviews.

    Generate a search strategy for: {{ disease }}
    Focus area: {{ search_focus }}

    {{ ctx.output_format }}

    Supported focus areas:
    - "epidemiology": Prevalence, incidence, risk factors, population studies
    - "pathophysiology": Disease mechanisms, cellular and molecular processes
    - "clinical": Signs, symptoms, diagnosis, clinical presentation
    - "treatment": Therapeutic interventions, drug treatments, procedures

    {{ ctx.output_format }}

    IMPORTANT - Available filters:
    ["books and documents", "clinical trial", "meta-analysis", "randomized controlled trial", "review", "systematic review"]

    NEVER USE: "humans", "english", "cross-sectional", "cohort", date ranges as filters

    Include dates in term: "2015:2024"[dp]

    Return a well-reasoned strategy optimized for {{ search_focus }}.
  "#
}

// Generic adjustment function
function AdjustSearchStrategy(
  disease: string,
  previous_term: string,
  previous_count: int,
  top_articles: ArticleResult[],
  current_filters: string[],
  current_sort: string,
  search_focus: string,
) -> SearchStrategyAdjustment {
  client MiniMax
  prompt #"
    You are an expert in PubMed search optimization for systematic reviews.

    Current search for: {{ disease }}
    Focus: {{ search_focus }}
    Previous: {{ previous_term }}
    Count: {{ previous_count }}
    Filters: {{ current_filters }}

    Top 10 results:
    {{ top_articles }}

    {{ ctx.output_format }}

    Adjust based on {{ search_focus }} relevance criteria.

    If {{ search_focus }} is:
    - "epidemiology": Focus on population studies, risk factors, prevalence
    - "pathophysiology": Focus on mechanisms, molecular pathways
    - "clinical": Focus on symptoms, diagnosis, presentation
    - "treatment": Focus on interventions, outcomes, efficacy

    Return adjustments.
  "#
}

// Generic evaluation function
function EvaluateSearchResults(
  disease: string,
  current_term: string,
  result_count: int,
  top_articles: ArticleResult[],
  current_filters: string[],
  target_count_min: int,
  target_count_max: int,
  search_focus: string,
) -> SearchResultEvaluation {
  client MiniMax
  prompt #"
    You are an expert evaluating systematic review search results.

    Evaluate: {{ disease }}
    Focus: {{ search_focus }}
    Term: {{ current_term }}
    Count: {{ result_count }}
    Target: {{ target_count_min }}-{{ target_count_max }}

    Results:
    {{ top_articles }}

    {{ ctx.output_format }}

    Evaluate for {{ search_focus }} relevance and quality.
    Count in range and relevance >= 7 for target_reached = true.
  "#
}

// ============================================================================
// TESTS
// ============================================================================

test epidemiology_diabetes {
  functions [GenerateEpidemiologyStrategy]
  args {
    disease "Type 2 Diabetes Mellitus"
  }
}

test pathophysiology_diabetes {
  functions [GeneratePathophysiologyStrategy]
  args {
    disease "Type 2 Diabetes Mellitus"
  }
}

test clinical_diabetes {
  functions [GenerateClinicalStrategy]
  args {
    disease "Type 2 Diabetes Mellitus"
  }
}

test treatment_diabetes {
  functions [GenerateTreatmentStrategy]
  args {
    disease "Type 2 Diabetes Mellitus"
  }
}

test generic_disease {
  functions [GenerateSearchStrategy]
  args {
    disease "Alzheimer Disease"
    search_focus "treatment"
  }
}
