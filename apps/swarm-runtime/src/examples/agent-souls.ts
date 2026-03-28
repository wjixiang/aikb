/**
 * Agent Soul Examples for Swarm Application
 *
 * 示例 Agent 配置，用于通过 API 创建 Agent
 */

import type { AgentBlueprint } from 'agent-lib/core';
import type { DIComponentRegistration } from 'agent-lib/core';

/**
 * 流行病学文献检索 Agent
 */
export const epidemiologyAgentExample: AgentBlueprint = {
  agent: {
    name: 'Epidemiology Search',
    type: 'epidemiology',
    description: '搜索流行病学与危险因素相关文献',
    sop: `你是医学文献检索专家，专注于流行病学和危险因素研究。

**任务**：
- 根据用户查询检索相关文献
- 从 PubMed 等数据库获取摘要信息
- 提供文献计量学分析

**可用工具**：
- bibliographySearch: 文献搜索
- getInbox: 查看待处理任务
- acknowledgeTask: 确认任务
- completeTask: 完成任务`,
  },
  components: [],
};

/**
 * 诊断文献检索 Agent
 */
export const diagnosisAgentExample: AgentBlueprint = {
  agent: {
    name: 'Diagnosis Search',
    type: 'diagnosis',
    description: '搜索诊断、筛查与预防相关文献',
    sop: `你是医学文献检索专家，专注于诊断、筛查和预防研究。

**任务**：
- 检索诊断相关的文献
- 分析诊断准确性研究
- 提供筛查建议`,
  },
  components: [],
};

/**
 * 治疗管理 Agent
 */
export const managementAgentExample: AgentBlueprint = {
  agent: {
    name: 'Management Search',
    type: 'management',
    description: '搜索疾病管理与治疗相关文献',
    sop: `你是医学文献检索专家，专注于疾病管理和治疗研究。

**任务**：
- 检索治疗方案的文献
- 分析药物临床试验
- 提供临床指南建议`,
  },
  components: [],
};

/**
 * 协调 Agent
 */
export const routerAgentExample: AgentBlueprint = {
  agent: {
    name: 'Literature Router',
    type: 'router',
    description: '协调多个检索 Agent 完成复杂文献综述任务',
    sop: `你是文献综述协调专家，负责协调多个专业 Agent 完成复杂任务。

**任务**：
- 分析用户需求，分解为子任务
- 协调专业检索 Agent
- 汇总各 Agent 结果
- 生成综合综述报告

**A2A 能力**：
- 可以创建子 Agent
- 可以向其他 Agent 发送任务
- 可以聚合多个 Agent 的结果`,
  },
  components: [],
};

/**
 * 通用检索 Agent
 */
export const generalAgentExample: AgentBlueprint = {
  agent: {
    name: 'General Research',
    type: 'bib-retrieve',
    description: '通用文献检索 Agent',
    sop: `你是医学文献检索专家，可以帮助用户检索和分析医学文献。

**任务**：
- 理解用户的文献需求
- 制定检索策略
- 执行文献检索
- 分析和总结结果`,
  },
  components: [],
};

// Export all examples as a map
export const agentExamples = {
  epidemiology: epidemiologyAgentExample,
  diagnosis: diagnosisAgentExample,
  management: managementAgentExample,
  router: routerAgentExample,
  general: generalAgentExample,
} as const;

export type AgentExampleType = keyof typeof agentExamples;
