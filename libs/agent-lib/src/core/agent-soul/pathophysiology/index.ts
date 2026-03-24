import { readFileSync } from 'fs';
import { AgentSoulConfig } from '../../agent/AgentFactory';
import { BibliographySearchComponent } from '../../../components';
import path from 'path';

/**
 * 病理机制与疼痛通路检索 Agent Soul
 */
export function createPathophysiologyAgentSoul(): AgentSoulConfig {
  return {
    agent: {
      sop: readFileSync(path.resolve(import.meta.dirname, 'sop.md')).toString(),
      name: 'Pathophysiology & Pain Mechanisms Agent',
      type: 'article-retrieve-pathophysiology',
      description:
        '病理机制与疼痛通路文献检索专家，负责分子机制、炎症反应、疼痛通路等文献的检索与筛选',
    },
    components: [
      {
        component: new BibliographySearchComponent(),
      },
    ],
  };
}

export { createPathophysiologyAgentSoul as createAgentSoul };
