import { ToolArgs } from "./types"

export function getSemanticSearchDescription(args: ToolArgs): string | undefined {
    return `## semantic_search
Description: Perform semantic search on a vector index to find relevant documents or content based on a query. This tool searches through indexed documents using vector similarity to find the most relevant matches, making it ideal for finding conceptually related content even when exact keyword matches don't exist. Use this tool when you need to search for information based on meaning and context rather than just exact text matches.
Parameters:
- query: (required) The search query or question to find relevant documents for. This should be a natural language question or statement describing what you're looking for.
- index_name: (optional) The name of the vector index to search in. If not specified, will use the default index.
- top_k: (optional) Number of top results to return. Default is 5, maximum is 20.
- filters: (optional) Object containing filters to apply to the search (e.g., document type, date range, tags).
Usage:
<semantic_search>
<query>
Your search query here
</query>
<index_name>
optional_index_name
</index_name>
<top_k>
5
</top_k>
<filters>
{"document_type": "research_paper", "date_range": "2020-2023"}
</filters>
</semantic_search>

Example: Searching for medical research about diabetes treatment
<semantic_search>
<query>
What are the latest treatments for type 2 diabetes mellitus?
</query>
<top_k>
10
</top_k>
<filters>
{"document_type": "clinical_study", "date_range": "2021-2023"}
</filters>
</semantic_search>`
}
