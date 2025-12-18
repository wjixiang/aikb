import OpenAI from "openai"

const SEMANTIC_SEARCH_DESCRIPTION = `
Perform semantic search on a vector index to find relevant chunks based on a query from several highly authoritative medical textbooks.
This tool searches through indexed documents using vector similarity to find the most relevant matches.
`

export const semantic_search = {
    type: "function",
    function: {
        name: "semantic_search",
        description: SEMANTIC_SEARCH_DESCRIPTION,
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The search query or question to find relevant documents for"
                },
                index_name: {
                    type: "string",
                    description: "The name of the vector index to search in (optional, will use default if not specified)"
                },
                top_k: {
                    type: "number",
                    description: "Number of top results to return (default: 5, max: 20)",
                    default: 5
                },
                filters: {
                    type: "object",
                    description: "Optional filters to apply to the search (e.g., document type, date range, tags)"
                }
            },
            required: ["query"],
            additionalProperties: false,
        },
    },
} satisfies OpenAI.Chat.ChatCompletionTool
