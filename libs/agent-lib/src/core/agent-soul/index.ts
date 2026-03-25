// 综合检索 Agent（保留原有）
export { createBibRetrieveAgentSoul } from './article-retrieve/index.js';

// 协调者 Agent
export { createCoordinatorAgentSoul } from './coordinator/index.js';

// 独立模块 Agents
export {
  createEpidemiologyAgentSoul,
  createAgentSoul as createEpidemiologyAgentSoulAlias,
} from './epidemiology/index.js';
export {
  createPathophysiologyAgentSoul,
  createAgentSoul as createPathophysiologyAgentSoulAlias,
} from './pathophysiology/index.js';
export {
  createDiagnosisAgentSoul,
  createAgentSoul as createDiagnosisAgentSoulAlias,
} from './diagnosis/index.js';
export {
  createManagementAgentSoul,
  createAgentSoul as createManagementAgentSoulAlias,
} from './management/index.js';
export {
  createQualityOfLifeAgentSoul,
  createAgentSoul as createQualityOfLifeAgentSoulAlias,
} from './quality-of-life/index.js';
export {
  createEmergingTreatmentsAgentSoul,
  createAgentSoul as createEmergingTreatmentsAgentSoulAlias,
} from './emerging-treatments/index.js';

// 工厂函数：根据模块名创建对应的 Agent Soul
import { createEpidemiologyAgentSoul } from './epidemiology/index.js';
import { createPathophysiologyAgentSoul } from './pathophysiology/index.js';
import { createDiagnosisAgentSoul } from './diagnosis/index.js';
import { createManagementAgentSoul } from './management/index.js';
import { createQualityOfLifeAgentSoul } from './quality-of-life/index.js';
import { createEmergingTreatmentsAgentSoul } from './emerging-treatments/index.js';
import { createCoordinatorAgentSoul } from './coordinator/index.js';
import { AgentSoulConfig } from '../agent/AgentFactory';

export type AgentSoulType =
  | 'epidemiology'
  | 'pathophysiology'
  | 'diagnosis'
  | 'management'
  | 'quality-of-life'
  | 'emerging-treatments';

const agentSoulFactories: Record<AgentSoulType, () => AgentSoulConfig> = {
  epidemiology: createEpidemiologyAgentSoul,
  pathophysiology: createPathophysiologyAgentSoul,
  diagnosis: createDiagnosisAgentSoul,
  management: createManagementAgentSoul,
  'quality-of-life': createQualityOfLifeAgentSoul,
  'emerging-treatments': createEmergingTreatmentsAgentSoul,
};

/**
 * 根据类型创建对应的 Agent Soul
 */
export function createAgentSoulByType(type: AgentSoulType): AgentSoulConfig {
  const factory = agentSoulFactories[type];
  if (!factory) {
    throw new Error(`Unknown agent soul type: ${type}`);
  }
  return factory();
}

/**
 * 获取所有可用的 Agent Soul 类型
 */
export function getAvailableAgentSoulTypes(): AgentSoulType[] {
  return Object.keys(agentSoulFactories) as AgentSoulType[];
}
