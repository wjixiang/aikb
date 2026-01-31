/**
 * Bookshelf Workspace Components (v3)
 * Tool-call based components for Bookshelf workspace
 */

import { z } from 'zod';
import { ToolComponent, Tool } from 'statefulContext';
import { tdiv } from 'statefulContext';
import { ApolloClient, InMemoryCache, HttpLink, gql, NormalizedCacheObject } from '@apollo/client';
import { loadErrorMessages, loadDevMessages } from "@apollo/client/dev";

loadDevMessages();
loadErrorMessages();

// GraphQL Client for bibliography-service
const BIBLIOGRAPHY_SERVICE_URL = (process.env as any)['BIBLIOGRAPHY_SERVICE_URL'] || 'http://localhost:3003';

let apolloClient: ApolloClient<NormalizedCacheObject> | null = null;

function getApolloClient(): ApolloClient<NormalizedCacheObject> {
    if (!apolloClient) {
        apolloClient = new ApolloClient({
            link: new HttpLink({ uri: `${BIBLIOGRAPHY_SERVICE_URL}/graphql` }),
            cache: new InMemoryCache(),
        });
    }
    return apolloClient;
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
    query SemanticSearch($query: String!, $chunkEmbedGroupId: ID!, $topK: Int, $scoreThreshold: Float) {
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
            pages: item.archives?.[0]?.pageCount || 0
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
            variables: { id: itemId }
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
async function performSemanticSearch(query: string, chunkEmbedGroupId: string): Promise<string[]> {
    try {
        const client = getApolloClient();
        const { data } = await client.query({
            query: SEMANTIC_SEARCH,
            variables: {
                query,
                chunkEmbedGroupId,
                topK: 10,
                scoreThreshold: 0.0
            }
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
        return [`Search error: ${error instanceof Error ? error.message : 'Unknown error'}`];
    }
}

// Get default chunk embed group for a book (use first group)
async function getDefaultChunkEmbedGroup(itemId: string): Promise<string | null> {
    try {
        const client = getApolloClient();
        const { data } = await client.query({
            query: GET_CHUNK_EMBED_GROUPS,
            variables: { itemId }
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
export class BookViewerComponent extends ToolComponent {
    toolSet = new Map<string, Tool>([
        ['selectBook', {
            toolName: 'selectBook',
            desc: 'Select a book from the library',
            paramsSchema: z.object({ bookName: z.string().describe('Name of the book to select') })
        }],
        ['search', {
            toolName: 'search',
            desc: 'Perform semantic search across the book',
            paramsSchema: z.object({ query: z.string().describe('Search query text') })
        }]
    ]);

    // Internal state
    private availableBooks: BookInfo[] = [];
    private currentBook: BookInfo | null = null;
    private totalPages: number = 0;
    private bookName: string | null = null;
    private bookId: string | null = null;
    private content: string = '';
    private searchResults: string[] = [];
    private chunkEmbedGroupId: string | null = null;

    constructor() {
        super();
        this.fetchBooks();
    }

    /**
     * Fetch available books from bibliography service
     */
    private async fetchBooks(): Promise<void> {
        try {
            console.log('[BookViewer] Fetching available books from bibliography-service...');
            this.availableBooks = await fetchAvailableBooks();
            console.log(`[BookViewer] Fetched ${this.availableBooks.length} books`);
        } catch (error) {
            console.error('[BookViewer] Failed to fetch books:', error);
        }
    }

    /**
     * Render component as TUIElement array
     */
    renderImply = async () => {
        // Render book selector list
        const bookList = this.availableBooks
            .map((book: BookInfo) => {
                const isSelected = book.bookName === this.bookName;
                const marker = isSelected ? '→ ' : '  ';
                return `${marker}${book.bookName} (${book.pages} pages)`;
            })
            .join('\n');

        // Render book viewer content
        let viewerContent = '';
        if (!this.currentBook && !this.bookName) {
            viewerContent = '*No book selected. Please select a book first.*';
        } else {
            viewerContent = `**[book_name](EDITABLE):** ${this.bookName || 'Unknown'}\n\n---`;
        }

        // Render search results
        const resultsList = this.searchResults.length > 0
            ? this.searchResults.map((r: string, i: number) => `${'>'.repeat(6)}RESULT${i + 1}${'<'.repeat(6)}\n${r}`).join('\n--------------------\n')
            : '*No results*';

        return [
            new tdiv({
                content: '## 📖 Book Viewer',
                styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
            }),
            new tdiv({
                content: `- [book_name]: ${this.bookName ? `**${this.bookName}**` : '*None*'}`,
                styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
            }),
            new tdiv({
                content: '### Available books',
                styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
            }),
            new tdiv({
                content: bookList,
                styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
            }),
            new tdiv({
                content: viewerContent,
                styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
            }),
            new tdiv({
                content: '### 🔍 Search',
                styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
            }),
            new tdiv({
                content: `[search_query]: ${this.searchResults.length > 0 ? this.searchResults[0].split(':')[1]?.trim() || '*None*' : '*None*'}`,
                styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
            }),
            new tdiv({
                content: '-----Results-----\n' + resultsList,
                styles: { width: 80, showBorder: false }
            })
        ];
    };

    /**
     * Handle tool calls
     */
    handleToolCall = async (toolName: string, params: any): Promise<void> => {
        if (toolName === 'selectBook') {
            const bookName = params.bookName;
            console.log(`[BookViewer] Book changed to: ${bookName}`);

            if (bookName) {
                // Find book info from available books
                const selectedBook = this.availableBooks.find((b: BookInfo) => b.bookName === bookName);

                if (selectedBook) {
                    // Update internal state with new book info
                    this.bookName = selectedBook.bookName;
                    this.bookId = selectedBook.id;
                    this.totalPages = selectedBook.pages;
                    this.currentBook = selectedBook;

                    // Get default chunk embed group for search
                    this.chunkEmbedGroupId = await getDefaultChunkEmbedGroup(selectedBook.id);

                    // Load initial content
                    this.content = await fetchBookContent(selectedBook.id, 1);
                }
            } else {
                // Clear book info
                this.bookName = null;
                this.bookId = null;
                this.totalPages = 0;
                this.content = '';
                this.chunkEmbedGroupId = null;
                this.currentBook = null;
            }
        } else if (toolName === 'search') {
            const query = params.query;
            console.log(`[BookViewer] Search query: ${query}`);

            if (!query || query.length === 0) {
                this.searchResults = [];
                return;
            }

            if (!this.chunkEmbedGroupId) {
                if (!this.bookId) {
                    console.warn('[BookViewer] No book selected for search');
                    return;
                }
                const defaultChunkEmbedGroupId = await getDefaultChunkEmbedGroup(this.bookId);
                this.chunkEmbedGroupId = defaultChunkEmbedGroupId;
            }

            if (this.chunkEmbedGroupId) {
                console.log(`[BookViewer] Performing semantic search for "${query}"...`);
                this.searchResults = await performSemanticSearch(query, this.chunkEmbedGroupId);
            }
        }
    };

    /**
     * Get available books
     */
    getAvailableBooks(): BookInfo[] {
        return this.availableBooks;
    }

    /**
     * Get current book content
     */
    getContent(): string {
        return this.content;
    }

    /**
     * Get search results
     */
    getSearchResults(): string[] {
        return this.searchResults;
    }
}

/**
 * WorkspaceInfo Component (v3)
 * Displays workspace information and status
 */
export class WorkspaceInfoComponent extends ToolComponent {
    toolSet = new Map<string, Tool>([
        ['updateTimestamp', {
            toolName: 'updateTimestamp',
            desc: 'Update the last updated timestamp',
            paramsSchema: z.object({})
        }]
    ]);

    private lastUpdated: string = new Date().toISOString();

    constructor() {
        super();
    }

    /**
     * Render component as TUIElement array
     */
    renderImply = async () => {
        const formattedDate = new Date(this.lastUpdated).toLocaleString();

        return [
            new tdiv({
                content: `## ℹ️ Workspace Information\n**Last Updated:** ${formattedDate}`,
                styles: {
                    width: 80,
                    showBorder: false
                }
            })
        ];
    };

    /**
     * Handle tool calls
     */
    handleToolCall = async (toolName: string, params: any): Promise<void> => {
        if (toolName === 'updateTimestamp') {
            this.lastUpdated = new Date().toISOString();
        }
    };
}
