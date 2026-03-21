import { readFileSync } from "fs";
import { AgentFactoryOptions } from "../../../agent/AgentFactory";
import { BibliographySearchComponent } from "../../../components";
import path from "path";


export function createPubmedRetrieveAgentSoul(): AgentFactoryOptions {
    return {
        agent: {
            sop: readFileSync(path.resolve(import.meta.dirname, 'sop-pubmed-retrieve.md')).toString(),
            name: 'PubMed Search Agent',
            type: 'pubmed-retrieve',
            description: 'Specialized agent for PubMed literature search',
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
