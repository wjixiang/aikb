import { readFileSync } from "fs";
import { AgentFactoryOptions } from "../../agent/AgentFactory";
import { BibliographySearchComponent } from "../../../components";
import path from "path";

/**
 * 流行病学与危险因素检索 Agent Soul
 */
export function createEpidemiologyAgentSoul(): AgentFactoryOptions {
    return {
        agent: {
            sop: readFileSync(path.resolve(import.meta.dirname, 'sop.md')).toString(),
            name: 'Epidemiology & Risk Factors Agent',
            type: 'article-retrieve-epidemiology',
            description: '流行病学与危险因素文献检索专家，负责发病率、患病率、危险因素等文献的检索与筛选',
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

export { createEpidemiologyAgentSoul as createAgentSoul };
