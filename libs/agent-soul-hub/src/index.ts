/**
 * Agent Soul Hub
 *
 * Concrete agent soul implementations and factory functions.
 * This package provides the implementations for all agent souls.
 */

// Re-export types from agent-lib
export type { AgentBlueprint, AgentSoulType } from 'agent-lib/core';
export type {
  LineageSchema,
  LineageNodeDef,
  LineageRole,
  AgentLineageInfo,
} from 'agent-lib/core';
export { lineageSchemaRegistry, registerLineageSchema } from 'agent-lib/core';

// Concrete agent factory functions
export { createBibRetrieveAgentSoul } from './article-retrieve/index.js';
export { createChiefCoordinatorAgentSoul } from './chief-coordinator/index.js';
export { createCoordinatorAgentSoul } from './coordinator/index.js';
export { createEpidemiologyAgentSoul } from './epidemiology/index.js';
export { createPathophysiologyAgentSoul } from './pathophysiology/index.js';
export { createDiagnosisAgentSoul } from './diagnosis/index.js';
export { createManagementAgentSoul } from './management/index.js';
export { createQualityOfLifeAgentSoul } from './quality-of-life/index.js';
export { createEmergingTreatmentsAgentSoul } from './emerging-treatments/index.js';
export { createWebSearchAgentSoul } from './web-search/index.js';

// Registry and token-based factory (legacy support)
export {
  agentSoulRegistry,
  registerAgentSoul,
  getAgentSoul,
  getAllAgentSouls,
  createAgentSoulByToken,
  type AgentSoulMetadata,
} from './agent-soul-registry.js';

// Lineage definitions (auto-registers schemas on import)
export { literatureSurveyLineage } from './lineage/index.js';
