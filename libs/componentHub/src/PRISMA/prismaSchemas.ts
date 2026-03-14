import * as z from 'zod'

/**
 * PRISMA 2020 Checklist Item Schema
 * Represents a single checklist item with its status and location
 */
export const prismaChecklistItemSchema = z.object({
    itemNumber: z.number().describe('Item number from the PRISMA 2020 checklist'),
    section: z.string().describe('Section of the checklist (e.g., TITLE, ABSTRACT, INTRODUCTION)'),
    topic: z.string().describe('Topic within the section'),
    checklistItem: z.string().describe('The checklist item description'),
    status: z.enum(['not_started', 'in_progress', 'completed', 'not_applicable']).default('not_started').describe('Completion status of the item'),
    location: z.string().optional().describe('Location in the manuscript where this item is reported'),
    notes: z.string().optional().describe('Additional notes about this item')
});

/**
 * Schema for setting a checklist item status
 */
export const setChecklistItemParamsSchema = z.object({
    itemNumber: z.number().describe('Item number from the PRISMA 2020 checklist (1-27)'),
    status: z.enum(['not_started', 'in_progress', 'completed', 'not_applicable']).describe('Completion status'),
    location: z.string().optional().describe('Location in the manuscript where this item is reported'),
    notes: z.string().optional().describe('Additional notes about this item')
});

/**
 * Schema for updating multiple checklist items at once
 */
export const setMultipleItemsParamsSchema = z.object({
    items: z.array(z.object({
        itemNumber: z.number(),
        status: z.enum(['not_started', 'in_progress', 'completed', 'not_applicable']),
        location: z.string().optional(),
        notes: z.string().optional()
    })).describe('Array of items to update')
});

/**
 * Schema for filtering checklist items
 */
export const filterChecklistParamsSchema = z.object({
    section: z.string().optional().describe('Filter by section (e.g., TITLE, ABSTRACT, INTRODUCTION)'),
    status: z.enum(['not_started', 'in_progress', 'completed', 'not_applicable']).optional().describe('Filter by status'),
    topic: z.string().optional().describe('Filter by topic')
});

/**
 * Schema for exporting the checklist
 */
export const exportChecklistParamsSchema = z.object({
    format: z.enum(['json', 'markdown', 'csv']).optional().default('markdown').describe('Export format'),
    includeCompletedOnly: z.boolean().optional().default(false).describe('Only include completed items')
});

/**
 * Schema for validating the checklist
 */
export const validateChecklistParamsSchema = z.object({
    requiredItems: z.array(z.number()).optional().describe('List of required item numbers. If not provided, all items are considered required.')
});

/**
 * Schema for clearing the checklist
 */
export const clearChecklistParamsSchema = z.object({
    confirm: z.boolean().describe('Must be true to confirm clearing the checklist')
});

/**
 * Schema for getting checklist progress
 */
export const getProgressParamsSchema = z.object({});

/**
 * Schema for setting manuscript metadata
 */
export const setManuscriptMetadataParamsSchema = z.object({
    title: z.string().optional().describe('Title of the systematic review'),
    authors: z.array(z.string()).optional().describe('List of authors'),
    registrationNumber: z.string().optional().describe('Registration number (e.g., PROSPERO)'),
    registrationDate: z.string().optional().describe('Registration date'),
    protocolLink: z.string().optional().describe('Link to the protocol')
});

/**
 * Complete PRISMA Checklist Schema
 * Contains all 27 items from the PRISMA 2020 checklist
 */
export const prismaChecklistSchema = z.object({
    metadata: z.object({
        title: z.string().optional(),
        authors: z.array(z.string()).optional(),
        registrationNumber: z.string().optional(),
        registrationDate: z.string().optional(),
        protocolLink: z.string().optional()
    }).optional(),
    items: z.array(prismaChecklistItemSchema).describe('All checklist items')
});

// Type exports
export type PrismaChecklistItem = z.infer<typeof prismaChecklistItemSchema>;
export type PrismaChecklist = z.infer<typeof prismaChecklistSchema>;

/**
 * Default PRISMA 2020 checklist items
 * These are the 27 items from the official PRISMA 2020 checklist
 */
