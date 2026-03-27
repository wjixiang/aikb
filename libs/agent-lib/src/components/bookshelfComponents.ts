/**
 * Bookshelf Workspace Components (v3)
 * Tool-call based components for Bookshelf workspace
 */

import { z } from 'zod';
// @ts-expect-error - Apollo client has default export at runtime but TS types are inconsistent
import apollo from '@apollo/client';
import { loadErrorMessages, loadDevMessages } from '@apollo/client/dev';
import { ReactiveToolComponent } from './core/reactiveToolComponent.js';
import { tdiv } from './ui/tdiv.js';
import type { ToolCallResult } from './core/types.js';
import type { TUIElement } from './ui/TUIElement.js';
import type {
  ApolloClient,
  NormalizedCacheObject,
  InMemoryCache,
  HttpLink,
} from '@apollo/client';

const {
  ApolloClient: ApolloClientClass,
  InMemoryCache: InMemoryCacheClass,
  HttpLink: HttpLinkClass,
  gql,
} = apollo;

loadDevMessages();
loadErrorMessages();

// GraphQL Client for bibliography-service
const BIBLIOGRAPHY_SERVICE_URL =
  (process.env as any)['BIBLIOGRAPHY_SERVICE_URL'] || 'http://localhost:3003';

let apolloClient: ApolloClient<NormalizedCacheObject> | null = null;

function getApolloClient(): ApolloClient<NormalizedCacheObject> {
  if (!apolloClient) {
    apolloClient = new ApolloClientClass({
      link: new HttpLinkClass({ uri: `${BIBLIOGRAPHY_SERVICE_URL}/graphql` }),
      cache: new InMemoryCacheClass(),
    });
  }
  return apolloClient as ApolloClient<NormalizedCacheObject>;
}

// GraphQL queries and mutations
const GET_LIBRARY_ITEMS = gql`
  query GetLibraryItems {
    libraryItems {
      id
      title
      authors {
        firstName
        lastName
        middleName
      }
      abstract
      publicationYear
      publisher
      isbn
      doi
      url
      tags
      notes
      collections
      dateAdded
      dateModified
      language
      markdownContent
      markdownUpdatedDate
      archives {
        fileType
        fileSize
        fileHash
        addDate
        s3Key
        pageCount
        wordCount
      }
    }
  }
`;

const GET_LIBRARY_ITEM = gql`
  query GetLibraryItem($id: ID!) {
    libraryItem(id: $id) {
      id
      title
      authors {
        firstName
        lastName
        middleName
      }
      abstract
      publicationYear
      publisher
      isbn
      doi
      url
      tags
      notes
      collections
      dateAdded
      dateModified
      language
      markdownContent
      markdownUpdatedDate
      archives {
        fileType
        fileSize
        fileHash
        addDate
        s3Key
        pageCount
        wordCount
      }
    }
  }
`;

const GET_CHUNK_EMBED_GROUPS = gql`
  query GetChunkEmbedGroups($itemId: ID!) {
    chunkEmbedGroups(itemId: $itemId) {
      groups {
        id
        itemId
        name
        description
        isDefault
        isActive
        createdAt
        updatedAt
        createdBy
      }
      total
    }
  }
`;

const SEMANTIC_SEARCH = gql`
  query SemanticSearch(
    $query: String!
    $chunkEmbedGroupId: ID!
    $topK: Int
    $scoreThreshold: Float
  ) {
    semanticSearch(
      query: $query
      chunkEmbedGroupId: $chunkEmbedGroupId
      topK: $topK
      scoreThreshold: $scoreThreshold
    ) {
      query
      totalResults
      results {
        chunkId
        itemId
        title
        content
        score
        metadata {
          startPosition
          endPosition
          wordCount
          chunkType
        }
        libraryItem {
          id
          title
          authors {
            firstName
            lastName
          }
        }
        chunkEmbedGroup {
          id
          name
        }
      }
    }
  }
`;

