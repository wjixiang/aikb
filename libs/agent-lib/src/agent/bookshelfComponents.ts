/**
 * Bookshelf Workspace Components
 * React-like components for Bookshelf workspace
 */

import { z } from 'zod';
import { WorkspaceComponent, ComponentState, ComponentProps } from './componentTypes';
import { EditableProps } from './workspaceTypes';

export interface BookInfo {
    bookName: string;
    desc: string;
    pages: number;
}

const mocked_availiable_books_data: BookInfo[] = [
    {
        bookName: "Physiology",
        desc: "A comprehensive guide to human physiology, covering all major systems of human body including cardiovascular, respiratory, nervous, and digestive systems.",
        pages: 450
    },
    {
        bookName: "Anatomy",
        desc: "Detailed anatomical structures and relationships in human body, with illustrations and clinical correlations.",
        pages: 520
    },
    {
        bookName: "Biochemistry",
        desc: "Fundamental principles of biochemistry including metabolism, enzymes, and molecular biology.",
        pages: 380
    },
    {
        bookName: "Pharmacology",
        desc: "Introduction to pharmacological principles, drug actions, and therapeutic applications.",
        pages: 410
    }
];

/**
 * BookSelector Component
 * Allows LLM to select a book from available books
 */
export class BookSelectorComponent extends WorkspaceComponent {
    constructor() {
        super(
            'book_selector',
            'BookSelector',
            'Select a book from available books',
            {
                selected_book_name: {
                    value: null,
                    schema: z.string().nullable(),
                    description: 'Select a book to browse',
                    dependsOn: [],
                    readonly: false
                }
            } as Record<string, EditableProps>,
            {
                availableBooks: mocked_availiable_books_data
            }
        );

        // Register state
        this.state['selected_book_name'] = null as string | null;

        // Use useEffect for side effects instead of onUpdate
        this.useEffect('log-book-change', ['selected_book_name'], (deps) => {
            console.log(`[BookSelector] Book selected: ${deps['selected_book_name']}`);
        });
    }

    render(): string {
        const { availableBooks } = this.props;
        const selectedBook = this.state['selected_book_name'];

        const bookList = availableBooks
            .map((book: BookInfo) => {
                const isSelected = book.bookName === selectedBook;
                const marker = isSelected ? '→ ' : '  ';
                return `${marker}${book.bookName} (${book.pages} pages)`;
            })
            .join('\n');

        return `
## 📚 Book Selector
Current selection: ${selectedBook ? `**${selectedBook}**` : '*None*'}

Available books:
${bookList}
        `;
    }
}

/**
 * BookViewer Component
 * Displays selected book and allows page navigation
 */
export class BookViewerComponent extends WorkspaceComponent {
    constructor() {
        super(
            'book_viewer',
            'BookViewer',
            'View and navigate through pages of selected book',
            {
                current_page: {
                    value: 1,
                    schema: z.coerce.number().int().positive(),
                    description: 'Navigate to a specific page in the current book',
                    dependsOn: ['book_selector.selected_book_name'],
                    readonly: false
                }
            } as Record<string, EditableProps>,
            {
                currentBook: null as BookInfo | null
            }
        );

        // Register state
        this.state['current_page'] = 1;
        this.state['totalPages'] = 0;
        this.state['bookName'] = null as string | null;
        this.state['content'] = '';

        // Use useEffect for side effects
        this.useEffect('log-page-change', ['current_page'], (deps) => {
            console.log(`[BookViewer] Page changed to ${deps['current_page']}`);
        });

        // Load content when page changes
        this.useEffect('load-content', ['current_page'], (deps) => {
            this.state['content'] = `Content for page ${deps['current_page']}...`;
        });
    }

    render(): string {
        const { currentBook } = this.props;
        const { current_page, totalPages, bookName, content } = this.state;

        if (!bookName || !currentBook) {
            return `
## 📖 Book Viewer
*No book selected. Please select a book first.*
            `;
        }

        return `
## 📖 Book Viewer
**Book:** ${bookName}
**Page:** ${current_page} / ${totalPages}

${content}

---
*Use 'current_page' editable status to navigate to different pages.*
        `;
    }
}

/**
 * SearchComponent
 * Allows LLM to search for content in books
 */
export class SearchComponent extends WorkspaceComponent {
    constructor() {
        super(
            'search',
            'Search',
            'Search for content in books',
            {
                search_query: {
                    value: null,
                    schema: z.string().min(1).nullable(),
                    description: 'Search query to find content in books',
                    dependsOn: [],
                    readonly: false
                }
            } as Record<string, EditableProps>
        );

        // Register state
        this.state['search_query'] = null as string | null;
        this.state['results'] = [] as string[];

        // Use useEffect for side effects
        this.useEffect('log-query-change', ['search_query'], (deps) => {
            console.log(`[Search] Query changed to "${deps['search_query']}"`);
        });

        // Perform search when query changes
        this.useEffect('perform-search', ['search_query'], (deps) => {
            const query = deps['search_query'];
            if (query && query.length > 0) {
                this.state['results'] = [
                    `Result 1: Found "${query}" in Physiology, page 42`,
                    `Result 2: Found "${query}" in Anatomy, page 156`,
                    `Result 3: Found "${query}" in Biochemistry, page 89`
                ];
            } else {
                this.state['results'] = [];
            }
        });
    }

    render(): string {
        const { search_query, results } = this.state;

        const resultsList = results.length > 0
            ? results.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')
            : '*No results*';

        return `
## 🔍 Search
**Query:** ${search_query || '*None*'}

**Results:**
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
        );

        // Register state
        this.state['lastUpdated'] = new Date().toISOString();
    }

    render(): string {
        const { lastUpdated } = this.state;
        const { availableBooksCount, componentsCount } = this.props;
        const formattedDate = new Date(lastUpdated).toLocaleString();

        return `
## ℹ️ Workspace Information
**Last Updated:** ${formattedDate}

**Available Books:** ${availableBooksCount}
**Components:** ${componentsCount} (BookSelector, BookViewer, Search, WorkspaceInfo)
        `;
    }
}

/**
 * Get all Bookshelf workspace components
 */
export function getBookshelfComponents(): WorkspaceComponent[] {
    return [
        new WorkspaceInfoComponent(),
        new BookSelectorComponent(),
        new BookViewerComponent(),
        new SearchComponent()
    ];
}