export const DEFAULT_PRISMA_ITEMS: Omit<PrismaChecklistItem, 'status' | 'location' | 'notes'>[] = [
    // TITLE
    { itemNumber: 1, section: 'TITLE', topic: 'Title', checklistItem: 'Identify the report as a systematic review.' },

    // ABSTRACT
    { itemNumber: 2, section: 'ABSTRACT', topic: 'Abstract', checklistItem: 'See the PRISMA 2020 for Abstracts checklist.' },

    // INTRODUCTION
    { itemNumber: 3, section: 'INTRODUCTION', topic: 'Rationale', checklistItem: 'Describe the rationale for the review in the context of existing knowledge.' },
    { itemNumber: 4, section: 'INTRODUCTION', topic: 'Objectives', checklistItem: 'Provide an explicit statement of the objective(s) or question(s) the review addresses.' },

    // METHODS
    { itemNumber: 5, section: 'METHODS', topic: 'Eligibility criteria', checklistItem: 'Specify the inclusion and exclusion criteria for the review and how studies were grouped for the syntheses.' },
    { itemNumber: 6, section: 'METHODS', topic: 'Information sources', checklistItem: 'Specify all databases, registers, websites, organisations, reference lists and other sources searched or consulted to identify studies. Specify the date when each source was last searched or consulted.' },
    { itemNumber: 7, section: 'METHODS', topic: 'Search strategy', checklistItem: 'Present the full search strategies for all databases, registers and websites, including any filters and limits used.' },
    { itemNumber: 8, section: 'METHODS', topic: 'Selection process', checklistItem: 'Specify the methods used to decide whether a study met the inclusion criteria of the review, including how many reviewers screened each record and each report retrieved, whether they worked independently, and if applicable, details of automation tools used in the process.' },
    { itemNumber: 9, section: 'METHODS', topic: 'Data collection process', checklistItem: 'Specify the methods used to collect data from reports, including how many reviewers collected data from each report, whether they worked independently, any processes for obtaining or confirming data from study investigators, and if applicable, details of automation tools used in the process.' },
    { itemNumber: 10, section: 'METHODS', topic: 'Data items', checklistItem: 'List and define all outcomes for which data were sought. Specify whether all results that were compatible with each outcome domain in each study were sought (e.g. for all measures, time points, analyses), and if not, the methods used to decide which results to collect. List and define all other variables for which data were sought (e.g. participant and intervention characteristics, funding sources). Describe any assumptions made about any missing or unclear information.' },
    { itemNumber: 11, section: 'METHODS', topic: 'Study risk of bias assessment', checklistItem: 'Specify the methods used to assess risk of bias in the included studies, including details of the tool(s) used, how many reviewers assessed each study and whether they worked independently, and if applicable, details of automation tools used in the process.' },
    { itemNumber: 12, section: 'METHODS', topic: 'Effect measures', checklistItem: 'Specify for each outcome the effect measure(s) (e.g. risk ratio, mean difference) used in the synthesis or presentation of results.' },
    { itemNumber: 13, section: 'METHODS', topic: 'Synthesis methods', checklistItem: 'Describe the processes used to decide which studies were eligible for each synthesis (e.g. tabulating the study intervention characteristics and comparing against the planned groups for each synthesis (item #5)). Describe any methods required to prepare the data for presentation or synthesis, such as handling of missing summary statistics, or data conversions. Describe any methods used to tabulate or visually display results of individual studies and syntheses. Describe any methods used to synthesize results and provide a rationale for the choice(s). If meta-analysis was performed, describe the model(s), method(s) to identify the presence and extent of statistical heterogeneity, and software package(s) used. Describe any methods used to explore possible causes of heterogeneity among study results (e.g. subgroup analysis, meta-regression). Describe any sensitivity analyses conducted to assess robustness of the synthesized results.' },
    { itemNumber: 14, section: 'METHODS', topic: 'Reporting bias assessment', checklistItem: 'Describe any methods used to assess risk of bias due to missing results in a synthesis (arising from reporting biases).' },
    { itemNumber: 15, section: 'METHODS', topic: 'Certainty assessment', checklistItem: 'Describe any methods used to assess certainty (or confidence) in the body of evidence for an outcome.' },

    // RESULTS
    { itemNumber: 16, section: 'RESULTS', topic: 'Study selection', checklistItem: 'Describe the results of the search and selection process, from the number of records identified in the search to the number of studies included in the review, ideally using a flow diagram. Cite studies that might appear to meet the inclusion criteria, but which were excluded, and explain why they were excluded.' },
    { itemNumber: 17, section: 'RESULTS', topic: 'Study characteristics', checklistItem: 'Cite each included study and present its characteristics.' },
    { itemNumber: 18, section: 'RESULTS', topic: 'Risk of bias in studies', checklistItem: 'Present assessments of risk of bias for each included study.' },
    { itemNumber: 19, section: 'RESULTS', topic: 'Results of individual studies', checklistItem: 'For all outcomes, present, for each study: (a) summary statistics for each group (where appropriate) and (b) an effect estimate and its precision (e.g. confidence/credible interval), ideally using structured tables or plots.' },
    { itemNumber: 20, section: 'RESULTS', topic: 'Results of syntheses', checklistItem: 'For each synthesis, briefly summarise the characteristics and risk of bias among contributing studies. Present results of all statistical syntheses conducted. If meta-analysis was done, present for each the summary estimate and its precision (e.g. confidence/credible interval) and measures of statistical heterogeneity. If comparing groups, describe the direction of the effect. Present results of all investigations of possible causes of heterogeneity among study results. Present results of all sensitivity analyses conducted to assess the robustness of the synthesized results.' },
    { itemNumber: 21, section: 'RESULTS', topic: 'Reporting biases', checklistItem: 'Present assessments of risk of bias due to missing results (arising from reporting biases) for each synthesis assessed.' },
    { itemNumber: 22, section: 'RESULTS', topic: 'Certainty of evidence', checklistItem: 'Present assessments of certainty (or confidence) in the body of evidence for each outcome assessed.' },

    // DISCUSSION
    { itemNumber: 23, section: 'DISCUSSION', topic: 'Discussion', checklistItem: 'Provide a general interpretation of the results in the context of other evidence. Discuss any limitations of the evidence included in the review. Discuss any limitations of the review processes used. Discuss implications of the results for practice, policy, and future research.' },

    // OTHER INFORMATION
    { itemNumber: 24, section: 'OTHER INFORMATION', topic: 'Registration and protocol', checklistItem: 'Provide registration information for the review, including register name and registration number, or state that the review was not registered. Indicate where the review protocol can be accessed, or state that a protocol was not prepared. Describe and explain any amendments to information provided at registration or in the protocol.' },
    { itemNumber: 25, section: 'OTHER INFORMATION', topic: 'Support', checklistItem: 'Describe sources of financial or non-financial support for the review, and the role of the funders or sponsors in the review.' },
    { itemNumber: 26, section: 'OTHER INFORMATION', topic: 'Competing interests', checklistItem: 'Declare any competing interests of review authors.' },
    { itemNumber: 27, section: 'OTHER INFORMATION', topic: 'Availability of data, code and other materials', checklistItem: 'Report which of the following are publicly available and where they can be found: template data collection forms; data extracted from included studies; data used for all analyses; analytic code; any other materials used in the review.' }
];
