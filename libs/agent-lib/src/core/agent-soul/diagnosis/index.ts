import { readFileSync } from 'fs';
import { AgentSoulConfig } from '../../agent/AgentFactory';
import { BibliographySearchComponent } from '../../../components';
import path from 'path';

/**
 * 诊断、筛查与预防检索 Agent Soul
 */
export function createDiagnosisAgentSoul(): AgentSoulConfig {
  return {
    agent: {
      sop: readFileSync(path.resolve(import.meta.dirname, 'sop.md')).toString(),
      name: 'Diagnosis & Prevention Agent',
      type: 'article-retrieve-diagnosis',
      description:
        '诊断、筛查与预防文献检索专家，负责影像学诊断、临床检查、预防策略等文献的检索与筛选',
    },
    components: [
      {
        component: new BibliographySearchComponent(),
      },
    ],
  };
}

export { createDiagnosisAgentSoul as createAgentSoul };
