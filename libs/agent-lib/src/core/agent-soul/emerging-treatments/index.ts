import { readFileSync } from 'fs';
import { AgentSoulConfig } from '../../agent/AgentFactory';
import { A2ATaskComponent, BibliographySearchComponent } from '../../../components';
import path from 'path';

/**
 * 展望与新兴疗法检索 Agent Soul
 */
export function createEmergingTreatmentsAgentSoul(): AgentSoulConfig {
  return {
    agent: {
      sop: readFileSync(path.resolve(import.meta.dirname, 'sop.md')).toString(),
      name: 'Emerging Treatments Agent',
      type: 'article-retrieve-emerging-treatments',
      description:
        '展望与新兴疗法文献检索专家，负责再生医学、干细胞治疗、组织工程等前沿文献的检索与筛选',
    },
    components: [
      {
        component: new BibliographySearchComponent(),
      },
      {
        component: new A2ATaskComponent(),
      },
    ],
  };
}

export { createEmergingTreatmentsAgentSoul as createAgentSoul };
