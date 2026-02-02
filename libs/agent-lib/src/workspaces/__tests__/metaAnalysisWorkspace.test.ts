import { Agent, defaultApiConfig, defaultAgentConfig } from "../../agent/agent"
import { MetaAnalysisWorkspace } from '../metaAnalysisWorkspace'
describe('meta analysis workspace', () => {
    it.skip('should execute task', async () => {
        const agent = new Agent(defaultAgentConfig, defaultApiConfig, new MetaAnalysisWorkspace())
        await agent.start('search article about treatment of hypertension')
    }, 999999)

    it('should handle tool calling', async () => {
        const workspace = new MetaAnalysisWorkspace()
        await workspace.handleToolCall('search_pubmed', JSON.parse('{\"simpleTerm\": \"treatment of hypertension\", \"sort\": \"date\", \"sortOrder\": \"dsc\"}'))
        const result = await workspace.render()
        console.log(result)
    })
})