/**
 * Bibliography Search Module
 *
 * This module provides components, tools, and schemas for bibliography search functionality.
 */

export { BibliographySearchComponent } from './bibliographySearch/bibliographySearchComponent.js'

export {
    searchPubmedTool,
    viewArticleTool,
    navigatePageTool,
    clearResultsTool,
    createBibliographySearchToolSet,
    bibliographySearchTools
} from './bibliographySearch/bibliographySearchTools.js'

export {
    retrievalStrategySchema,
    searchPubmedParamsSchema,
    viewArticleParamsSchema,
    navigatePageParamsSchema,
    clearResultsParamsSchema
} from './bibliographySearch/bibliographySearchSchemas.js'

/**
 * PICOS Clinical Question Builder Module
 *
 * This module provides components, tools, and schemas for building clinical questions
 * using the PICOS framework (Patient, Intervention, Comparison, Outcome, Study Design).
 */

export { PicosComponent } from './PICOS/picosComponents.js'

export {
    setPicosElementTool,
    generateClinicalQuestionTool,
    validatePicosTool,
    clearPicosTool,
    exportPicosTool,
    createPicosToolSet,
    picosTools
} from './PICOS/picosTools.js'

export {
    patientSchema,
    interventionSchema,
    comparisonSchema,
    outcomeSchema,
    studyDesignSchema,
    picosSchema,
    setPicosElementParamsSchema,
    generateClinicalQuestionParamsSchema,
    clearPicosParamsSchema,
    validatePicosParamsSchema,
    exportPicosParamsSchema
} from './PICOS/picosSchemas.js'

export type {
    Patient,
    Intervention,
    Comparison,
    Outcome,
    StudyDesign,
    PICOS
} from './PICOS/picosSchemas.js'
