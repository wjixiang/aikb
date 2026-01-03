import { semantic_search } from '../native-tools/semantic_search';
import { getSemanticSearchDescription } from '../semantic-search';
import { Tool, ToolArgs, ToolResponse } from '../types';
import { ApolloClient, HttpLink, InMemoryCache, gql } from '@apollo/client';

// Type definitions for the GraphQL response
interface SemanticSearchResult {
  content: string;
}

interface SemanticSearchResponse {
  semanticSearch: {
    results: SemanticSearchResult[];
  };
}

// Create Apollo Client for GraphQL requests
const client = new ApolloClient({
  link: new HttpLink({
    uri: 'http://localhost:3003/graphql',
  }),
  cache: new InMemoryCache(),
});

// GraphQL query for semantic search
const SEMANTIC_SEARCH_QUERY = gql`
  query SemanticSearch($chunkEmbedGroupId: ID!, $query: String!) {
    semanticSearch(chunkEmbedGroupId: $chunkEmbedGroupId, query: $query) {
      results {
        content
      }
    }
  }
`;

export const semantic_search_tool: Tool = {
  desc: {
    native: semantic_search,
    xml: getSemanticSearchDescription,
  },
  resolve: async function (args: any): Promise<ToolResponse> {
    const query = args['query'] as string;
    const chunkEmbedGroupId =
      args['chunkEmbedGroupId'] || '9d8c8135-cce3-4802-93b5-9c91e3b74b0c';

    try {
      const result = await client.query<SemanticSearchResponse>({
        query: SEMANTIC_SEARCH_QUERY,
        variables: {
          chunkEmbedGroupId,
          query,
        },
      });

      const results = result.data?.semanticSearch?.results || [];

      if (results.length === 0) {
        return {
          type: 'text',
          content: 'No results found for the given query.',
        };
      }

      // Format the results as a readable response
      const formattedResults = results
        .map(
          (item: SemanticSearchResult, index: number) =>
            `Result ${index + 1}:\n${item.content}`,
        )
        .join('\n\n');

      return {
        type: 'text',
        content: formattedResults,
      };
    } catch (error) {
      console.error('Semantic search error:', error);
      return {
        type: 'text',
        content: `Error performing semantic search: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isError: true,
      };
    }
  },
};
