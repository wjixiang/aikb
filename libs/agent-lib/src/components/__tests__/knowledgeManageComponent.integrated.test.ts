import { KnowledgeManageComponent, Document, Entity, SearchResult } from '../knowledgeManageComponent';

describe(KnowledgeManageComponent, () => {
    it('should render into context correctly', async () => {
        const component = new KnowledgeManageComponent()

        const context = await component.render()
        console.log(context)
    })
})