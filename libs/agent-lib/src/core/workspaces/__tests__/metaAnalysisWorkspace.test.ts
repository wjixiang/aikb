import { MetaAnalysisWorkspace } from '../metaAnalysisWorkspace'

describe('meta analysis workspace', () => {
    it('should handle tool calling', async () => {
        const workspace = new MetaAnalysisWorkspace()
        await workspace.handleToolCall('search_pubmed', JSON.parse('{"simpleTerm": "treatment of hypertension", "sort": "date", "sortOrder": "dsc"}'))
        const result = await workspace.render()
        console.log(result)
    })
})