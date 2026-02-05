// ============================================================================
// Meta Analysis Inclusion/Exclusion Criteria Types
// Comprehensive dimension system for systematic review criteria
// ============================================================================

// ============================================================================
// 1. Study Design Dimension (研究设计维度)
// ============================================================================

enum StudyDesignType {
    RCT
    CohortStudy
    CaseControlStudy
    CrossSectionalStudy
    CaseSeries
    CaseReport
    DiagnosticAccuracyStudy
    PrognosticStudy
    MixedStudy
}

enum RCTDesignType {
    Parallel
    Crossover
    Factorial
    ClusterRandomized
    NonInferiority
    Superiority
    Equivalence
}

enum ObservationalStudyType {
    ProspectiveOnly
    RetrospectiveOnly
    BothAccepted
}

enum RandomizationMethod {
    AdequateRandomization
    SimpleRandomization
    StratifiedRandomization
    BlockRandomization
    NotSpecified
}

enum AllocationConcealment {
    Adequate
    Unclear
    NotRequired
}

enum BlindingType {
    DoubleBlind
    SingleBlindParticipant
    SingleBlindInvestigator
    TripleBlind
    OpenLabel
    NotSpecified
}

enum OutcomeAssessorBlinding {
    Blinded
    NotRequired
}

enum FollowUpDuration {
    ShortTerm // < 3 months
    MediumTerm // 3-12 months
    LongTerm // > 12 months
    NotSpecified
}

enum TrialPhase {
    PhaseI
    PhaseII
    PhaseIII
    PhaseIV
    PostMarketing
    NotSpecified
}

enum StudyNature {
    Exploratory
    Confirmatory
    BothAccepted
}

