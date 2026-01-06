/**
 * Bookshelf Workspace Components
 * React-like components for Bookshelf workspace
 */

import { z } from 'zod';
import { WorkspaceComponent, ComponentState, ComponentProps } from './componentTypes';
import { EditableProps } from './workspaceTypes';
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
        // console.log(`semnatic search results: ${JSON.stringify(data)}`)
        if (!data.semanticSearch || data.semanticSearch.results.length === 0) {
            return [];
        }

        return data.semanticSearch.results.map((result: any) => {
            const title = result.libraryItem?.title || 'Unknown';
            const content = result.content.substring(0, 100) + '...';
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
        // Use the first group as default
        const firstGroup = groups[0];
        return firstGroup?.id || null;
    } catch (error) {
        console.error('[BookViewer] Failed to get chunk embed groups:', error);
        return null;
    }
}

/**
 * BookViewer Component
 * Displays selected book and allows page navigation
 * Merged functionality from BookSelectorComponent
 */
export class BookViewerComponent extends WorkspaceComponent {
    constructor() {
        const editableProps = {
            selected_book_name: {
                value: null,
                schema: z.string().nullable(),
                description: 'Select a book to browse',
                dependsOn: [],
                readonly: false
            },
            current_page: {
                value: 1,
                schema: z.coerce.number().int().positive(),
                description: 'Navigate to a specific page in the current book',
                dependsOn: ['selected_book_name'],
                readonly: false
            },
            search_query: {
                value: null,
                schema: z.string().min(1).nullable(),
                description: 'Search query to find content in books',
                dependsOn: [],
                readonly: false
            }
        } as Record<string, EditableProps>;

        super(
            'book_viewer',
            'BookViewer',
            'View, navigate, and search through pages of selected book',
            editableProps,
            {
                availableBooks: [] as BookInfo[],
                currentBook: null as BookInfo | null
            }
        );

        // Register state
        this.state['current_page'] = 1;
        this.state['totalPages'] = 0;
        this.state['bookName'] = null as string | null;
        this.state['bookId'] = null as string | null;
        this.state['content'] = '';
        this.state['search_query'] = null as string | null;
        this.state['search_results'] = [] as string[];
        this.state['chunkEmbedGroupId'] = null as string | null;

        // Fetch available books on mount
        this.useEffect('fetch-books', [], async () => {
            try {
                console.log('[BookViewer] Fetching available books from bibliography-service...');
                const books = await fetchAvailableBooks();
                this.props['availableBooks'] = books;
                console.log(`[BookViewer] Fetched ${books.length} books`);
            } catch (error) {
                console.error('[BookViewer] fetch-books effect failed:', error);
            }
        });

        // Use useEffect for side effects
        this.useEffect('log-page-change', ['current_page'], (deps) => {
            try {
                console.log(`[BookViewer] Page changed to ${deps['current_page']}`);
            } catch (error) {
                console.error('[BookViewer] log-page-change effect failed:', error);
            }
        });

        // Load content when page changes
        this.useEffect('load-content', ['current_page', 'bookId'], async (deps) => {
            try {
                const page = deps['current_page'];
                const bookId = deps['bookId'];
                if (bookId) {
                    console.log(`[BookViewer] Loading content for page ${page}...`);
                    // this.state['content'] = await fetchBookContent(bookId, page);
                }
            } catch (error) {
                console.error('[BookViewer] load-content effect failed:', error);
            }
        });

        // Log search query changes
        this.useEffect('log-query-change', ['search_query'], (deps) => {
            try {
                console.log(`[BookViewer] Search query changed to "${deps['search_query']}"`);
            } catch (error) {
                console.error('[BookViewer] log-query-change effect failed:', error);
            }
        });

        // Perform search when query changes
        this.useEffect('perform-search', ['search_query'], async (deps) => {
            try {
                const query = deps['search_query'];
                console.log(`searhc query: ${query}`)
                if (!query) return;
                console.log(`execute semantic search`);
                let chunkEmbedGroupId: string;

                if (!deps['chunkEmbedGroupId']) {
                    const selected_book_id = this.state['bookId'];
                    if (!selected_book_id) throw new Error(`bookId not provided`);
                    const defaultChunkEmbedGroupId = await getDefaultChunkEmbedGroup(selected_book_id);
                    this.state['chunkEmbedGroupId'] = defaultChunkEmbedGroupId;
                }

                chunkEmbedGroupId = this.state['chunkEmbedGroupId'];
                console.log(`chunkEmbedGroupId: ${chunkEmbedGroupId}`)

                if (query && query.length > 0 && chunkEmbedGroupId) {
                    console.log(`[BookViewer] Performing semantic search for "${query}"...`);
                    this.state['search_results'] = await performSemanticSearch(query, chunkEmbedGroupId);
                } else {
                    this.state['search_results'] = [];
                }
            } catch (error) {
                console.error('[BookViewer] perform-search effect failed:', error);
                throw error
            }
        });

        // Handle book selection change
        this.useEffect('handle-book-change', ['selected_book_name'], async (deps) => {
            try {
                const selectedBookName = deps['selected_book_name'];
                console.log(`[BookViewer] Book changed to: ${selectedBookName}`);

                if (selectedBookName) {
                    // Find the book info from available books
                    const availableBooks = this.props['availableBooks'] as BookInfo[];
                    const selectedBook = availableBooks.find((b: BookInfo) => b.bookName === selectedBookName);

                    if (selectedBook) {
                        // Update internal state with new book info
                        this.state['bookName'] = selectedBook.bookName;
                        this.state['bookId'] = selectedBook.id;
                        this.state['totalPages'] = selectedBook.pages;
                        this.state['current_page'] = 1; // Reset to first page

                        // Get default chunk embed group for search
                        const chunkEmbedGroupId = await getDefaultChunkEmbedGroup(selectedBook.id);
                        this.state['chunkEmbedGroupId'] = chunkEmbedGroupId;

                        // Load initial content
                        this.state['content'] = await fetchBookContent(selectedBook.id, 1);

                        // Update currentBook prop
                        this.props['currentBook'] = selectedBook;
                    }
                } else {
                    // Clear book info
                    this.state['bookName'] = null;
                    this.state['bookId'] = null;
                    this.state['totalPages'] = 0;
                    this.state['current_page'] = 1;
                    this.state['content'] = '';
                    this.state['chunkEmbedGroupId'] = null;
                    this.props['currentBook'] = null;
                }
            } catch (error) {
                console.error('[BookViewer] handle-book-change effect failed:', error);
            }
        });
    }

