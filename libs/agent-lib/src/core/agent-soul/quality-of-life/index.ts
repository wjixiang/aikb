import { readFileSync } from 'fs';
import { AgentSoulConfig } from '../../agent/AgentFactory';
import { BibliographySearchComponent } from '../../../components';
import path from 'path';

/**
 * 生活质量与社会负担检索 Agent Soul
 */
export function createQualityOfLifeAgentSoul(): AgentSoulConfig {
  return {
    agent: {
      sop: readFileSync(path.resolve(import.meta.dirname, 'sop.md')).toString(),
      name: 'Quality of Life & Burden Agent',
      type: 'article-retrieve-quality-of-life',
      description:
        '生活质量与社会负担文献检索专家，负责疾病负担、生活质量、经济学成本等文献的检索与筛选',
    },
    components: [
      {
        componentClass: BibliographySearchComponent,
      },
    ],
  };
}

export { createQualityOfLifeAgentSoul as createAgentSoul };