export interface BookInfo {
  bookName: string;
  desc: string;
  pages: number;
  id: string;
}

// Fetch available books from bibliography-service
async function fetchAvailableBooks(): Promise<BookInfo[]> {
  try {
    const client = getApolloClient();
    const { data } = await client.query({ query: GET_LIBRARY_ITEMS });

    return data.libraryItems.map((item: any) => ({
      id: item.id,
      bookName: item.title,
      desc: item.abstract || 'No description available',
      pages: item.archives?.[0]?.pageCount || 0,
    }));
  } catch (error) {
    console.error('[BookViewer] Failed to fetch library items:', error);
    return [];
  }
}

// Fetch book content by ID
async function fetchBookContent(itemId: string, page: number): Promise<string> {
  try {
    const client = getApolloClient();
    const { data } = await client.query({
      query: GET_LIBRARY_ITEM,
      variables: { id: itemId },
    });

    const markdownContent = data.libraryItem?.markdownContent;
    if (!markdownContent) {
      return `No content available for this book.`;
    }

    // Simple pagination - split content by page breaks or lines
    const lines = markdownContent.split('\n');
    const linesPerPage = 50; // Approximate lines per page
    const startIndex = (page - 1) * linesPerPage;
    const endIndex = startIndex + linesPerPage;
    const pageContent = lines.slice(startIndex, endIndex).join('\n');

    return pageContent || `Content for page ${page}...`;
  } catch (error) {
    console.error('[BookViewer] Failed to fetch book content:', error);
    return `Error loading content for page ${page}.`;
  }
}

