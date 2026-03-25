/**
 * AgentSoulRegistry - Registry for all available AgentSoul configurations
 *
 * This registry allows Coordinator agents to discover and instantiate
 * specialized agents for different tasks.
 */

export type AgentSoulType =
  | 'epidemiology'
  | 'pathophysiology'
  | 'diagnosis'
  | 'management'
  | 'quality-of-life'
  | 'emerging-treatments'
  | 'paper-analysis';

export interface AgentSoulEntry {
  type: AgentSoulType;
  name: string;
  description: string;
  capabilities: string[];
}

export interface IAgentSoulRegistry {
  register(entry: AgentSoulEntry): void;
  getAll(): AgentSoulEntry[];
  get(type: AgentSoulType): AgentSoulEntry | undefined;
  getByCapability(capability: string): AgentSoulEntry[];
}

export class AgentSoulRegistry implements IAgentSoulRegistry {
  private entries: Map<AgentSoulType, AgentSoulEntry> = new Map();

  register(entry: AgentSoulEntry): void {
    this.entries.set(entry.type, entry);
  }

  getAll(): AgentSoulEntry[] {
    return Array.from(this.entries.values());
  }

  get(type: AgentSoulType): AgentSoulEntry | undefined {
    return this.entries.get(type);
  }

  getByCapability(capability: string): AgentSoulEntry[] {
    const result: AgentSoulEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.capabilities.includes(capability)) {
        result.push(entry);
      }
    }
    return result;
  }
}

// Global registry instance
export const agentSoulRegistry = new AgentSoulRegistry();

// Pre-register default agent souls
agentSoulRegistry.register({
  type: 'epidemiology',
  name: 'Epidemiology Agent',
  description:
    '检索椎间盘突出的流行病学与危险因素文献，包括发病率、患病率、遗传因素、职业风险等',
  capabilities: ['literature-search', 'epidemiology'],
});

agentSoulRegistry.register({
  type: 'pathophysiology',
  name: 'Pathophysiology Agent',
  description:
    '检索椎间盘突出的病理机制与疼痛通路文献，包括分子机制、炎症反应、神经敏化等',
  capabilities: ['literature-search', 'pathophysiology'],
});

agentSoulRegistry.register({
  type: 'diagnosis',
  name: 'Diagnosis Agent',
  description:
    '检索椎间盘突出的诊断、筛查与预防文献，包括MRI诊断、体格检查、鉴别诊断等',
  capabilities: ['literature-search', 'diagnosis'],
});

agentSoulRegistry.register({
  type: 'management',
  name: 'Management Agent',
  description:
    '检索椎间盘突出的疾病管理与治疗文献，包括保守治疗、药物治疗、手术治疗等',
  capabilities: ['literature-search', 'management'],
});

agentSoulRegistry.register({
  type: 'quality-of-life',
  name: 'Quality of Life Agent',
  description:
    '检索椎间盘突出的生活质量与社会负担文献，包括疾病负担、经济学成本等',
  capabilities: ['literature-search', 'quality-of-life'],
});

agentSoulRegistry.register({
  type: 'emerging-treatments',
  name: 'Emerging Treatments Agent',
  description: '检索椎间盘突出的展望与新兴疗法文献，包括再生医学、干细胞治疗等',
  capabilities: ['literature-search', 'emerging-treatments'],
});

agentSoulRegistry.register({
  type: 'paper-analysis',
  name: 'Paper Analysis Agent',
  description: '科学论文分析 Agent，用于文献筛选、质量评估、比较分析',
  capabilities: ['paper-analysis', 'literature-evaluation'],
});
