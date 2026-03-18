/**
 * Agent Lib Components Module
 *
 * This module provides the core component infrastructure:
 * - ToolComponent base class
 * - TUI rendering primitives
 * - Component Registry
 * - Utility functions
 *
 * Also includes built-in components:
 * - Mail: Email-style messaging for agent communication
 * - BibliographySearch: PubMed literature search
 * - PICOS: PICO framework extraction for evidence-based medicine
 * - PRISMA: PRISMA checklist and flow diagram
 * - PaperAnalysis: Scientific paper analysis
 * - Bookshelf: Document viewing
 * - KnowledgeManagement: Knowledge base management
 */

// UI Components
export * from './ui/index.js';

/**
 * Utils Module
 *
 * This module provides utility functions for tool rendering.
 */
export * from './utils/index.js';

/**
 * Component Registry Module
 *
 * This module provides the ComponentRegistry for managing ToolComponent registration.
 */
export { ComponentRegistry } from './ComponentRegistry.js';
export type { ComponentRegistration } from './ComponentRegistry.js';

/**
 * Core Module
 *
 * This module provides the core types and ToolComponent base class.
 */
export * from './core/index.js';

// ==================== Mail Component ====================

/**
 * Mail Module
 *
 * Email-style messaging for agent communication.
 * Allows agents to send/receive emails via the agent-mailbox service.
 */
export {
  MailComponent,
  createMailComponent,
  type MailComponentConfig,
  type MailComponentState,
  type DraftData,
  type DraftUpdate,
  type DraftResult,
  type DraftsResult,
} from './mail/mailComponent.js';

export {
  mailToolSchemas,
  sendMailParamsSchema,
  getInboxParamsSchema,
  getUnreadCountParamsSchema,
  messageIdParamsSchema,
  searchMessagesParamsSchema,
  replyToMessageParamsSchema,
  registerAddressParamsSchema,
  saveDraftParamsSchema,
  editDraftParamsSchema,
  getDraftsParamsSchema,
  deleteDraftParamsSchema,
  insertDraftContentParamsSchema,
  replaceDraftContentParamsSchema,
} from './mail/mailSchemas.js';

export type {
  SendMailParams,
  GetInboxParams,
  GetUnreadCountParams,
  MessageIdParams,
  SearchMessagesParams,
  ReplyToMessageParams,
  RegisterAddressParams,
  SaveDraftParams,
  EditDraftParams,
  GetDraftsParams,
  DeleteDraftParams,
  InsertDraftContentParams,
  ReplaceDraftContentParams,
  MailToolParams,
  MailToolName,
  MailToolReturnTypes,
  ToolReturnType,
} from './mail/mailSchemas.js';

// ==================== Bibliography Search Component ====================

/**
 * Bibliography Search Module
 *
 * PubMed literature search component.
 */
export { BibliographySearchComponent } from './bibliographySearch/bibliographySearchComponent.js';

export {
  searchPubmedTool,
  viewArticleTool,
  navigatePageTool,
  clearResultsTool,
  createBibliographySearchToolSet,
  bibliographySearchTools,
} from './bibliographySearch/bibliographySearchTools.js';

export {
  retrievalStrategySchema,
  searchPubmedParamsSchema,
  viewArticleParamsSchema,
  navigatePageParamsSchema,
  clearResultsParamsSchema,
} from './bibliographySearch/bibliographySearchSchemas.js';

// ==================== PICOS Component ====================

/**
 * PICOS Module
 *
 * PICO framework extraction for evidence-based medicine.
 */
export { PicosComponent } from './PICOS/picosComponents.js';

export {
  setPicosElementTool,
  generateClinicalQuestionTool,
  validatePicosTool,
  clearPicosTool,
  exportPicosTool,
  createPicosToolSet,
  picosTools,
} from './PICOS/picosTools.js';

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
  exportPicosParamsSchema,
} from './PICOS/picosSchemas.js';

export type {
  Patient,
  Intervention,
  Comparison,
  Outcome,
  StudyDesign,
  PICOS,
} from './PICOS/picosSchemas.js';

// ==================== PRISMA Components ====================

/**
 * PRISMA Checklist Module
 *
 * PRISMA checklist component for systematic reviews.
 */
export { PrismaCheckListComponent } from './PRISMA/prismaCheckListComponent.js';

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
  prismaTools,
} from './PRISMA/prismaTools.js';

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
  setManuscriptMetadataParamsSchema,
} from './PRISMA/prismaSchemas.js';

export type {
  PrismaChecklistItem,
  PrismaChecklist,
} from './PRISMA/prismaSchemas.js';

/**
 * PRISMA Flow Diagram Module
 *
 * PRISMA flow diagram component for systematic reviews.
 */
export { PrismaFlowComponent } from './PRISMA/prismaFlowComponent.js';

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
  prismaFlowTools,
} from './PRISMA/prismaFlowTools.js';

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
  autoCalculateParamsSchema,
} from './PRISMA/prismaFlowSchemas.js';

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
  PrismaFlowDiagram,
} from './PRISMA/prismaFlowSchemas.js';

// ==================== Paper Analysis Component ====================

/**
 * Paper Analysis Module
 *
 * Scientific paper analysis component.
 */
export { PaperAnalysisComponent } from './paperAnalysis/paperAnalysisComponent.js';

// ==================== Bookshelf Components ====================

/**
 * Bookshelf Module
 *
 * Document viewing components.
 */
export { BookViewerComponent, WorkspaceInfoComponent } from './bookshelfComponents.js';

// ==================== Knowledge Management Component ====================

/**
 * Knowledge Management Module
 *
 * Knowledge base management component.
 */
export { KnowledgeManageComponent } from './knowledgeManageComponent.js';

// Test Components - Re-export for convenience in tests
// Located in: core/statefulContext/__tests__/testComponents.ts
export { TestComponent, TestComponent2, AnotherComponent } from '../core/statefulContext/__tests__/testComponents.js';
export { TestToolComponentA, TestToolComponentB, TestToolComponentC } from '../core/statefulContext/__tests__/testComponents.js';
