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
            }
        } as Record<string, EditableProps>;

        super(
            'book_viewer',
            'BookViewer',
            'View and navigate through pages of selected book',
            editableProps,
            {
                availableBooks: mocked_availiable_books_data,
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

        // Handle book selection change
        this.useEffect('handle-book-change', ['selected_book_name'], (deps) => {
            const selectedBookName = deps['selected_book_name'];
            console.log(`[BookViewer] Book changed to: ${selectedBookName}`);

            if (selectedBookName) {
                // Find the book info from available books
                const availableBooks = this.props['availableBooks'] as BookInfo[];
                const selectedBook = availableBooks.find((b: BookInfo) => b.bookName === selectedBookName);

                if (selectedBook) {
                    // Update internal state with new book info
                    this.state['bookName'] = selectedBook.bookName;
                    this.state['totalPages'] = selectedBook.pages;
                    this.state['current_page'] = 1; // Reset to first page
                    this.state['content'] = `Content for page 1 of ${selectedBook.bookName}...`;

                    // Update currentBook prop
                    this.props['currentBook'] = selectedBook;
                }
            } else {
                // Clear book info
                this.state['bookName'] = null;
                this.state['totalPages'] = 0;
                this.state['current_page'] = 1;
                this.state['content'] = '';
                this.props['currentBook'] = null;
            }
        });
    }

    render(): string {
        const { availableBooks, currentBook } = this.props;
        const { current_page, totalPages, bookName, content } = this.state;
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

        return `
## 📖 Book Viewer

- [selected_book_name]: ${selectedBook ? `**${selectedBook}**` : '*None*'}
- [current_page]: ${current_page} / ${totalPages}

### Available books
${bookList}

### Book Content
${viewerContent}
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
            } as Record<string, EditableProps>,
            {}
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

