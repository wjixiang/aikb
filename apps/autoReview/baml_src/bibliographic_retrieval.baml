// ============================================================================
// Bibliographic Retrieval Strategy for Systematic Reviews
// Based on PubMed search capabilities and PICO framework
// ============================================================================

// ============================================================================
// PubMed Field Constraints (matching pubmed.service.ts)
// ============================================================================

enum PubMedField {
    AllFields
    Affiliation
    Author
    AuthorCorporate
    AuthorFirst
    AuthorIdentifier
    AuthorLast
    Book
    ConflictOfInterestStatements
    DateCompletion
    DateCreate
    DateEntry
    DateMeSH
    DateModification
    DatePublication
    ECRNNumber
    Editor
    Filter
    GrantsAndFunding
    ISBN
    Investigator
    Issue
    Journal
    Language
    LocationID
    MeSHMajorTopic
    MeSHSubheading
    MeSHTerms
    OtherTerm
    Pagination
    PharmacologicalAction
    PublicationType
    Publisher
    SecondarySourceID
    SubjectPersonalName
    SupplementaryConcept
    TextWord
    Title
    TitleAbstract
    TransliteratedTitle
    Volume
}

// ============================================================================
// Search Strategy Components
// ============================================================================

/// A single search term with field constraints
class SearchTerm {
    term string @description(#"The search term or keyword"#)
    fields PubMedField[] @description(#"Fields to search in (OR relation between fields)"#)
    explode bool? @description(#"Whether to explode MeSH terms (include all narrower terms)"#)
    use_reusable bool? @description(#"Whether to include reusable terms (MeSH)"#)
}

/// A search concept that combines multiple terms with OR logic
class SearchConcept {
    name string @description(#"Name of this concept (e.g., 'Population', 'Intervention')"#)
    terms SearchTerm[] @description(#"Search terms combined with OR"#)
    required bool @description(#"Whether this concept is required (default: true)"#)
}

/// Logical operator between concepts
enum LogicalOperator {
    AND
    OR
    NOT
}

/// A search block combining concepts with a logical operator
class SearchBlock {
    operator LogicalOperator @description(#"Operator to combine this block with previous blocks"#)
    concepts SearchConcept[] @description(#"Concepts in this block"#)
}

// ============================================================================
// PICO-based Search Strategy
// ============================================================================

/// PICO-based search strategy for systematic reviews
class PICOSearchStrategy {
    /// Population concept (P in PICO)
    population SearchConcept[] @description(#"Population/Patient concept(s)"#)
    
    /// Intervention concept (I in PICO)
    intervention SearchConcept[] @description(#"Intervention/Exposure concept(s)"#)
    
    /// Comparison concept (C in PICO)
    comparison SearchConcept[] @description(#"Comparison/Control concept(s)"#)
    
    /// Outcome concept (O in PICO)
    outcome SearchConcept[] @description(#"Outcome concept(s)"#)
    
    /// Study design filters
    study_design SearchConcept[] @description(#"Study design filters"#)
    
    /// Additional search blocks
    additional_blocks SearchBlock[] @description(#"Additional search blocks with custom logic"#)
    
    /// Publication filters
    publication_filters PublicationFilters @description(#"Publication-related filters"#)
}

// ============================================================================
// Publication Filters
// ============================================================================

/// Publication date range
class DateRange {
    from_date string? @description(#"Start date in YYYY/MM/DD format (e.g., '2020/01/01')"#)
    to_date string? @description(#"End date in YYYY/MM/DD format (e.g., '2024/12/31')"#)
    last_x_days int? @description(#"Last X days (e.g., 365 for last year)"#)
    last_x_months int? @description(#"Last X months (e.g., 12 for last year)"#)
    last_x_years int? @description(#"Last X years (e.g., 5 for last 5 years)"#)
}

/// Article types for filtering
enum ArticleType {
    ClinicalTrial
    ClinicalTrialPhaseI
    ClinicalTrialPhaseII
    ClinicalTrialPhaseIII
    ClinicalTrialPhaseIV
    ControlledClinicalTrial
    RandomizedControlledTrial
    MetaAnalysis
    SystematicReview
    ObservationalStudy
    CaseReport
    CaseSeries
    CohortStudy
    CrossSectionalStudy
    CaseControlStudy
    Editorial
    Letter
    Review
    Guideline
}

/// Species for filtering
enum Species {
    Humans
    Animals
}

/// Sex for filtering
enum Sex {
    Male
    Female
}

/// Age groups for filtering (PubMed-specific)
enum PubMedAgeGroup {
    Newborn // birth to 1 month
    Infant // 1 to 23 months
    Preschool // 2 to 5 years
    Child // 6 to 12 years
    Adolescent // 13 to 18 years
    Adult // 19 to 44 years
    MiddleAged // 45 to 64 years
    Aged // 65+ years
    Aged80Plus // 80+ years
}

/// Language filters
enum Language {
    English
    Chinese
    French
    German
    Spanish
    Japanese
    Any
}

/// Publication-related filters
class PublicationFilters {
    /// Date range filter
    date_range DateRange? @description(#"Publication date range"#)
    
    /// Article types to include
    article_types ArticleType[] @description(#"Article types to include"#)
    
    /// Species filter
    species Species[] @description(#"Species filter (Humans/Animals)"#)
    
    /// Sex filter
    sex Sex[] @description(#"Sex filter"#)
    
    /// Age groups
    age_groups PubMedAgeGroup[] @description(#"Age group filters"#)
    
    /// Languages
    languages Language[] @description(#"Language filters"#)
    
    /// Journal filters
    journal_filters JournalFilters? @description(#"Journal-specific filters"#)
}

/// Journal-specific filters
class JournalFilters {
    /// Specific journal names
    journal_names string[] @description(#"Specific journal names to include"#)
    
    /// Journal categories
    journal_categories string[] @description(#"Journal categories (e.g., 'Nursing', 'Dentistry')"#)
    
    /// Subset filters
    subsets string[] @description(#"PubMed subsets (e.g., 'AIM', 'IM', 'MEDLINE')"#)
}

// ============================================================================
// Search Strategy Builder
// ============================================================================

/// Complete search strategy for systematic review
class SearchStrategy {
    /// PICO-based search strategy
    pico_strategy PICOSearchStrategy @description(#"PICO-based search components"#)
    
    /// Strategy name/description
    name string @description(#"Name of this search strategy"#)
    
    /// Description of the research question
    description string @description(#"Description of the research question"#)
    
    /// Databases to search
    databases Database[] @description(#"Databases to search"#)
    
    /// Search options
    options SearchOptions? @description(#"Additional search options"#)
}

/// Supported databases
enum Database {
    PubMed
    Embase
    WebOfScience
    Scopus
    Cochrane
    CINAHL
    PsycINFO
}

/// Search options
class SearchOptions {
    /// Use automatic term mapping
    automatic_term_mapping bool @description(#"Use PubMed's automatic term mapping (default: true)"#)
    
    /// Include PubMed Central
    include_pmc bool @description(#"Include PubMed Central full-text search"#)
    
    /// Use related articles
    use_related_articles bool @description(#"Include related articles in search"#)
    
    /// Max results per database
    max_results int? @description(#"Maximum results to retrieve per database"#)
}

// ============================================================================
// MeSH Terms
// ============================================================================

/// MeSH term with options
class MeSHTerm {
    mesh_descriptor string @description(#"MeSH descriptor name"#)
    qualifiers string[] @description(#"MeSH subheadings/qualifiers"#)
    explode bool @description(#"Explode to include narrower terms"#)
    major_topic bool @description(#"Restrict to major MeSH topics"#)
}

// ============================================================================
// Generated Search Query
// ============================================================================

/// Rendered search query for a specific database
class RenderedQuery {
    /// Database this query is for
    database Database @description(#"Target database"#)
    
    /// Rendered query string
    query string @description(#"Rendered search query string"#)
    
    /// Query syntax used
    syntax string @description(#"Query syntax (e.g., 'PubMed', 'Embase')"#)
    
    /// Estimated results
    estimated_results int? @description(#"Estimated number of results"#)
}

// ============================================================================
// Search Strategy Evaluation
// ============================================================================

/// Evaluation of search strategy performance
class StrategyEvaluation {
    /// Number of results found
    result_count int @description(#"Number of results found"#)
    
    /// Precision (relevant results / total results)
    precision float? @description(#"Precision of the search (0-1)"#)
    
    /// Recall (relevant results found / total relevant results)
    recall float? @description(#"Recall of the search (0-1)"#)
    
    /// Suggestions for improvement
    suggestions string[] @description(#"Suggestions for improving the strategy"#)
    
    /// Missing terms
    missing_terms string[] @description(#"Terms that might be missing"#)
}

// ============================================================================
// Functions
// ============================================================================

/// Generate a comprehensive search strategy from a research question and PICO
function GenerateSearchStrategy(
    research_question: string,
    pico: PICO,
    criteria: InclusionExclusionCriteria?
) -> SearchStrategy {
  client DefaultClient
  prompt #"
    {{_.role("system")}}
    You are an expert librarian and information specialist specializing in systematic review search strategies.
    Your task is to generate a comprehensive search strategy based on a research question, PICO framework, and inclusion/exclusion criteria.
    
    Consider the following when building the strategy:
    1. Use appropriate MeSH terms and keywords for each concept
    2. Include synonyms, related terms, and spelling variations
    3. Apply appropriate Boolean operators (AND, OR, NOT)
    4. Use field tags (e.g., [tiab], [mesh], [tw]) appropriately
    5. Include study design filters based on the criteria
    6. Apply publication filters (date range, article types, languages, etc.)
    
    {{_.role("user")}}
    Research Question: {{ research_question }}
    
    PICO Elements:
    - Population: {{ pico.population }}
    - Intervention: {{ pico.intervention }}
    - Comparison: {{ pico.comparison }}
    - Outcome: {{ pico.outcome }}
    
    Inclusion/Exclusion Criteria:
    {{ criteria }}
    
    Generate a comprehensive search strategy that:
    1. Identifies key concepts for each PICO element
    2. Provides appropriate MeSH terms and keywords
    3. Applies proper Boolean logic
    4. Includes relevant filters based on the criteria
    5. Is optimized for PubMed searching
    
    {{ ctx.output_format }}
  "#
}

test TestName {
  functions [GenerateSearchStrategy]
  args {
    research_question #"
      hello world
    "#
    pico {
        population #"
        hello world
      "#
        intervention #"
        hello world
      "#
        comparison #"
        hello world
      "#
        outcome #"
        hello world
      "#
    }
    criteria null
  }
}

test GenerateSearchStrategy_DiabetesRCT {
  functions [GenerateSearchStrategy]
  args {
    research_question #"
      In adult patients with type 2 diabetes, does GLP-1 receptor agonist therapy
      compared to conventional insulin therapy reduce hemoglobin A1c levels and
      cardiovascular mortality?
    "#
    pico {
      population #"
        Adult patients (≥18 years) with type 2 diabetes mellitus
      "#
      intervention #"
        GLP-1 receptor agonists (exenatide, liraglutide, semaglutide, dulaglutide)
      "#
      comparison #"
        Conventional insulin therapy or placebo
      "#
      outcome #"
        Reduction in hemoglobin A1c (HbA1c) levels, cardiovascular mortality,
        major adverse cardiovascular events, weight loss
      "#
    }
    criteria null
  }
}

test GenerateSearchStrategy_CancerImmunotherapy {
  functions [GenerateSearchStrategy]
  args {
    research_question #"
      In patients with advanced non-small cell lung cancer, does immune checkpoint
      inhibitor therapy combined with chemotherapy compared to chemotherapy alone
      improve overall survival and progression-free survival?
    "#
    pico {
      population #"
        Adults (≥18 years) with advanced or metastatic non-small cell lung cancer (NSCLC)
      "#
      intervention #"
        Immune checkpoint inhibitors (PD-1, PD-L1, CTLA-4 inhibitors) combined with platinum-based chemotherapy
      "#
      comparison #"
        Platinum-based chemotherapy alone
      "#
      outcome #"
        Overall survival (OS), progression-free survival (PFS), objective response rate (ORR), adverse events
      "#
    }
    criteria null
  }
}

test GenerateSearchStrategy_PediatricAsthma {
  functions [GenerateSearchStrategy]
  args {
    research_question #"
      In children with persistent asthma, does inhaled corticosteroid therapy
      compared to leukotriene receptor antagonists reduce asthma exacerbations
      and improve lung function?
    "#
    pico {
      population #"
        Children and adolescents (6-18 years) with persistent asthma
      "#
      intervention #"
        Inhaled corticosteroids (fluticasone, budesonide, mometasone, beclomethasone)
      "#
      comparison #"
        Leukotriene receptor antagonists (montelukast, zafirlukast)
      "#
      outcome #"
        Asthma exacerbation rate, lung function (FEV1), asthma control test scores, rescue inhaler use
      "#
    }
    criteria null
  }
}

test GenerateSearchStrategy_CardiovascularPrevention {
  functions [GenerateSearchStrategy]
  args {
    research_question #"
      In adults at high cardiovascular risk, does Mediterranean diet compared
      to low-fat diet reduce major cardiovascular events and all-cause mortality?
    "#
    pico {
      population #"
        Adults (≥40 years) at high cardiovascular risk or with established cardiovascular disease
      "#
      intervention #"
        Mediterranean diet (high in olive oil, nuts, fruits, vegetables, legumes, fish)
      "#
      comparison #"
        Low-fat diet or standard dietary advice
      "#
      outcome #"
        Major adverse cardiovascular events (MI, stroke, CV death), all-cause mortality,
        individual CV outcomes
      "#
    }
    criteria null
  }
}

test GenerateSearchStrategy_MentalHealthPsychotherapy {
  functions [GenerateSearchStrategy]
  args {
    research_question #"
      In adults with major depressive disorder, does cognitive behavioral therapy
      combined with antidepressant medication compared to antidepressant medication
      alone improve remission rates and reduce relapse?
    "#
    pico {
      population #"
        Adults (18-65 years) with diagnosed major depressive disorder (MDD)
      "#
      intervention #"
        Cognitive behavioral therapy (CBT) combined with antidepressant medication
      "#
      comparison #"
        Antidepressant medication alone (SSRI, SNRI, etc.)
      "#
      outcome #"
        Remission rates, relapse rates, depression symptom scores, response rates, quality of life
      "#
    }
    criteria null
  }
}

test GenerateSearchStrategy_HypertensionThiazides {
  functions [GenerateSearchStrategy]
  args {
    research_question #"
      In adults with essential hypertension, do thiazide diuretics compared to
      placebo or other antihypertensive agents reduce cardiovascular events and mortality?
    "#
    pico {
      population #"
        Adults (≥18 years) with essential hypertension
      "#
      intervention #"
        Thiazide diuretics (hydrochlorothiazide, chlorthalidone, indapamide)
      "#
      comparison #"
        Placebo, ACE inhibitors, ARBs, calcium channel blockers, or other antihypertensive agents
      "#
      outcome #"
        Cardiovascular mortality, all-cause mortality, stroke, myocardial infarction,
        blood pressure reduction
      "#
    }
    criteria null
  }
}

test GenerateSearchStrategy_ObesityPharmacotherapy {
  functions [GenerateSearchStrategy]
  args {
    research_question #"
      In adults with obesity, does GLP-1 receptor agonist therapy compared to
      placebo or other weight loss medications reduce body weight and improve
      metabolic parameters?
    "#
    pico {
      population #"
        Adults (≥18 years) with obesity (BMI ≥30) or overweight (BMI ≥27) with weight-related comorbidity
      "#
      intervention #"
        GLP-1 receptor agonists (semaglutide, liraglutide, tirzepatide)
      "#
      comparison #"
        Placebo, orlistat, naltrexone/bupropion, phentermine/topiramate
      "#
      outcome #"
        Body weight reduction (percentage and absolute), waist circumference,
        HbA1c, blood pressure, lipid profile, adverse events
      "#
    }
    criteria null
  }
}

test GenerateSearchStrategy_Covid19Vaccines {
  functions [GenerateSearchStrategy]
  args {
    research_question #"
      In adults, do mRNA COVID-19 vaccines compared to placebo or other vaccine
      platforms prevent SARS-CoV-2 infection and severe COVID-19 outcomes?
    "#
    pico {
      population #"
        Adults (≥18 years) without prior SARS-CoV-2 infection
      "#
      intervention #"
        mRNA COVID-19 vaccines (Pfizer-BioNTech BNT162b2, Moderna mRNA-1273)
      "#
      comparison #"
        Placebo, adenovirus vector vaccines (AstraZeneca, Johnson & Johnson),
        inactivated vaccines (Sinovac, Sinopharm)
      "#
      outcome #"
        SARS-CoV-2 infection (confirmed by PCR), symptomatic COVID-19,
        severe COVID-19, hospitalization, death, adverse events
      "#
    }
    criteria null
  }
}

test GenerateSearchStrategy_StrokeRehabilitation {
  functions [GenerateSearchStrategy]
  args {
    research_question #"
      In patients with stroke, does early intensive rehabilitation compared to
      standard care improve functional outcomes and reduce disability?
    "#
    pico {
      population #"
        Adults (≥18 years) with acute ischemic or hemorrhagic stroke
      "#
      intervention #"
        Early intensive rehabilitation (started within 7 days, high frequency/duration)
      "#
      comparison #"
        Standard rehabilitation care or delayed rehabilitation
      "#
      outcome #"
        Functional independence (Barthel Index, FIM), motor function (Fugl-Meyer),
        activities of daily living, quality of life, length of stay
      "#
    }
    criteria null
  }
}

test GenerateSearchStrategy_ChronicPainOpioids {
  functions [GenerateSearchStrategy]
  args {
    research_question #"
      In adults with chronic non-cancer pain, do opioid analgesics compared to
      non-opioid analgesics or non-pharmacological interventions reduce pain
      intensity and improve function?
    "#
    pico {
      population #"
        Adults (≥18 years) with chronic non-cancer pain lasting ≥3 months
      "#
      intervention #"
        Opioid analgesics (morphine, oxycodone, hydrocodone, tramadol, codeine)
      "#
      comparison #"
        Non-opioid analgesics (NSAIDs, acetaminophen), antidepressants,
        anticonvulsants, or non-pharmacological interventions
      "#
      outcome #"
        Pain intensity scores (VAS, NRS), physical function, quality of life,
        adverse effects, opioid misuse or addiction
      "#
    }
    criteria null
  }
}


/// Render a search strategy into a database-specific query string
function RenderSearchQuery(strategy: SearchStrategy, database: Database) -> RenderedQuery {
  client DefaultClient
  prompt #"
    {{_.role("system")}}
    You are an expert in search syntax for multiple bibliographic databases.
    Your task is to render a search strategy into a database-specific query string.
    
    Follow the syntax conventions for the target database:
    - PubMed: Use [tag] format (e.g., [tiab], [mesh], [tw])
    - Embase: Use :tag format (e.g., :ti, :ab, :kw)
    - Web of Science: Use field tags (e.g., TS=, TI=)
    - Scopus: Use field codes (e.g., TITLE-ABS-KEY, KEY)
    
    {{_.role("user")}}
    Search Strategy:
    {{ strategy }}
    
    Target Database: {{ database }}
    
    Render the search strategy into a properly formatted query string for the specified database.
    Ensure:
    1. Proper use of field tags/syntax for the database
    2. Correct nesting with parentheses
    3. Appropriate use of Boolean operators
    4. Proper handling of MeSH terms and qualifiers
    5. Inclusion of all applicable filters
    
    {{ ctx.output_format }}
  "#
}

/// Evaluate and optimize a search strategy
function EvaluateSearchStrategy(
    strategy: SearchStrategy,
    sample_results: string,
    target_result_count: int?
) -> StrategyEvaluation {
  client DefaultClient
  prompt #"
    {{_.role("system")}}
    You are an expert in systematic review search methodology.
    Your task is to evaluate a search strategy based on sample results and provide recommendations for optimization.
    
    {{_.role("user")}}
    Search Strategy:
    {{ strategy }}
    
    Sample Results (first 10 titles/abstracts):
    {{ sample_results }}
    
    Target Result Count: {{ target_result_count }}
    
    Evaluate the search strategy and provide:
    1. Assessment of result count (too many, too few, appropriate)
    2. Precision assessment based on sample results
    3. Suggestions for improving the strategy
    4. Terms that might be missing or should be added
    5. Terms that might be causing noise and should be removed/refined
    6. Recommendations for filters to apply
    
    {{ ctx.output_format }}
  "#
}

/// Extract MeSH terms for a concept
function ExtractMeSHTerms(concept_description: string, include_qualifiers: bool) -> MeSHTerm[] {
  client DefaultClient
  prompt #"
    {{_.role("system")}}
    You are an expert in medical subject headings (MeSH) terminology.
    Your task is to identify relevant MeSH terms for a given concept.
    
    {{_.role("user")}}
    Concept Description: {{ concept_description }}
    
    Include Qualifiers: {{ include_qualifiers }}
    
    Identify relevant MeSH terms for this concept. For each MeSH term:
    1. Provide the MeSH descriptor name
    2. If applicable, suggest relevant qualifiers/subheadings
    3. Indicate if the term should be exploded (include narrower terms)
    4. Indicate if it should be restricted to major topics only
    
    Focus on the most relevant and specific MeSH terms.
    
    {{ ctx.output_format }}
  "#
}

/// Generate keywords and synonyms for a concept
function GenerateKeywords(concept_description: string, include_variants: bool) -> string[] {
  client DefaultClient
  prompt #"
    {{_.role("system")}}
    You are an expert in medical terminology and search strategy development.
    Your task is to generate comprehensive keywords and synonyms for a concept.
    
    {{_.role("user")}}
    Concept Description: {{ concept_description }}
    
    Include Variants: {{ include_variants }}
    
    Generate a comprehensive list of keywords and synonyms including:
    1. Common terms and phrases
    2. Scientific/technical terms
    3. Abbreviations and acronyms
    4. Spelling variants (US vs UK)
    5. Related terms
    6. Trade names (for drugs/devices)
    
    Focus on terms that would be used in titles and abstracts.
    
    {{ ctx.output_format }}
  "#
}

/// Combine multiple search strategies
function CombineSearchStrategies(strategies: SearchStrategy[], method: string) -> SearchStrategy {
  client DefaultClient
  prompt #"
    {{_.role("system")}}
    You are an expert in systematic review search methodology.
    Your task is to combine multiple search strategies into a single comprehensive strategy.
    
    {{_.role("user")}}
    Search Strategies to Combine:
    {{ strategies }}
    
    Combination Method: {{ method }}
    
    Methods:
    - "union": Combine all unique concepts (OR logic between strategies)
    - "intersection": Keep only common concepts (AND logic between strategies)
    - "weighted": Prioritize concepts from more recent/strategies
    - "comprehensive": Create a maximally sensitive strategy
    
    Combine the strategies into a single, optimized search strategy that:
    1. Preserves the best elements from each strategy
    2. Eliminates redundancy
    3. Maintains appropriate sensitivity and specificity
    4. Is properly structured for the target databases
    
    {{ ctx.output_format }}
  "#
}

/// Translate search strategy to another database
function TranslateSearchStrategy(strategy: SearchStrategy, target_database: Database) -> SearchStrategy {
  client DefaultClient
  prompt #"
    {{_.role("system")}}
    You are an expert in multi-database searching for systematic reviews.
    Your task is to translate a search strategy from one database to another while maintaining conceptual equivalence.
    
    {{_.role("user")}}
    Original Search Strategy:
    {{ strategy }}
    
    Target Database: {{ target_database }}
    
    Translate the search strategy for the target database considering:
    1. Different indexing systems (MeSH vs Emtree, etc.)
    2. Different field tags and syntax
    3. Different available filters
    4. Database-specific thesaurus/controlled vocabulary
    5. Database-specific search features
    
    Maintain the conceptual intent of the original strategy while adapting to the target database's capabilities.
    
    {{ ctx.output_format }}
  "#
}
