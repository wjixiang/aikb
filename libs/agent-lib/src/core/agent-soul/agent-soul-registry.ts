import { AgentSoulConfig } from '../agent/AgentFactory';

export interface AgentSoulMetadata {
  token: string;
  name: string;
  type: string;
  description: string;
  factory: () => AgentSoulConfig;
}

export const agentSoulRegistry: Map<string, AgentSoulMetadata> = new Map();

export function registerAgentSoul(metadata: AgentSoulMetadata): void {
  agentSoulRegistry.set(metadata.token, metadata);
}

export function getAgentSoul(token: string): AgentSoulMetadata | undefined {
  return agentSoulRegistry.get(token);
}

export function getAllAgentSouls(): AgentSoulMetadata[] {
  return Array.from(agentSoulRegistry.values());
}

export function createAgentSoulByToken(token: string): AgentSoulConfig {
  const metadata = agentSoulRegistry.get(token);
  if (!metadata) {
    const available = Array.from(agentSoulRegistry.keys()).join(', ');
    throw new Error(
      `Unknown agent soul token: "${token}". Available: ${available}`,
    );
  }
  return metadata.factory();
}

import { createEpidemiologyAgentSoul } from './epidemiology/index.js';
import { createPathophysiologyAgentSoul } from './pathophysiology/index.js';
import { createDiagnosisAgentSoul } from './diagnosis/index.js';
import { createManagementAgentSoul } from './management/index.js';
import { createQualityOfLifeAgentSoul } from './quality-of-life/index.js';
import { createEmergingTreatmentsAgentSoul } from './emerging-treatments/index.js';
import { createCoordinatorAgentSoul } from './coordinator/index.js';
import { createBibRetrieveAgentSoul } from './article-retrieve/index.js';

registerAgentSoul({
  token: 'epidemiology',
  name: 'Epidemiology & Risk Factors Agent',
  type: 'article-retrieve-epidemiology',
  description:
    '流行病学与危险因素文献检索专家，负责发病率、患病率、危险因素等文献的检索与筛选',
  factory: createEpidemiologyAgentSoul,
});

registerAgentSoul({
  token: 'pathophysiology',
  name: 'Pathophysiology Agent',
  type: 'article-retrieve-pathophysiology',
  description:
    '病理生理学文献检索专家，负责疾病机制、病理生理过程等文献的检索与筛选',
  factory: createPathophysiologyAgentSoul,
});

registerAgentSoul({
  token: 'diagnosis',
  name: 'Diagnosis Agent',
  type: 'article-retrieve-diagnosis',
  description: '诊断学文献检索专家，负责诊断标准、诊断方法等文献的检索与筛选',
  factory: createDiagnosisAgentSoul,
});

registerAgentSoul({
  token: 'management',
  name: 'Management Agent',
  type: 'article-retrieve-management',
  description:
    '治疗与管理文献检索专家，负责治疗方案、管理策略等文献的检索与筛选',
  factory: createManagementAgentSoul,
});

registerAgentSoul({
  token: 'quality-of-life',
  name: 'Quality of Life Agent',
  type: 'article-retrieve-quality-of-life',
  description:
    '生活质量文献检索专家，负责患者生活质量、心理健康等文献的检索与筛选',
  factory: createQualityOfLifeAgentSoul,
});

registerAgentSoul({
  token: 'emerging-treatments',
  name: 'Emerging Treatments Agent',
  type: 'article-retrieve-emerging-treatments',
  description: '新兴治疗方法文献检索专家，负责新疗法、新技术等文献的检索与筛选',
  factory: createEmergingTreatmentsAgentSoul,
});

registerAgentSoul({
  token: 'coordinator',
  name: 'Coordinator Agent',
  type: 'coordinator',
  description: '协调者Agent，负责协调多个Agent之间的工作',
  factory: createCoordinatorAgentSoul,
});

registerAgentSoul({
  token: 'bib-retrieve',
  name: 'Bibliography Retrieve Agent',
  type: 'bib-retrieve',
  description: '综合文献检索Agent，支持关键词、语义和混合检索',
  factory: createBibRetrieveAgentSoul,
});
