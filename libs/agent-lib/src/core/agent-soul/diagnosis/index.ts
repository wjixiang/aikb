import { readFileSync } from "fs";
import { AgentFactoryOptions } from "../../agent/AgentFactory";
import { BibliographySearchComponent } from "../../../components";
import path from "path";

/**
 * 诊断、筛查与预防检索 Agent Soul
 */
export function createDiagnosisAgentSoul(): AgentFactoryOptions {
    return {
        agent: {
            sop: readFileSync(path.resolve(import.meta.dirname, 'sop.md')).toString(),
            name: 'Diagnosis & Prevention Agent',
            type: 'article-retrieve-diagnosis',
            description: '诊断、筛查与预防文献检索专家，负责影像学诊断、临床检查、预防策略等文献的检索与筛选',
        },
        api: {
            apiProvider: 'openai',
            openAiBaseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3',
            apiKey: process.env['OPENAI_API_KEY'],
            apiModelId: 'glm-4.7',
            zaiApiLine: 'china_coding',
        },
        components: [
            { id: 'bibliography-search', component: new BibliographySearchComponent() }
        ],
    };
}

export { createDiagnosisAgentSoul as createAgentSoul };
