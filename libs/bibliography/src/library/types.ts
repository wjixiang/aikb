// Enhanced metadata interfaces for Zotero-like functionality
export interface Author {
  firstName: string;
  lastName: string;
  middleName?: string;
}

/**
 * PDF processing status enum
 * @deprecated need to migrate to rabbitmq shared service
 */
export enum PdfProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ANALYZING = 'analyzing',
  SPLITTING = 'splitting',
  MERGING = 'merging',
  CONVERTING = 'converting',
}

export type FileType = 'pdf';

export interface ItemArchive {
  fileType: FileType;
  fileSize: number;
  fileHash: string;
  addDate: Date;
  s3Key: string;
  pageCount: number; // Required for PDF files
  wordCount?: number;
}

export type EvidenceType =
  // SA: Systematic Review & Meta-Analysis (8 subtypes)
  | 'SA01' // Meta-analysis of Intervention Studies
  | 'SA02' // Meta-analysis of Diagnostic Studies
  | 'SA03' // Meta-analysis of Prognostic Studies
  | 'SA04' // Meta-analysis of Harm Studies
  | 'SA05' // Network Meta-Analysis
  | 'SA06' // Umbrella Review
  | 'SA07' // Scoping Review
  | 'SA08' // Rapid Review
  // R: Experimental Studies (6 subtypes)
  | 'R01' // Parallel RCT
  | 'R02' // Crossover RCT
  | 'R03' // Cluster RCT
  | 'R04' // Non-inferiority Trial
  | 'R05' // Stepped Wedge RCT
  | 'R06' // Pre-randomized Design
  // O: Observational Studies (8 subtypes)
  | 'O01' // Prospective Cohort Study
  | 'O02' // Retrospective Cohort Study
  | 'O03' // Case-Control Study
  | 'O04' // Nested Case-Control Study
  | 'O05' // Cross-sectional Study
  | 'O06' // Ecological Study
  | 'O07' // Longitudinal Study
  | 'O08' // Historical Cohort Study
  // D: Diagnostic Studies (5 subtypes)
  | 'D01' // Cohort Diagnostic Study
  | 'D02' // Case-control Diagnostic Study
  | 'D03' // Comparative Diagnostic Study
  | 'D04' // Multimodality Diagnostic Study
  | 'D05' // Sequential Diagnostic Study
  // P: Prognostic Studies (5 subtypes)
  | 'P01' // Prognostic Cohort Study
  | 'P02' // Prediction Model Study
  | 'P03' // Prognostic Registry
  | 'P04' // Longitudinal Prognostic Study
  | 'P05' // Biomarker Prognostic Study
  // H: Harm/Etiology Studies (5 subtypes)
  | 'H01' // RCT for Harm Assessment
  | 'H02' // Cohort Study of Harm
  | 'H03' // Case-Control Study of Harm
  | 'H04' // Self-controlled Case Study
  | 'H05' // Pharmacovigilance Study
  // HE: Health Economic Studies (5 subtypes)
  | 'HE01' // Cost-Effectiveness Analysis (CEA)
  | 'HE02' // Cost-Utility Analysis (CUA)
  | 'HE03' // Cost-Benefit Analysis (CBA)
  | 'HE04' // Budget Impact Analysis (BIA)
  | 'HE05' // Cost of Illness Study
  // C: Clinical Practice Guidelines (3 subtypes)
  | 'C01' // GRADE-based CPG
  | 'C02' // Consensus-based CPG
  | 'C03' // Institutional CPG
  // CR: Methodological Research (3 subtypes)
  | 'CR01' // Methodology Development
  | 'CR02' // Validation Study
  | 'CR03' // Comparative Methodology
  // B: Basic Science (4 subtypes)
  | 'B01' // Animal Experiment
  | 'B02' // In Vitro Experiment
  | 'B03' // Mechanistic Study
  | 'B04' // Basic Technical Method
  // OJ: Expert Opinion/Consensus (3 subtypes)
  | 'OJ01' // Expert Consensus Statement
  | 'OJ02' // Delphi Study
  | 'OJ03' // Expert Opinion/Commentary
  // RE: Review/Commentary (2 subtypes)
  | 'RE01' // Narrative Review
  | 'RE02'; // Editorial Commentary

