// Medical Literature Structured Summary for Systematic Reviews
// Designed for evidence-based medicine (EBM) workflows

// ============ Data Models ============

// Paper identification and metadata
class PaperMetadata {
  title string
  authors string[]
  journal string
  publication_year int
  volume string?
  issue string?
  pages string?
  doi string?
  url string?
  abstract string
}

// Demographics - used inside Population
class Demographics {
  age_range string
  gender string?
  disease_status string
}

// Population (P) - The subjects/patients studied
class Population {
  description string
  sample_size int
  inclusion_criteria string[]
  exclusion_criteria string[]
  demographics Demographics
}

// Intervention (I) - The treatment or exposure
class Intervention {
  name string
  dosage string?
  duration string?
  route string?
  comparator string?
}

// Outcome (O) - What was measured
class Outcome {
  primary_outcomes string[]
  secondary_outcomes string[]
  measurement_tools string[]
  follow_up_duration string?
}

// Study Design Details
class StudyDesign {
  design_type string  // RCT, Cohort, Case-Control, Cross-sectional, etc.
  blinding string?     // Single-blind, Double-blind, Open-label
  randomization string?
  duration string?
  num_centers int?
  country string?
  setting string?
}

// Effect measures - used inside StatisticalResults
class EffectMeasures {
  relative_risk string?
  odds_ratio string?
  hazard_ratio string?
  mean_difference string?
  confidence_interval string?
}

// Results and Statistical Findings
class StatisticalResults {
  main_findings string
  effect_measures EffectMeasures
  p_value string?
  nnt int?  // Number needed to treat
  adverse_events string[]
}

// Risk of Bias Assessment
class RiskOfBias {
  selection_bias string    // Low / Moderate / High
  performance_bias string
  detection_bias string
  attrition_bias string
  reporting_bias string
  overall string
  concerns string[]
}

// Limitations and Strengths
class QualityAssessment {
  strengths string[]
  limitations string[]
  gaps_in_evidence string[]
}

// Clinical Implications
class ClinicalImplications {
  key_findings string
  clinical_relevance string
  applicability string  // External validity
  recommendations string[]
  safety_concerns string[]
}

// Complete Paper Summary
class PaperSummary {
  metadata PaperMetadata
  study_design StudyDesign
  population Population
  intervention Intervention
  outcome Outcome
  results StatisticalResults
  risk_of_bias RiskOfBias
  quality QualityAssessment
  clinical_implications ClinicalImplications
  plain_english_summary string  // For non-experts
  keywords string[]
}

// ============ Functions ============

// Main function to summarize a medical literature article
function SummarizeMedicalLiterature(content: string) -> PaperSummary {
  // Client configuration - uses MiniMax (Anthropic-compatible API)
  client MiniMax
  prompt #"
    You are an expert in evidence-based medicine and systematic review.
    Analyze the following medical literature article and provide a comprehensive structured summary.

    {{ content }}

    {{ ctx.output_format }}

    Instructions:
    - Extract all available information accurately
    - Use "Unknown" for fields that cannot be determined from the text
    - For PICO elements, focus on explicitly stated information
    - Provide clinically meaningful summaries
    - Use accessible language for the plain_english_summary
  "#
}

// PICO extraction result
class PICOExtraction {
  population string
  intervention string
  comparator string
  outcome string
}

// Quick PICO extraction function
function ExtractPICO(content: string) -> PICOExtraction {
  client MiniMax
  prompt #"
    Extract the PICO (Population, Intervention, Comparator, Outcome) elements from this medical literature:

    {{ content }}

    {{ ctx.output_format }}
  "#
}

// Quality assessment function
function AssessStudyQuality(content: string) -> RiskOfBias {
  client MiniMax
  prompt #"
    Assess the methodological quality and risk of bias for this medical study:

    {{ content }}

    {{ ctx.output_format }}
  "#
}

// Batch summarization for multiple papers
function SummarizeMultiplePapers(papers: string) -> PaperSummary[] {
  client MiniMax
  prompt #"
    Summarize multiple medical papers for a systematic review.
    Identify common themes, conflicts, and gaps.

    Papers:
    {{ papers }}

    {{ ctx.output_format }}
  "#
}

test TestName {
  functions [SummarizeMultiplePapers]
  args {
    papers #"
      hello world
    "#
  }
}

// ============ Tests ============

test summarize_aspirin_rct {
  functions [SummarizeMedicalLiterature]
  args {
    content #"
      Title: Aspirin for the Primary Prevention of Cardiovascular Disease: A Systematic Review

      Authors: Jones, M., Smith, A., Johnson, B.
      Journal: New England Journal of Medicine
      Year: 2023
      DOI: 10.1056/NEJMoa2023456

      Abstract:
      Background: The role of aspirin in primary prevention of cardiovascular disease remains controversial.
      We conducted a systematic review of randomized controlled trials evaluating aspirin versus no aspirin
      in individuals without known cardiovascular disease.

      Methods: We searched PubMed, EMBASE, and Cochrane databases for RCTs published between 2000-2023.
      Primary outcome was major adverse cardiovascular events (MACE). Secondary outcomes included all-cause
      mortality, bleeding events, and quality of life.

      Results: 12 trials with 95,000 participants were included. Aspirin reduced MACE (RR 0.85, 95% CI 0.76-0.95,
      p=0.004) but increased major bleeding (RR 1.50, 95% CI 1.25-1.80, p<0.001). The number needed to treat
      to prevent one MACE was 250, while the number needed to harm was 200 for major bleeding.

      Conclusions: Aspirin for primary prevention shows modest benefit but increased bleeding risk.
      Net clinical benefit depends on individual patient characteristics and cardiovascular risk profile.

      Study Design: Randomized, double-blind, placebo-controlled trial
      Duration: 5 years median follow-up
      Centers: 200 centers in 15 countries
    "#
  }
}

test extract_pico_example {
  functions [ExtractPICO]
  args {
    content #"
      Study: Effect of Metformin on HbA1c in Type 2 Diabetes

      Population: Adults aged 40-70 with newly diagnosed Type 2 Diabetes (n=500)
      HbA1c between 7.0-9.0%, BMI 25-35 kg/m2

      Intervention: Metformin 1000mg twice daily

      Comparator: Placebo

      Outcomes: Primary: Change in HbA1c at 6 months
      Secondary: Fasting glucose, BMI, adverse events
    "#
  }
}