// Perform semantic search
async function performSemanticSearch(
  query: string,
  chunkEmbedGroupId: string,
): Promise<string[]> {
  try {
    const client = getApolloClient();
    const { data } = await client.query({
      query: SEMANTIC_SEARCH,
      variables: {
        query,
        chunkEmbedGroupId,
        topK: 10,
        scoreThreshold: 0.0,
      },
    });
    if (!data.semanticSearch || data.semanticSearch.results.length === 0) {
      return [];
    }

    return data.semanticSearch.results.map((result: any) => {
      const title = result.libraryItem?.title || 'Unknown';
      const content = result.content;
      return `Found "${query}" in "${title}" (score: ${result.score.toFixed(3)}): ${content}`;
    });
  } catch (error) {
    console.error('[BookViewer] Failed to perform semantic search:', error);
    return [
      `Search error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    ];
  }
}

// Get default chunk embed group for a book (use first group)
async function getDefaultChunkEmbedGroup(
  itemId: string,
): Promise<string | null> {
  try {
    const client = getApolloClient();
    const { data } = await client.query({
      query: GET_CHUNK_EMBED_GROUPS,
      variables: { itemId },
    });
    const groups = data.chunkEmbedGroups[0].groups || [];
    // Use first group as default
    const firstGroup = groups[0];
    return firstGroup?.id || null;
  } catch (error) {
    console.error('[BookViewer] Failed to get chunk embed groups:', error);
    return null;
  }
}

/**
 * BookViewer Component (v3)
 * Displays selected book and allows page navigation
 * Uses tool-call mechanism for state management
 */
export class BookViewerComponent extends ReactiveToolComponent<{
  availableBooks: BookInfo[];
  currentBook: BookInfo | null;
  totalPages: number;
  bookName: string | null;
  bookId: string | null;
  content: string;
  searchResults: string[];
  chunkEmbedGroupId: string | null;
}> {
  override componentId = 'book-viewer';
  override displayName = 'Book Viewer';
  override description = 'Browse and search library books';
  override componentPrompt = `## Book Viewer

This component provides access to the library for browsing and searching books.

**Capabilities:**
- Browse available books in the library
- Select books to read and navigate content
- Perform semantic search across book content
- Navigate by pages and chunks

**Best Practices:**
- Use semantic search to find specific content within books
- Navigate pages sequentially for systematic reading
- Save relevant sections for later reference`;

  protected override initialState() {
    return {
      availableBooks: [],
      currentBook: null,
      totalPages: 0,
      bookName: null,
      bookId: null,
      content: '',
      searchResults: [],
      chunkEmbedGroupId: null,
    };
  }

  protected override toolDefs() {
    return {
      selectBook: {
        desc: 'Select a book from the library',
        paramsSchema: z.object({
          bookName: z.string().describe('Name of the book to select'),
        }),
      },
      search: {
        desc: 'Perform semantic search across the book',
        paramsSchema: z.object({
          query: z.string().describe('Search query text'),
        }),
      },
    };
  }

  constructor() {
    super();
    this.fetchBooks();
  }

  private async fetchBooks(): Promise<void> {
    try {
      console.log(
        '[BookViewer] Fetching available books from bibliography-service...',
      );
      this.reactive.availableBooks = await fetchAvailableBooks();
      console.log(
        `[BookViewer] Fetched ${this.reactive.availableBooks.length} books`,
      );
    } catch (error) {
      console.error('[BookViewer] Failed to fetch books:', error);
    }
  }

  renderImply = async (): Promise<TUIElement[]> => {
    const s = this.snapshot;

    const bookList = s.availableBooks
      .map((book: BookInfo) => {
        const isSelected = book.bookName === s.bookName;
        const marker = isSelected ? '→ ' : '  ';
        return `${marker}${book.bookName} (${book.pages} pages)`;
      })
      .join('\n');

    let viewerContent = '';
    if (!s.currentBook && !s.bookName) {
      viewerContent = '*No book selected. Please select a book first.*';
    } else {
      viewerContent = `**[book_name](EDITABLE):** ${s.bookName || 'Unknown'}\n\n---`;
    }

    const resultsList =
      s.searchResults.length > 0
        ? s.searchResults
            .map(
              (r: string, i: number) =>
                `${'>'.repeat(6)}RESULT${i + 1}${'<'.repeat(6)}\n${r}`,
            )
            .join('\n--------------------\n')
        : '*No results*';

    return [
      new tdiv({
        content: '## 📖 Book Viewer',
        styles: { width: 80, showBorder: false, margin: { bottom: 1 } },
      }),
      new tdiv({
        content: `- [book_name]: ${s.bookName ? `**${s.bookName}**` : '*None*'}`,
        styles: { width: 80, showBorder: false, margin: { bottom: 1 } },
      }),
      new tdiv({
        content: '### Available books',
        styles: { width: 80, showBorder: false, margin: { bottom: 1 } },
      }),
      new tdiv({
        content: bookList,
        styles: { width: 80, showBorder: false, margin: { bottom: 1 } },
      }),
      new tdiv({
        content: viewerContent,
        styles: { width: 80, showBorder: false, margin: { bottom: 1 } },
      }),
      new tdiv({
        content: '### 🔍 Search',
        styles: { width: 80, showBorder: false, margin: { bottom: 1 } },
      }),
      new tdiv({
        content: `[search_query]: ${s.searchResults.length > 0 ? s.searchResults[0].split(':')[1]?.trim() || '*None*' : '*None*'}`,
        styles: { width: 80, showBorder: false, margin: { bottom: 1 } },
      }),
      new tdiv({
        content: '-----Results-----\n' + resultsList,
        styles: { width: 80, showBorder: false },
      }),
    ];
  };

  async onSelectBook(params: {
    bookName: string;
  }): Promise<ToolCallResult<any>> {
    const bookName = params.bookName;
    console.log(`[BookViewer] Book changed to: ${bookName}`);

    if (bookName) {
      const selectedBook = this.snapshot.availableBooks.find(
        (b: BookInfo) => b.bookName === bookName,
      );

      if (selectedBook) {
        const chunkEmbedGroupId = await getDefaultChunkEmbedGroup(
          selectedBook.id,
        );
        const content = await fetchBookContent(selectedBook.id, 1);

        Object.assign(this.reactive, {
          bookName: selectedBook.bookName,
          bookId: selectedBook.id,
          totalPages: selectedBook.pages,
          currentBook: selectedBook,
          chunkEmbedGroupId,
          content,
        });
      }
    } else {
      Object.assign(this.reactive, {
        bookName: null,
        bookId: null,
        totalPages: 0,
        content: '',
        chunkEmbedGroupId: null,
        currentBook: null,
      });
    }
    return {
      success: true,
      data: { toolName: 'selectBook' },
      summary: `[Bookshelf] 执行: selectBook`,
    };
  }

  async onSearch(params: { query: string }): Promise<ToolCallResult<any>> {
    const query = params.query;
    console.log(`[BookViewer] Search query: ${query}`);

    if (!query || query.length === 0) {
      this.reactive.searchResults = [];
      return {
        success: true,
        data: { results: [] },
        summary: '[BookViewer] Search query is empty',
      };
    }

    let chunkEmbedGroupId = this.snapshot.chunkEmbedGroupId;
    if (!chunkEmbedGroupId) {
      const bookId = this.snapshot.bookId;
      if (!bookId) {
        console.warn('[BookViewer] No book selected for search');
        return {
          success: false,
          data: { error: 'No book selected for search' },
          summary: '[BookViewer] No book selected for search',
        };
      }
      chunkEmbedGroupId = await getDefaultChunkEmbedGroup(bookId);
      this.reactive.chunkEmbedGroupId = chunkEmbedGroupId;
    }

    if (chunkEmbedGroupId) {
      console.log(`[BookViewer] Performing semantic search for "${query}"...`);
      this.reactive.searchResults = await performSemanticSearch(
        query,
        chunkEmbedGroupId,
      );
      return {
        success: true,
        data: { query, results: this.snapshot.searchResults.length },
        summary: `[Bookshelf] 搜索: ${query}, 找到 ${this.snapshot.searchResults.length} 个结果`,
      };
    }
    return {
      success: true,
      data: { toolName: 'search' },
      summary: `[Bookshelf] 执行: search`,
    };
  }

  getAvailableBooks(): BookInfo[] {
    return this.snapshot.availableBooks;
  }

  getContent(): string {
    return this.snapshot.content;
  }

  getSearchResults(): string[] {
    return this.snapshot.searchResults;
  }
}

/**
 * WorkspaceInfo Component (v3)
 * Displays workspace information and status
 */
export class WorkspaceInfoComponent extends ReactiveToolComponent<{
  lastUpdated: string;
}> {
  override componentId = 'workspace-info';
  override displayName = 'Workspace Info';
  override description = 'Display workspace metadata and timestamps';
  override componentPrompt = `## Workspace Information

This component displays workspace metadata and timestamps.

**Purpose:**
- Track workspace last updated timestamp
- Provide basic workspace status information`;

  protected override initialState() {
    return { lastUpdated: new Date().toISOString() };
  }

  protected override toolDefs() {
    return {
      updateTimestamp: {
        desc: 'Update the last updated timestamp',
        paramsSchema: z.object({}),
      },
    };
  }

  renderImply = async (): Promise<TUIElement[]> => {
    const formattedDate = new Date(this.snapshot.lastUpdated).toLocaleString();

    return [
      new tdiv({
        content: `## ℹ️ Workspace Information\n**Last Updated:** ${formattedDate}`,
        styles: {
          width: 80,
          showBorder: false,
        },
      }),
    ];
  };

  async onUpdateTimestamp(): Promise<ToolCallResult<{ timestamp: string }>> {
    this.reactive.lastUpdated = new Date().toISOString();
    return {
      success: true,
      data: { timestamp: this.snapshot.lastUpdated },
      summary: `[WorkspaceInfo] 更新时间戳: ${this.snapshot.lastUpdated}`,
    };
  }
}
