import { readFileSync } from 'fs';
import { AgentSoulConfig } from '../../agent/AgentFactory';
import { BibliographySearchComponent } from '../../../components';
import path from 'path';

/**
 * 疾病管理与治疗检索 Agent Soul
 */
export function createManagementAgentSoul(): AgentSoulConfig {
  return {
    agent: {
      sop: readFileSync(path.resolve(import.meta.dirname, 'sop.md')).toString(),
      name: 'Disease Management Agent',
      type: 'article-retrieve-management',
      description:
        '疾病管理与治疗文献检索专家，负责保守治疗、药物治疗、手术治疗、临床指南等文献的检索与筛选',
    },
    components: [
      {
        component: new BibliographySearchComponent(),
      },
    ],
  };
}

export { createManagementAgentSoul as createAgentSoul };
