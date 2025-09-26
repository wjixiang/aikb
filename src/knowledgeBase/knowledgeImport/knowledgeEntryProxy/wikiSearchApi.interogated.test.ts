import { describe, it, expect, vi, beforeEach } from "vitest";
import WikiSearchApi from "./WikiSearchApi";


describe(WikiSearchApi, () => {
    let wikiProxy: WikiSearchApi;
    
    beforeEach(() => {
        vi.clearAllMocks();
        wikiProxy = new WikiSearchApi({});
    });
    
    it('search wiki and get result', async()=>{
        const searchRes = await wikiProxy.searchWiki({
            language_code: "en",
            search_query: "hypertension",
            number_of_results: 3
        })

        console.log(searchRes)

        const mdRes = await wikiProxy.getMarkdown(searchRes[0])
        console.log(mdRes)
    },30000)

    
});