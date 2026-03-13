import * as z from 'zod'

/**
 * Schema for exclusion reason
 * Represents a reason for excluding studies with count
 */
export const exclusionReasonSchema = z.object({
    reason: z.string().describe('Description of the exclusion reason'),
    count: z.number().int().min(0).default(0).describe('Number of studies excluded for this reason')
});

/**
 * Schema for identification sources
 * Records identified from various sources
 */
export const identificationSourcesSchema = z.object({
    databases: z.number().int().min(0).default(0).describe('Records identified from databases'),
    registers: z.number().int().min(0).default(0).describe('Records identified from registers'),
    websites: z.number().int().min(0).default(0).describe('Records identified from websites'),
    organisations: z.number().int().min(0).default(0).describe('Records identified from organisations'),
    citationSearching: z.number().int().min(0).default(0).describe('Records identified from citation searching'),
    other: z.number().int().min(0).default(0).describe('Records identified from other methods')
});

/**
 * Schema for records removed before screening
 */
export const recordsRemovedSchema = z.object({
    duplicates: z.number().int().min(0).default(0).describe('Duplicate records removed'),
    automationTools: z.number().int().min(0).default(0).describe('Records marked as ineligible by automation tools'),
    otherReasons: z.number().int().min(0).default(0).describe('Records removed for other reasons')
});

/**
 * Schema for screening phase
 */
export const screeningPhaseSchema = z.object({
    recordsScreened: z.number().int().min(0).default(0).describe('Records screened'),
    recordsExcluded: z.number().int().min(0).default(0).describe('Records excluded during screening'),
    exclusionReasons: z.array(exclusionReasonSchema).default([]).describe('Reasons for exclusion during screening')
});

/**
 * Schema for retrieval phase
 */
export const retrievalPhaseSchema = z.object({
    reportsSought: z.number().int().min(0).default(0).describe('Reports sought for retrieval'),
    reportsNotRetrieved: z.number().int().min(0).default(0).describe('Reports not retrieved')
});

/**
 * Schema for assessment phase
 */
export const assessmentPhaseSchema = z.object({
    reportsAssessed: z.number().int().min(0).default(0).describe('Reports assessed for eligibility'),
    reportsExcluded: z.number().int().min(0).default(0).describe('Reports excluded during assessment'),
    exclusionReasons: z.array(exclusionReasonSchema).default([]).describe('Reasons for exclusion during assessment')
});

/**
 * Schema for included studies
 */
export const includedStudiesSchema = z.object({
    studiesIncluded: z.number().int().min(0).default(0).describe('Studies included in review'),
    reportsIncluded: z.number().int().min(0).default(0).describe('Reports of included studies')
});

/**
 * Schema for database flow (left side of diagram)
 */
export const databaseFlowSchema = z.object({
    identification: z.object({
        databases: z.number().int().min(0).optional(),
        registers: z.number().int().min(0).optional()
    }).optional().describe('Records identified from databases and registers'),
    recordsRemoved: z.object({
        duplicates: z.number().int().min(0).optional(),
        automationTools: z.number().int().min(0).optional(),
        otherReasons: z.number().int().min(0).optional()
    }).optional().describe('Records removed before screening'),
    screening: z.object({
        recordsScreened: z.number().int().min(0).optional(),
        recordsExcluded: z.number().int().min(0).optional(),
        exclusionReasons: z.array(exclusionReasonSchema).optional()
    }).optional().describe('Screening phase'),
    retrieval: z.object({
        reportsSought: z.number().int().min(0).optional(),
        reportsNotRetrieved: z.number().int().min(0).optional()
    }).optional().describe('Retrieval phase'),
    assessment: z.object({
        reportsAssessed: z.number().int().min(0).optional(),
        reportsExcluded: z.number().int().min(0).optional(),
        exclusionReasons: z.array(exclusionReasonSchema).optional()
    }).optional().describe('Assessment phase')
});

/**
 * Schema for other methods flow (right side of diagram)
 */
export const otherMethodsFlowSchema = z.object({
    identification: z.object({
        websites: z.number().int().min(0).optional(),
        organisations: z.number().int().min(0).optional(),
        citationSearching: z.number().int().min(0).optional(),
        other: z.number().int().min(0).optional()
    }).optional().describe('Records identified from other methods'),
    retrieval: z.object({
        reportsSought: z.number().int().min(0).optional(),
        reportsNotRetrieved: z.number().int().min(0).optional()
    }).optional().describe('Retrieval phase'),
    assessment: z.object({
        reportsAssessed: z.number().int().min(0).optional(),
        reportsExcluded: z.number().int().min(0).optional(),
        exclusionReasons: z.array(exclusionReasonSchema).optional()
    }).optional().describe('Assessment phase')
});