export type EvidencePrimaryCategory =
  | 'SA' // Systematic Review & Meta-Analysis
  | 'R' // Experimental Studies
  | 'O' // Observational Studies
  | 'D' // Diagnostic Studies
  | 'P' // Prognostic Studies
  | 'H' // Harm/Etiology Studies
  | 'HE' // Health Economic Studies
  | 'C' // Clinical Practice Guidelines
  | 'CR' // Methodological Research
  | 'B' // Basic Science
  | 'OJ' // Expert Opinion/Consensus
  | 'RE'; // Review/Commentary

export type GradeLevel = 'High' | 'Moderate' | 'Low' | 'Very Low';

export type OCEBMLevel = '1a' | '1b' | '2a' | '2b' | '3a' | '3b' | '4' | '5';

export type ClinicalQuestionType =
  | 'Treatment'
  | 'Prevention'
  | 'Diagnosis'
  | 'Prognosis'
  | 'Harm'
  | 'Etiology'
  | 'Economics';

export type RiskOfBiasTool =
  | 'AMSTAR 2'
  | 'Cochrane RoB 2.0'
  | 'QUADAS-2'
  | 'ROBINS-I'
  | 'NOS'
  | 'QUIPS'
  | 'PROBAST'
  | 'SYRCLE RoB'
  | 'CINeMA'
  | 'CHEERS'
  | 'AGREE II'
  | 'GRADE-CERQual'
  | 'ISPOR BIA'
  | 'AXIS';

export type ReportingGuideline =
  | 'PRISMA 2020'
  | 'PRISMA-DTA'
  | 'PRISMA-NMA'
  | 'PRISMA-ScR'
  | 'PRISMA-R'
  | 'CONSORT'
  | 'CONSORT-extension'
  | 'STROBE'
  | 'STROBE-Pharm'
  | 'STARD 2015'
  | 'REMARK'
  | 'TRIPOD'
  | 'RIGHT'
  | 'ARRIVE 2.0'
  | 'CHEERS 2022'
  | 'ISPOR BIA Guidelines';

export interface EvidenceTypeMetadata {
  typeCode: EvidenceType;
  primaryCategory: EvidencePrimaryCategory;
  primaryCategoryName: string;
  subcategoryName: string;
  subcategoryNameEn: string;
  description: string;
  gradeInitial: GradeLevel;
  ocebmLevel?: OCEBMLevel;
  clinicalQuestionTypes: ClinicalQuestionType[];
  riskOfBiasTool?: RiskOfBiasTool;
  reportingGuideline?: ReportingGuideline;
  meshTerms: string[];
  keywords: string[];
  hierarchyLevel: number;
}

export interface EvidenceQualityAssessment {
  typeCode: EvidenceType;
  gradeInitial: GradeLevel;
  gradeFinal?: GradeLevel;
  downgradeFactors?: DowngradeFactor[];
  upgradeFactors?: UpgradeFactor[];
  riskOfBiasAssessment?: Record<string, unknown>;
  reportingGuidelineCompliance?: Record<string, unknown>;
}

export type DowngradeFactor =
  | 'LIMITATIONS'
  | 'INCONSISTENCY'
  | 'INDIRECTNESS'
  | 'IMPRECISION'
  | 'PUBLICATION_BIAS';

export type UpgradeFactor =
  | 'LARGE_EFFECT'
  | 'DOSE_RESPONSE'
  | 'PLAUSIBLE_CONFOUNDING';

export interface DowngradeFactorDetail {
  factor: DowngradeFactor;
  level: number;
  reason?: string;
}

export interface UpgradeFactorDetail {
  factor: UpgradeFactor;
  level: number;
  reason?: string;
}

export interface ItemMetadata {
  id?: string;
  title: string;
  authors: Author[];
  evidenceType: EvidenceType;
  abstract?: string;
  publicationYear?: number;
  publisher?: string;
  isbn?: string;
  doi?: string;
  url?: string;
  tags: string[];
  notes?: string;
  collections: string[]; // Collection IDs this item belongs to
  dateAdded: Date;
  dateModified: Date;
  language?: string;
  markdownContent?: string; // Converted markdown content from PDF
  markdownUpdatedDate?: Date; // When the markdown was last updated
  archives: ItemArchive[];
}

export interface Collection {
  id?: string;
  name: string;
  description?: string;
  parentCollectionId?: string; // For nested collections
  dateAdded: Date;
  dateModified: Date;
}

export interface Citation {
  id: string;
  itemId: string;
  citationStyle: string; // APA, MLA, Chicago, etc.
  citationText: string;
  dateGenerated: Date;
}

export interface SearchFilter {
  query?: string;
  tags?: string[];
  collections?: string[];
  authors?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  fileType?: string[];
}
