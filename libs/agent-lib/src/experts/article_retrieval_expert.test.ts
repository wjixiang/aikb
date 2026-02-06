import { ArticleRetrievalExpert } from './article_retrieval_expert.js'

describe("ArticleRetrievalExpert", () => {
    it('integrated test', async () => {
        const result = await ArticleRetrievalExpert.start('Retrieval articles: n adult patients with type 2 diabetes mellitus, do SGLT2 inhibitors compared to placebo or standard care reduce the incidence of major adverse cardiovascular events and hospitalization for heart failure?')

    }, 99999)

})