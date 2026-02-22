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

/**
 * PRISMA 2020 Checklist Module
 *
 * This module provides components, tools, and schemas for managing the PRISMA 2020 checklist
 * for systematic reviews and meta-analyses.
 */

export { PrismaCheckListComponent } from './PRISMA/prismaCheckListComponent.js'

export {
    setChecklistItemTool,
    setMultipleItemsTool,
    filterChecklistTool,
    exportChecklistTool,
    validateChecklistTool,
    clearChecklistTool,
    getProgressTool,
    setManuscriptMetadataTool,
    createPrismaToolSet,
    prismaTools
} from './PRISMA/prismaTools.js'

export {
    prismaChecklistItemSchema,
    prismaChecklistSchema,
    setChecklistItemParamsSchema,
    setMultipleItemsParamsSchema,
    filterChecklistParamsSchema,
    exportChecklistParamsSchema,
    validateChecklistParamsSchema,
    clearChecklistParamsSchema,
    getProgressParamsSchema,
    setManuscriptMetadataParamsSchema
} from './PRISMA/prismaSchemas.js'

export type {
    PrismaChecklistItem,
    PrismaChecklist
} from './PRISMA/prismaSchemas.js'

/**
 * PRISMA 2020 Flow Diagram Module
 *
 * This module provides components, tools, and schemas for managing the PRISMA 2020 flow diagram
 * for systematic reviews and meta-analyses.
 */

export { PrismaFlowComponent } from './PRISMA/prismaFlowComponent.js'

export {
    setIdentificationTool,
    setRecordsRemovedTool,
    setScreeningTool,
    setRetrievalTool,
    setAssessmentTool,
    setIncludedTool,
    addExclusionReasonTool,
    exportFlowDiagramTool,
    clearFlowDiagramTool,
    validateFlowDiagramTool,
    autoCalculateTool,
    createPrismaFlowToolSet,
    prismaFlowTools
} from './PRISMA/prismaFlowTools.js'

export {
    exclusionReasonSchema,
    identificationSourcesSchema,
    recordsRemovedSchema,
    screeningPhaseSchema,
    retrievalPhaseSchema,
    assessmentPhaseSchema,
    includedStudiesSchema,
    databaseFlowSchema,
    otherMethodsFlowSchema,
    prismaFlowDiagramSchema,
    setIdentificationParamsSchema,
    setRecordsRemovedParamsSchema,
    setScreeningParamsSchema,
    setRetrievalParamsSchema,
    setAssessmentParamsSchema,
    setIncludedParamsSchema,
    addExclusionReasonParamsSchema,
    exportFlowDiagramParamsSchema,
    clearFlowDiagramParamsSchema,
    validateFlowDiagramParamsSchema,
    autoCalculateParamsSchema
} from './PRISMA/prismaFlowSchemas.js'

export type {
    ExclusionReason,
    IdentificationSources,
    RecordsRemoved,
    ScreeningPhase,
    RetrievalPhase,
    AssessmentPhase,
    IncludedStudies,
    DatabaseFlow,
    OtherMethodsFlow,
    PrismaFlowDiagram
} from './PRISMA/prismaFlowSchemas.js'