class StudyDesignCriteria {
    study_design_type StudyDesignType? @description(#"The type of study design to include"#)
    rct_design_type RCTDesignType? @description(#"Specific RCT design type (if applicable)"#)
    observational_study_type ObservationalStudyType? @description(#"For observational studies, which types are accepted"#)
    
    // Sample size requirements
    min_total_sample_size int? @description(#"Minimum total sample size required"#)
    min_sample_size_per_group int? @description(#"Minimum sample size per group"#)
    min_event_count int? @description(#"Minimum number of events required"#)
    requires_sample_size_calculation bool? @description(#"Whether study must report sample size calculation"#)
    min_statistical_power float? @description(#"Minimum statistical power required (e.g., 0.8 for 80%)"#)
    
    // Randomization (RCT only)
    randomization_method RandomizationMethod? @description(#"Required randomization method"#)
    allocation_concealment AllocationConcealment? @description(#"Required allocation concealment"#)
    
    // Blinding (RCT only)
    blinding_type BlindingType? @description(#"Required blinding type"#)
    outcome_assessor_blinding OutcomeAssessorBlinding? @description(#"Whether outcome assessor must be blinded"#)
    
    // Follow-up requirements
    follow_up_duration FollowUpDuration? @description(#"Minimum follow-up duration"#)
    min_follow_up_weeks int? @description(#"Minimum follow-up in weeks"#)
    max_loss_to_follow_up float? @description(#"Maximum acceptable loss to follow-up rate (e.g., 0.2 for 20%)"#)
    requires_specific_timepoints bool? @description(#"Whether specific time points must be included"#)
    requires_final_followup bool? @description(#"Whether final follow-up data must be reported"#)
    
    // Trial phase and nature
    trial_phase TrialPhase? @description(#"Required trial phase"#)
    study_nature StudyNature? @description(#"Required study nature"#)
}

// ============================================================================
// 2. Population Dimension (研究人群维度)
// ============================================================================

enum AgeGroup {
    Children // < 18 years
    Adults // 18-65 years
    Elderly // >= 65 years
    NotSpecified
}

enum GenderRequirement {
    MaleOnly
    FemaleOnly
    BothRequired
    NotSpecified
}

enum DiseaseActivity {
    Active
    Remission
    Stable
    NotSpecified
}

enum DiseaseCourse {
    NewlyDiagnosed
    ShortDuration // < X time
    LongDuration // >= X time
    Chronic
    NotSpecified
}

enum TreatmentHistory {
    TreatmentNaive
    TreatmentExperienced
    TreatmentFailed
    StableTreatment
    NotSpecified
}

enum SpecialPopulation {
    Pregnant
    Lactating
    Pediatric
    Geriatric
    ICU
    Immunocompromised
    None
}

enum MedicalSetting {
    Inpatient
    Outpatient
    Community
    NotSpecified
}

class PopulationCriteria {
    // Demographics
    age_group AgeGroup? @description(#"Required age group"#)
    min_age int? @description(#"Minimum age in years"#)
    max_age int? @description(#"Maximum age in years"#)
    gender_requirement GenderRequirement? @description(#"Gender requirements"#)
    min_female_percentage float? @description(#"Minimum percentage of female participants"#)
    
    // Disease characteristics
    disease_diagnosis string? @description(#"Specific disease diagnosis required"#)
    disease_subtype string? @description(#"Specific disease subtype required"#)
    disease_severity string? @description(#"Disease severity (mild/moderate/severe)"#)
    disease_stage string? @description(#"Disease stage (I/II/III/IV)"#)
    diagnostic_criteria string? @description(#"Required diagnostic criteria (e.g., WHO, FDA)"#)
    requires_pathological_diagnosis bool? @description(#"Whether pathological diagnosis is required"#)
    
    disease_activity DiseaseActivity? @description(#"Required disease activity status"#)
    disease_course DiseaseCourse? @description(#"Required disease course"#)
    
    // Clinical characteristics
    baseline_condition string? @description(#"Specific baseline condition required (e.g., HbA1c 7-10%)"#)
    requires_comorbidities bool? @description(#"Whether comorbidities must be present"#)
    allowed_comorbidities string[] @description(#"List of allowed comorbidities"#)
    excluded_comorbidities string[] @description(#"List of excluded comorbidities"#)
    treatment_history TreatmentHistory? @description(#"Required treatment history"#)
    
    // Special populations
    special_population SpecialPopulation? @description(#"Special population considerations"#)
    analyze_special_population_separately bool? @description(#"Whether special populations should be analyzed separately"#)
    
    // Geographic and setting
    geographic_region string[] @description(#"Specific geographic regions allowed"#)
    medical_setting MedicalSetting? @description(#"Medical setting requirement"#)
    income_level string[] @description(#"Country income level (high/medium/low)"#)
}

// ============================================================================
// 3. Intervention/Exposure Dimension (干预/暴露维度)
// ============================================================================

enum InterventionCategory {
    Pharmacological
    Surgical
    PhysicalTherapy
    Psychological
    Lifestyle
    Rehabilitation
    Educational
    Nutritional
    Device
    Other
}

enum AdministrationRoute {
    Oral
    Intravenous
    Intramuscular
    Subcutaneous
    Topical
    Inhaled
    Other
}

enum DoseType {
    FixedDose
    AdjustableDose
    TitratedDose
    NotSpecified
}

enum TreatmentFrequency {
    SingleDose
    Daily
    Weekly
    Monthly
    AsNeeded
    NotSpecified
}

enum TreatmentTiming {
    Preoperative
    Postoperative
    SpecificTimepoint
    Continuous
    NotSpecified
}

enum CombinationIntervention {
    SingleIntervention
    AllowsBackgroundTherapy
    AllowsSpecificCombination
    ExcludesCombination
}

enum ExposureType {
    Environmental
    Occupational
    Lifestyle
    Genetic
    Biomarker
}

enum ExposureIntensity {
    High
    Low
    Graded
    NotSpecified
}

enum ExposureDuration {
    Acute
    Chronic
    SpecificDuration
    NotSpecified
}

class InterventionCriteria {
    // Intervention type
    intervention_category InterventionCategory? @description(#"Category of intervention"#)
    specific_intervention string[] @description(#"Specific interventions allowed"#)
    allows_same_class_different_drug bool? @description(#"Whether different drugs in same class are allowed"#)
    
    // Administration
    administration_route AdministrationRoute[] @description(#"Allowed administration routes"#)
    treatment_frequency TreatmentFrequency? @description(#"Required treatment frequency"#)
    specific_frequency string? @description(#"Specific frequency (e.g., twice daily)"#)
    treatment_timing TreatmentTiming? @description(#"Treatment timing requirement"#)
    
    // Dose requirements
    dose_type DoseType? @description(#"Type of dosing"#)
    specific_dose string? @description(#"Specific dose required (e.g., 10mg)"#)
    dose_range string? @description(#"Allowed dose range (e.g., 5-20mg)"#)
    excludes_extreme_doses bool? @description(#"Whether extreme doses are excluded"#)
    requires_loading_dose bool? @description(#"Whether loading dose is required"#)
    max_dose string? @description(#"Maximum allowed dose"#)
    
    // Treatment duration
    min_treatment_duration_weeks int? @description(#"Minimum treatment duration in weeks"#)
    single_course_only bool? @description(#"Whether only single course is allowed"#)
    allows_multiple_courses bool? @description(#"Whether multiple courses are allowed"#)
    early_intervention bool? @description(#"Whether early intervention is required"#)
    allows_repeated_treatment bool? @description(#"Whether repeated treatment is allowed"#)
    
    // Implementation
    provider_type string[] @description(#"Type of providers who can administer"#)
    implementation_setting string[] @description(#"Where intervention is implemented"#)
    
    // Combination therapy
    combination_intervention CombinationIntervention? @description(#"Combination intervention policy"#)
    allows_standard_background_therapy bool? @description(#"Whether standard background therapy is allowed"#)
    allows_concomitant_therapy bool? @description(#"Whether concomitant therapy is allowed"#)
    requires_concomitant_reported bool? @description(#"Whether concomitant therapy must be reported"#)
    
    // Exposure factors (for observational studies)
    exposure_type ExposureType? @description(#"Type of exposure"#)
    exposure_intensity ExposureIntensity? @description(#"Intensity of exposure"#)
    exposure_duration ExposureDuration? @description(#"Duration of exposure"#)
    exposure_measurement string? @description(#"How exposure is measured"#)
}

// ============================================================================
// 4. Comparison Dimension (对照维度)
// ============================================================================

enum ComparisonType {
    Placebo
    ActiveControl
    StandardTreatment
    Waitlist
    NoTreatment
    HistoricalControl
    SelfControl
}

enum ComparisonSpecificity {
    SpecificComparator
    SameClassComparator
    AnyComparator
}

enum ComparisonDoseType {
    StandardRecommended
    FixedDose
    AdjustableDose
    NotSpecified
}

class ComparisonCriteria {
    comparison_type ComparisonType? @description(#"Type of comparison"#)
    comparison_specificity ComparisonSpecificity? @description(#"Specificity of comparison"#)
    specific_comparator string[] @description(#"Specific comparators allowed"#)
    
    // Dose requirements
    comparison_dose_type ComparisonDoseType? @description(#"Dose type for comparison"#)
    requires_dose_matching bool? @description(#"Whether dose matching is required"#)
    
    // Implementation
    same_administration_route bool? @description(#"Whether same route as intervention is required"#)
    same_treatment_duration bool? @description(#"Whether same duration as intervention is required"#)
    
    // Crossover design
    requires_washout_period bool? @description(#"Whether washout period is required (crossover)"#)
    randomized_sequence bool? @description(#"Whether sequence should be randomized (crossover)"#)
}

// ============================================================================
// 5. Outcomes Dimension (结局维度)
// ============================================================================

enum OutcomeCategory {
    Primary
    Secondary
    Exploratory
}

enum OutcomeNature {
    Efficacy
    Safety
    Survival
    QualityOfLife
    Economic
    Biomarker
}

enum OutcomeDataType {
    Continuous
    Binary
    Ordinal
    TimeToEvent
    Count
}

enum MeasurementMethod {
    StandardizedScale
    ObjectiveMeasurement
    Imaging
    Questionnaire
    NotSpecified
}

enum FollowUpTime {
    ShortTerm // <= 3 months
    MediumTerm // 3-12 months
    LongTerm // > 12 months
    NotSpecified
}

class OutcomeCriteria {
    // Outcome type
    outcome_category OutcomeCategory? @description(#"Required outcome category"#)
    outcome_nature OutcomeNature[] @description(#"Required outcome nature(s)"#)
    outcome_data_type OutcomeDataType? @description(#"Required outcome data type"#)
    
    // Specific outcomes
    required_outcomes string[] @description(#"Specific outcomes that must be included"#)
    at_least_one_outcome string[] @description(#"At least one of these outcomes must be present"#)
    excluded_outcomes string[] @description(#"Outcomes that should be excluded"#)
    excludes_surrogate_endpoints bool? @description(#"Whether surrogate endpoints are excluded"#)
    
    // Measurement
    measurement_method MeasurementMethod? @description(#"Required measurement method"#)
    specific_scale string[] @description(#"Specific scales required (e.g., VAS, SF-36)"#)
    requires_validated_tool bool? @description(#"Whether validated tool is required"#)
    requires_blinded_assessment bool? @description(#"Whether blinded assessment is required"#)
    requires_independent_assessment bool? @description(#"Whether independent assessment is required"#)
    self_reported bool? @description(#"Whether self-reported outcomes are allowed"#)
    
    // Reporting requirements
    requires_mean_sd bool? @description(#"Whether mean and SD must be reported"#)
    requires_event_counts bool? @description(#"Whether event counts must be reported"#)
    requires_effect_size_ci bool? @description(#"Whether effect size with CI must be reported"#)
    allows_data_extraction bool? @description(#"Whether data can be extracted from figures"#)
    
    // Follow-up time
    follow_up_time FollowUpTime? @description(#"Required follow-up time for outcomes"#)
    
    // Adverse events
    requires_adverse_events bool? @description(#"Whether adverse events must be reported"#)
    requires_serious_adverse_events bool? @description(#"Whether serious adverse events must be reported"#)
    adverse_event_definition string? @description(#"Required adverse event definition (e.g., CTCAE)"#)
    minimum_adverse_event_grade string? @description(#"Minimum adverse event grade to report"#)
}

// ============================================================================
// 6. Publication Characteristics Dimension (发表特征维度)
// ============================================================================

enum PublicationType {
    FullText
    ConferenceAbstract
    Dissertation
    Preprint
}

enum PeerReviewStatus {
    PeerReviewed
    NonPeerReviewed
}

enum GreyLiterature {
    IncludeGreyLiterature
    PublishedOnly
}

enum PublicationLanguage {
    EnglishOnly
    EnglishAndChinese
    AnyLanguage
    SpecificLanguages
}

class PublicationCriteria {
    // Publication status
    publication_type PublicationType? @description(#"Required publication type"#)
    peer_review_status PeerReviewStatus? @description(#"Peer review status"#)
    grey_literature GreyLiterature? @description(#"Grey literature policy"#)
    requires_trial_registration bool? @description(#"Whether trial registration is required"#)
    
    // Language
    publication_language PublicationLanguage? @description(#"Publication language requirement"#)
    specific_languages string[] @description(#"Specific allowed languages"#)
    
    // Time
    min_publication_year int? @description(#"Earliest publication year"#)
    max_publication_year int? @description(#"Latest publication year"#)
    within_last_x_years int? @description(#"Include only publications within last X years"#)
    
    // Journal
    journal_type string[] @description(#"Required journal type (e.g., SCI, SSCI)"#)
    min_impact_factor float? @description(#"Minimum impact factor"#)
    specific_journals string[] @description(#"Specific journals to include"#)
    open_access_only bool? @description(#"Whether only open access journals are included"#)
    
    // Duplicate publication
    duplicate_publication_policy string? @description(#"Policy for duplicate publications"#)
}

// ============================================================================
// 7. Data Quality Dimension (数据质量维度)
// ============================================================================

enum DataFormat {
    MeanSD
    MedianIQR
    MeanCI
    EventCount
    EffectSizeCI
    Other
}

class DataQualityCriteria {
    // Required data
    requires_sample_size bool? @description(#"Whether sample size must be reported"#)
    requires_mean_sd bool? @description(#"Whether mean and SD must be reported"#)
    requires_event_counts bool? @description(#"Whether event counts must be reported"#)
    requires_effect_size_ci bool? @description(#"Whether effect size with CI must be reported"#)
    allows_figure_extraction bool? @description(#"Whether data can be extracted from figures"#)
    
    // Data missing
    allows_missing_data bool? @description(#"Whether some missing data is acceptable"#)
    contact_author_for_data bool? @description(#"Whether authors can be contacted for missing data"#)
    requires_data_consistency bool? @description(#"Whether data must be internally consistent"#)
    
    // Extractability
    extraction_method string[] @description(#"Allowed extraction methods"#)
    required_data_format DataFormat[] @description(#"Required data format(s)"#)
    allows_data_conversion bool? @description(#"Whether data conversion is acceptable"#)
    
    // Multiple timepoints
    timepoint_selection string? @description(#"Which timepoints to include"#)
    requires_change_scores bool? @description(#"Whether change scores are required"#)
}

// ============================================================================
// 8. Methodological Quality Dimension (方法学质量维度)
// ============================================================================

enum BiasRiskLevel {
    LowRiskOnly
    LowAndMediumRisk
    AnyRisk
}

enum BiasAssessmentTool {
    CochraneRoB2
    ROBINSI
    NOS
    Jadad
    NotSpecified
}

enum StatisticalAnalysis {
    AppropriateMethods
    AdjustsConfounders
    IntentionToTreat
    PerProtocol
    NotSpecified
}

class MethodologicalQualityCriteria {
    // Bias assessment
    bias_risk_level BiasRiskLevel? @description(#"Maximum acceptable bias risk"#)
    bias_assessment_tool BiasAssessmentTool? @description(#"Required assessment tool"#)
    min_quality_score int? @description(#"Minimum quality score"#)
    min_low_risk_domains int? @description(#"Minimum number of low risk domains"#)
    
    // Specific bias types
    requires_low_selection_bias bool? @description(#"Whether low selection bias is required"#)
    requires_low_performance_bias bool? @description(#"Whether low performance bias is required"#)
    requires_low_detection_bias bool? @description(#"Whether low detection bias is required"#)
    requires_low_attrition_bias bool? @description(#"Whether low attrition bias is required"#)
    requires_complete_reporting bool? @description(#"Whether complete reporting is required"#)
    
    // Statistical methods
    statistical_analysis StatisticalAnalysis? @description(#"Required statistical analysis approach"#)
    requires_adjusted_effects bool? @description(#"Whether adjusted effects must be reported"#)
    requires_intention_to_treat bool? @description(#"Whether ITT analysis is required"#)
    
    // Ethics
    requires_ethical_approval bool? @description(#"Whether ethical approval must be reported"#)
    requires_informed_consent bool? @description(#"Whether informed consent must be reported"#)
}

// ============================================================================
// 9. Setting/Context Dimension (地域与环境维度)
// ============================================================================

enum HospitalLevel {
    Tertiary
    Secondary
    Community
    NotSpecified
}

enum StudyScale {
    SingleCenter
    MultiCenter
    International
}

enum CountryIncomeLevel {
    HighIncome
    MiddleIncome
    LowIncome
}

enum UrbanRural {
    Urban
    Rural
    NotSpecified
}

class SettingCriteria {
    // Medical setting
    hospital_level HospitalLevel? @description(#"Required hospital level"#)
    specific_countries string[] @description(#"Specific countries allowed"#)
    specific_regions string[] @description(#"Specific regions allowed (e.g., Asia, Europe)"#)
    study_scale StudyScale? @description(#"Required study scale"#)
    
    // Healthcare system
    healthcare_system string[] @description(#"Healthcare system type"#)
    
    // Economic context
    country_income_level CountryIncomeLevel? @description(#"Country income level"#)
    urban_rural UrbanRural? @description(#"Urban/rural requirement"#)
    medical_resource_level string? @description(#"Medical resource level"#)
}

// ============================================================================
// 10. Ethics & Compliance Dimension (伦理与合规维度)
// ============================================================================

enum FundingSource {
    NonProfitOnly
    IncludesIndustry
}

enum ConflictOfInterest {
    Reported
    None
}

enum ComplianceStandard {
    CONSORT
    STROBE
    PRISMA
    NotSpecified
}

class EthicsComplianceCriteria {
    requires_ethical_approval bool? @description(#"Whether ethical approval is required"#)
    requires_informed_consent bool? @description(#"Whether informed consent is required"#)
    requires_trial_registration bool? @description(#"Whether trial registration is required"#)
    
    funding_source FundingSource? @description(#"Funding source requirements"#)
    conflict_of_interest ConflictOfInterest? @description(#"Conflict of interest requirements"#)
    
    compliance_standard ComplianceStandard[] @description(#"Required compliance standards"#)
}

// ============================================================================
// Main Inclusion/Exclusion Criteria Container
// ============================================================================

enum CriteriaType {
    Inclusion
    Exclusion
}

class Criterion {
    type CriteriaType @description(#"Whether this is an inclusion or exclusion criterion"#)
    dimension string @description(#"The dimension this criterion belongs to (e.g., 'Study Design', 'Population')"#)
    description string @description(#"Human-readable description of the criterion"#)
    rationale string? @description(#"Rationale for this criterion"#)
}

class InclusionExclusionCriteria {
    // Study design
    study_design StudyDesignCriteria? @description(#"Study design related criteria"#)
    
    // Population
    population PopulationCriteria? @description(#"Population related criteria"#)
    
    // Intervention
    intervention InterventionCriteria? @description(#"Intervention related criteria"#)
    
    // Comparison
    comparison ComparisonCriteria? @description(#"Comparison related criteria"#)
    
    // Outcomes
    outcomes OutcomeCriteria? @description(#"Outcome related criteria"#)
    
    // Publication
    publication PublicationCriteria? @description(#"Publication related criteria"#)
    
    // Data quality
    data_quality DataQualityCriteria? @description(#"Data quality related criteria"#)
    
    // Methodological quality
    methodological_quality MethodologicalQualityCriteria? @description(#"Methodological quality criteria"#)
    
    // Setting/context
    setting SettingCriteria? @description(#"Setting and context criteria"#)
    
    // Ethics/compliance
    ethics_compliance EthicsComplianceCriteria? @description(#"Ethics and compliance criteria"#)
    
    // Additional criteria
    additional_criteria Criterion[] @description(#"Any additional criteria not covered by standard dimensions"#)
}

// ============================================================================
// Functions for generating and evaluating criteria
// ============================================================================

/// Generate inclusion/exclusion criteria based on a research question
/// This function analyzes the research question and generates appropriate criteria
function GenerateCriteria(research_question: string, pico: PICO) -> InclusionExclusionCriteria {
  client DefaultClient
  prompt #"
    {{_.role("system")}}
    You are an expert in systematic review and meta-analysis methodology.
    Your task is to generate comprehensive inclusion/exclusion criteria based on a research question and PICO framework.
    
    Consider all ten dimensions:
    1. Study Design (研究设计维度)
    2. Population (研究人群维度)
    3. Intervention/Exposure (干预/暴露维度)
    4. Comparison (对照维度)
    5. Outcomes (结局维度)
    6. Publication Characteristics (发表特征维度)
    7. Data Quality (数据质量维度)
    8. Methodological Quality (方法学质量维度)
    9. Setting/Context (地域与环境维度)
    10. Ethics & Compliance (伦理与合规维度)
    
    {{_.role("user")}}
    Research Question: {{ research_question }}
    
    PICO Elements:
    - Population: {{ pico.population }}
    - Intervention: {{ pico.intervention }}
    - Comparison: {{ pico.comparison }}
    - Outcome: {{ pico.outcome }}
    
    Generate appropriate inclusion/exclusion criteria based on this research question.
    Only include criteria that are relevant to this specific research question.
    Leave optional fields as null if not applicable.
    
    {{ ctx.output_format }}
  "#
}

/// Evaluate whether a study meets the inclusion/exclusion criteria
/// This function assesses a study against the defined criteria
function EvaluateCriteria(study: string, criteria: InclusionExclusionCriteria) -> string {
  client DefaultClient
  prompt #"
    {{_.role("system")}}
    You are an expert in systematic review and meta-analysis methodology.
    Your task is to evaluate whether a study meets the specified inclusion/exclusion criteria.
    
    {{_.role("user")}}
    Study Information:
    {{ study }}
    
    Inclusion/Exclusion Criteria:
    {{ criteria }}
    
    Evaluate the study against each relevant criterion and provide:
    1. Whether the study meets the inclusion criteria
    2. Whether the study meets any exclusion criteria
    3. A detailed justification for your decision
    4. List any criteria that are unclear or not reported in the study
    
    Provide your evaluation in a clear, structured format.
  "#
}