/**
 * Complete PRISMA Flow Diagram Schema
 * Contains all data for the PRISMA 2020 flow diagram
 */
export const prismaFlowDiagramSchema = z.object({
    databaseFlow: databaseFlowSchema.optional().describe('Database and registers flow (left side)'),
    otherMethodsFlow: otherMethodsFlowSchema.optional().describe('Other methods flow (right side)'),
    included: z.object({
        studiesIncluded: z.number().int().min(0).optional(),
        reportsIncluded: z.number().int().min(0).optional()
    }).optional().describe('Included studies (converged from both flows)')
});

/**
 * Schema for setting identification numbers
 */
export const setIdentificationParamsSchema = z.object({
    flow: z.enum(['database', 'other']).describe('Which flow to update (database or other methods)'),
    databases: z.number().int().min(0).optional(),
    registers: z.number().int().min(0).optional(),
    websites: z.number().int().min(0).optional(),
    organisations: z.number().int().min(0).optional(),
    citationSearching: z.number().int().min(0).optional(),
    other: z.number().int().min(0).optional()
});

/**
 * Schema for setting records removed
 */
export const setRecordsRemovedParamsSchema = z.object({
    duplicates: z.number().int().min(0).optional(),
    automationTools: z.number().int().min(0).optional(),
    otherReasons: z.number().int().min(0).optional()
});

/**
 * Schema for setting screening phase data
 */
export const setScreeningParamsSchema = z.object({
    recordsScreened: z.number().int().min(0).optional(),
    recordsExcluded: z.number().int().min(0).optional(),
    exclusionReasons: z.array(exclusionReasonSchema).optional()
});

/**
 * Schema for setting retrieval phase data
 */
export const setRetrievalParamsSchema = z.object({
    flow: z.enum(['database', 'other']).describe('Which flow to update'),
    reportsSought: z.number().int().min(0).optional(),
    reportsNotRetrieved: z.number().int().min(0).optional()
});

/**
 * Schema for setting assessment phase data
 */
export const setAssessmentParamsSchema = z.object({
    flow: z.enum(['database', 'other']).describe('Which flow to update'),
    reportsAssessed: z.number().int().min(0).optional(),
    reportsExcluded: z.number().int().min(0).optional(),
    exclusionReasons: z.array(exclusionReasonSchema).optional()
});

/**
 * Schema for setting included studies
 */
export const setIncludedParamsSchema = z.object({
    studiesIncluded: z.number().int().min(0).optional(),
    reportsIncluded: z.number().int().min(0).optional()
});

/**
 * Schema for adding exclusion reason
 */
export const addExclusionReasonParamsSchema = z.object({
    phase: z.enum(['screening', 'assessment']).describe('Which phase to add the reason to'),
    flow: z.enum(['database', 'other']).describe('Which flow to update (not used for screening)'),
    reason: z.string().describe('Description of the exclusion reason'),
    count: z.number().int().min(0).default(1).describe('Number of studies excluded for this reason')
});

/**
 * Schema for exporting flow diagram
 */
export const exportFlowDiagramParamsSchema = z.object({
    format: z.enum(['json', 'markdown', 'mermaid']).optional().default('markdown').describe('Export format')
});

/**
 * Schema for clearing flow diagram
 */
export const clearFlowDiagramParamsSchema = z.object({
    confirm: z.boolean().describe('Must be true to confirm clearing the flow diagram')
});

/**
 * Schema for validating flow diagram
 */
export const validateFlowDiagramParamsSchema = z.object({});

/**
 * Schema for auto-calculating derived values
 */
export const autoCalculateParamsSchema = z.object({
    flow: z.enum(['database', 'other', 'both']).optional().default('both').describe('Which flow to calculate')
});

// Type exports
export type ExclusionReason = z.infer<typeof exclusionReasonSchema>;
export type IdentificationSources = z.infer<typeof identificationSourcesSchema>;
export type RecordsRemoved = z.infer<typeof recordsRemovedSchema>;
export type ScreeningPhase = z.infer<typeof screeningPhaseSchema>;
export type RetrievalPhase = z.infer<typeof retrievalPhaseSchema>;
export type AssessmentPhase = z.infer<typeof assessmentPhaseSchema>;
export type IncludedStudies = z.infer<typeof includedStudiesSchema>;
export type DatabaseFlow = z.infer<typeof databaseFlowSchema>;
export type OtherMethodsFlow = z.infer<typeof otherMethodsFlowSchema>;
export type PrismaFlowDiagram = z.infer<typeof prismaFlowDiagramSchema>;
