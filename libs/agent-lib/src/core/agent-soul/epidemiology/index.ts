import { readFileSync } from 'fs';
import { AgentSoulConfig } from '../../agent/AgentFactory';
import { A2ATaskComponent, BibliographySearchComponent } from '../../../components';
import path from 'path';

/**
 * 流行病学与危险因素检索 Agent Soul
 */
export function createEpidemiologyAgentSoul(): AgentSoulConfig {
  return {
    agent: {
      sop: readFileSync(path.resolve(import.meta.dirname, 'sop.md')).toString(),
      name: 'Epidemiology & Risk Factors Agent',
      type: 'article-retrieve-epidemiology',
      description:
        '流行病学与危险因素文献检索专家，负责发病率、患病率、危险因素等文献的检索与筛选',
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

export { createEpidemiologyAgentSoul as createAgentSoul };
