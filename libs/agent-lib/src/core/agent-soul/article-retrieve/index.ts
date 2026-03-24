import { readFileSync } from 'fs';
import { AgentSoulConfig } from '../../agent/AgentFactory';
import { A2ATaskComponent, BibliographySearchComponent } from '../../../components';
import path from 'path';

export function createBibRetrieveAgentSoul(): AgentSoulConfig {
  return {
    agent: {
      sop: readFileSync(
        path.resolve(import.meta.dirname, 'sop-article-retrieve.md'),
      ).toString(),
      name: 'Paper Analysis Agent',
      type: 'paper-analysis',
      description: 'Specialized agent for scientific paper analysis',
    },
    components: [
      {
        component: new BibliographySearchComponent(),
      },
      // {
      //   component: new A2ATaskComponent(),
      // },
    ],
  };
}