    render(): string {
        const { availableBooks, currentBook } = this.props;
        const { current_page, totalPages, bookName, content, search_query, search_results } = this.state;
        const selectedBook = this.state['selected_book_name'];

        // Render book selector list
        const bookList = availableBooks
            .map((book: BookInfo) => {
                const isSelected = book.bookName === selectedBook;
                const marker = isSelected ? '→ ' : '  ';
                return `${marker}${book.bookName} (${book.pages} pages)`;
            })
            .join('\n');

        // Render book viewer content
        let viewerContent = '';
        if (!currentBook && !bookName) {
            viewerContent = `
*No book selected. Please select a book first.*
            `;
        } else {
            viewerContent = `
**[selected_book_name](EDITABLE):** ${bookName || 'Unknown'}
**[current_page](EDITABLE):** ${current_page} / ${totalPages}

${content}

---
*Use 'current_page' editable status to navigate to different pages.*
            `;
        }

        // Render search results
        const resultsList = search_results.length > 0
            ? search_results.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')
            : '*No results*';

        return `
## 📖 Book Viewer

- [selected_book_name]: ${selectedBook ? `**${selectedBook}**` : '*None*'}
- [current_page]: ${current_page} / ${totalPages}

### Available books
${bookList}

### Book Content
${viewerContent}

### 🔍 Search
[search_query]: ${search_query || '*None*'}

-----Results-----
${resultsList}
        `;
    }
}

/**
 * WorkspaceInfo Component
 * Displays workspace information and status
 */
export class WorkspaceInfoComponent extends WorkspaceComponent {
    constructor() {
        super(
            'workspace_info',
            'WorkspaceInfo',
            'Displays workspace information and status',
            {},
            {}
        );

        // Register state
        this.state['lastUpdated'] = new Date().toISOString();
    }

    render(): string {
        const { lastUpdated } = this.state;
        const formattedDate = new Date(lastUpdated as string).toLocaleString();

        return `
## ℹ️ Workspace Information
**Last Updated:** ${formattedDate}

        `;
    }
}

