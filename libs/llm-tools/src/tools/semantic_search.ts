import { semantic_search } from "../native-tools/semantic_search";
import { getSemanticSearchDescription } from "../semantic-search";
import { Tool, ToolArgs, ToolResponse } from "../types";
import { ApolloClient, HttpLink, InMemoryCache, gql } from "@apollo/client";

export const semantic_search_tool: Tool = {
    desc: {
        native: semantic_search,
        xml: getSemanticSearchDescription
    },
    resolve: function (args: any): Promise<ToolResponse> {
        const query = args['query'] as string

        throw new Error("Function not implemented.");
    }
}