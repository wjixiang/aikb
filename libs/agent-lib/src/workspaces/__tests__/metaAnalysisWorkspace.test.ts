import { Agent, defaultAgentConfig } from "../../agent/agent"
import { MetaAnalysisWorkspace } from '../metaAnalysisWorkspace'
import { ApiClientFactory } from '../../api-client/index.js';
describe('meta analysis workspace', () => {
    it.skip('should execute task', async () => {
        const apiClient = ApiClientFactory.create({
            apiProvider: 'openai',
            apiKey: process.env['OPENAI_API_KEY'] || 'test-key',
            apiModelId: 'gpt-4',
        });
        const agent = new Agent(
            defaultAgentConfig,
            new MetaAnalysisWorkspace(),
            {
                capability: 'Search and analyze medical literature from PubMed',
                direction: 'Help users find relevant articles about medical treatments and conditions'
            },
            apiClient
        )
        await agent.start('search article about treatment of hypertension')
    }, 999999)

    it('should handle tool calling', async () => {
        const workspace = new MetaAnalysisWorkspace()
        await workspace.handleToolCall('search_pubmed', JSON.parse('{\"simpleTerm\": \"treatment of hypertension\", \"sort\": \"date\", \"sortOrder\": \"dsc\"}'))
        const result = await workspace.render()
        console.log(result)
    })
})