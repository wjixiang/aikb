import { readFileSync } from "fs";
import { AgentFactoryOptions } from "../../agent/AgentFactory";
import { BibliographySearchComponent } from "../../../components";
import path from "path";

/**
 * 病理机制与疼痛通路检索 Agent Soul
 */
export function createPathophysiologyAgentSoul(): AgentFactoryOptions {
    return {
        agent: {
            sop: readFileSync(path.resolve(import.meta.dirname, 'sop.md')).toString(),
            name: 'Pathophysiology & Pain Mechanisms Agent',
            type: 'article-retrieve-pathophysiology',
            description: '病理机制与疼痛通路文献检索专家，负责分子机制、炎症反应、疼痛通路等文献的检索与筛选',
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

export { createPathophysiologyAgentSoul as createAgentSoul };
