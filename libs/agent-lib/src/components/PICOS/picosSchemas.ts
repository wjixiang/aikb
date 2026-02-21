import * as z from 'zod'

/**
 * Schema for Patient/Problem element
 * Describes the patient population or problem being studied
 */
export const patientSchema = z.object({
    description: z.string().describe('Description of the patient population or problem'),
    ageGroup: z.string().optional().describe('Age group (e.g., "65 and older", "adults", "pediatric")'),
    gender: z.string().optional().describe('Gender (e.g., "male", "female", "both")'),
    condition: z.string().optional().describe('Specific condition or disease'),
    characteristics: z.array(z.string()).optional().describe('Additional patient characteristics')
});

/**
 * Schema for Intervention element
 * Describes the treatment, exposure, or intervention being studied
 */
export const interventionSchema = z.object({
    description: z.string().describe('Description of the intervention or exposure'),
    type: z.string().optional().describe('Type of intervention (e.g., "drug", "therapy", "education", "surgery")'),
    details: z.string().optional().describe('Specific details about the intervention'),
    dosage: z.string().optional().describe('Dosage or intensity if applicable'),
    frequency: z.string().optional().describe('Frequency or duration of intervention')
});

/**
 * Schema for Comparison element
 * Describes the alternative to the intervention being compared against
 */
export const comparisonSchema = z.object({
    description: z.string().describe('Description of the comparison group'),
    type: z.string().optional().describe('Type of comparison (e.g., "placebo", "standard care", "no intervention", "alternative treatment")'),
    details: z.string().optional().describe('Specific details about the comparison')
});

/**
 * Schema for Outcome element
 * Describes the measured outcomes of interest
 */
export const outcomeSchema = z.object({
    description: z.string().describe('Description of the outcome being measured'),
    type: z.string().optional().describe('Type of outcome (e.g., "primary", "secondary", "safety")'),
    measurement: z.string().optional().describe('How the outcome is measured'),
    timeFrame: z.string().optional().describe('Time frame for measurement (e.g., "6 months", "1 year")')
});

/**
 * Schema for Study Design element (the "S" in PICOS)
 * Describes the type of study design
 */
export const studyDesignSchema = z.object({
    description: z.string().describe('Description of the study design'),
    type: z.string().optional().describe('Type of study design (e.g., "RCT", "cohort", "case-control", "systematic review", "meta-analysis")'),
    phase: z.string().optional().describe('Phase for clinical trials (e.g., "Phase II", "Phase III")'),
    setting: z.string().optional().describe('Study setting (e.g., "hospital", "outpatient", "community")')
});

/**
 * Complete PICOS schema
 * Combines all elements for a complete clinical question formulation
 */
export const picosSchema = z.object({
    patient: patientSchema.optional().describe('Patient or Problem'),
    intervention: interventionSchema.optional().describe('Intervention'),
    comparison: comparisonSchema.optional().describe('Comparison'),
    outcome: outcomeSchema.optional().describe('Outcome'),
    studyDesign: studyDesignSchema.optional().describe('Study Design')
});

/**
 * Schema for set_picos_element tool
 * Sets or updates a specific PICOS element
 */
export const setPicosElementParamsSchema = z.object({
    element: z.enum(['patient', 'intervention', 'comparison', 'outcome', 'studyDesign']).describe('The PICOS element to set'),
    data: z.union([patientSchema, interventionSchema, comparisonSchema, outcomeSchema, studyDesignSchema]).describe('Data for the element')
});

/**
 * Schema for generate_clinical_question tool
 * Generates a clinical question based on current PICOS elements
 */
export const generateClinicalQuestionParamsSchema = z.object({
    format: z.enum(['question', 'structured', 'both']).optional().default('both').describe('Output format: question (natural language), structured (PICOS format), or both')
});

/**
 * Schema for clear_picos tool
 * Clears all PICOS elements
 */
export const clearPicosParamsSchema = z.object({});

/**
 * Schema for validate_picos tool
 * Validates the current PICOS formulation
 */
export const validatePicosParamsSchema = z.object({});

/**
 * Schema for export_picos tool
 * Exports PICOS data in various formats
 */
export const exportPicosParamsSchema = z.object({
    format: z.enum(['json', 'markdown', 'search']).optional().default('markdown').describe('Export format: json, markdown, or search (for literature search)')
});

// Type exports
export type Patient = z.infer<typeof patientSchema>;
export type Intervention = z.infer<typeof interventionSchema>;
export type Comparison = z.infer<typeof comparisonSchema>;
export type Outcome = z.infer<typeof outcomeSchema>;
export type StudyDesign = z.infer<typeof studyDesignSchema>;
export type PICOS = z.infer<typeof picosSchema>;
