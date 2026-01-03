import OpenAI from "openai";
import { Tool, ToolArgs, ToolResponse } from "../types";

const tool_graph_native_desc: OpenAI.Chat.ChatCompletionTool = {
    type: 'function',
    function: {
        name: 'tool graph',
        description: 'The collection of all available tools, organized in graph format likes GraphQL.\n\nYou can explore along the tree-shape classification path to find the tool',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description:
                        'The search query or question to find relevant documents for',
                },
                index_name: {
                    type: 'string',
                    description:
                        'The name of the vector index to search in (optional, will use default if not specified)',
                },
                top_k: {
                    type: 'number',
                    description: 'Number of top results to return (default: 5, max: 20)',
                    default: 5,
                },
                filters: {
                    type: 'object',
                    description:
                        'Optional filters to apply to the search (e.g., document type, date range, tags)',
                },
            },
            required: ['query'],
            additionalProperties: false,
        },
    },
}

export const tool_graph: Tool = {
    desc: {
        native: tool_graph_native_desc,
        xml: function (args: ToolArgs): string | undefined {
            throw new Error("Function not implemented.");
        },
        mcp: undefined
    },
    resolve: function (args: any): Promise<ToolResponse> {
        throw new Error("Function not implemented.");
    }
}

