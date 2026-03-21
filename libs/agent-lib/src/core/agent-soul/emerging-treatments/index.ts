import { readFileSync } from "fs";
import { AgentFactoryOptions } from "../../agent/AgentFactory";
import { BibliographySearchComponent } from "../../../components";
import path from "path";

/**
 * 展望与新兴疗法检索 Agent Soul
 */
export function createEmergingTreatmentsAgentSoul(): AgentFactoryOptions {
    return {
        agent: {
            sop: readFileSync(path.resolve(import.meta.dirname, 'sop.md')).toString(),
            name: 'Emerging Treatments Agent',
            type: 'article-retrieve-emerging-treatments',
            description: '展望与新兴疗法文献检索专家，负责再生医学、干细胞治疗、组织工程等前沿文献的检索与筛选',
        },
        api: {
            apiProvider: 'openai',
            openAiBaseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3',
            apiKey: process.env['OPENAI_API_KEY'],
            apiModelId: 'glm-4.7',
            zaiApiLine: 'china_coding',
        },
        components: [
            { id: 'bibliography-search', component: new BibliographySearchComponent() },
        ],
    };
}

export { createEmergingTreatmentsAgentSoul as createAgentSoul };
