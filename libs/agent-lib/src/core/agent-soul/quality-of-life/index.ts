import { readFileSync } from "fs";
import { AgentFactoryOptions } from "../../agent/AgentFactory";
import { BibliographySearchComponent } from "../../../components";
import path from "path";

/**
 * 生活质量与社会负担检索 Agent Soul
 */
export function createQualityOfLifeAgentSoul(): AgentFactoryOptions {
    return {
        agent: {
            sop: readFileSync(path.resolve(import.meta.dirname, 'sop.md')).toString(),
            name: 'Quality of Life & Burden Agent',
            type: 'article-retrieve-quality-of-life',
            description: '生活质量与社会负担文献检索专家，负责疾病负担、生活质量、经济学成本等文献的检索与筛选',
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

export { createQualityOfLifeAgentSoul as createAgentSoul };
