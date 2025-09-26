import axios from "axios";
import { app_config } from "src/knowledgeBase/config";

interface WikiSearchParams {
    language_code: string;
    search_query: string;
    number_of_results: number;
}

interface WikiSearchResult {
    title: string;
    description: string;
    url: string;
}

interface WikiSearchApiConfig {

}

interface WikiHtml extends WikiSearchResult {
    htmlStr: string;
}

interface WikiMarkdown extends WikiSearchResult {
    mdStr: string;
}

export default class WikiSearchApi {
    constructor(private config: WikiSearchApiConfig) {
        
    }

    async searchWiki(params: WikiSearchParams): Promise<WikiSearchResult[]> {
        const baseUrl = `https://${params.language_code}.wikipedia.org/w/api.php`;
        const searchParams = {
            action: 'opensearch',
            search: params.search_query,
            limit: params.number_of_results,
            namespace: 0,
            format: 'json',
            origin: '*'
        };

        try {
            const response = await axios.get(baseUrl, {
                params: searchParams,
                timeout: 10000 // 10 seconds timeout
            });

            // The response format is: [searchTerm, titles, descriptions, urls]
            const [, titles, descriptions, urls] = response.data;
            
            if (!titles || titles.length === 0) {
                return [];
            }

            return titles.map((title: string, index: number) => ({
                title,
                description: descriptions[index] || '',
                url: urls[index] || ''
            }));
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Wikipedia API request failed: ${error.message}`);
            }
            throw error;
        }
    }

    async getHtml(searchRes: WikiSearchResult): Promise<WikiHtml> {
        const data = await axios.get(searchRes.url)
        return {
            ...searchRes,
            htmlStr: data.data
        }
    }

    async getMarkdown(searchRes: WikiSearchResult): Promise<WikiMarkdown>{
        console.log(`${app_config.fastapiEndPoint}/tomd/url`)
        const md = await axios.post(`${app_config.fastapiEndPoint}/tomd/url`,{
            url: searchRes.url
        })

        return {
            ...searchRes,
            mdStr: md.data.markdown
        }
    }
    
}