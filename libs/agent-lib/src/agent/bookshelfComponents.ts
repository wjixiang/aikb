/**
 * Bookshelf Workspace Components
 * React-like components for Bookshelf workspace
 */

import { z } from 'zod';
import { WorkspaceComponent, ComponentState, ComponentProps } from './componentTypes';
import { EditableStatus } from './workspaceTypes';

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
export const BookSelectorComponent: WorkspaceComponent = {
    id: 'book_selector',
    name: 'BookSelector',
    description: 'Select a book from available books',

    state: {
        selected_book_name: null as string | null  // Use same key as editableStatus
    },

    editableStatus: {
        selected_book_name: {
            value: null,
            schema: z.string().nullable(),
            description: 'Select a book to browse',
            dependsOn: [],
            readonly: false
        }
    },

    render: (props?: ComponentProps) => {
        const { availableBooks = mocked_availiable_books_data } = props || {};
        const selectedBook = BookSelectorComponent.state['selected_book_name'];

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
    },

    lifecycle: {
        onUpdate: (prevState: ComponentState) => {
            const newBook = BookSelectorComponent.state['selected_book_name'];
            const oldBook = prevState['selected_book_name'];
            console.log(`[BookSelector] Book changed from ${oldBook} to ${newBook}`);
        }
    },

    updateState: async (key: string, value: any) => {
        return { success: false, error: 'Not implemented', componentId: 'book_selector', updatedKey: key, previousValue: null, newValue: value, reRendered: false };
    },

    getState: () => ({ ...BookSelectorComponent.state })
};

/**
 * BookViewer Component
 * Displays selected book and allows page navigation
 */
export const BookViewerComponent: WorkspaceComponent = {
    id: 'book_viewer',
    name: 'BookViewer',
    description: 'View and navigate through pages of selected book',

    state: {
        current_page: 1,
        totalPages: 0,
        bookName: null as string | null,
        content: ''
    },

    editableStatus: {
        current_page: {
            value: 1,
            schema: z.coerce.number().int().positive(),
            description: 'Navigate to a specific page in the current book',
            dependsOn: ['book_selector.selected_book_name'],
            readonly: false
        }
    },

    render: (props?: ComponentProps) => {
        const { currentBook } = props || {};
        const { current_page, totalPages, bookName, content } = BookViewerComponent.state;

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
    },

    lifecycle: {
        onUpdate: async (prevState: ComponentState) => {
            const newPage = BookViewerComponent.state['current_page'];
            const oldPage = prevState['current_page'];
            console.log(`[BookViewer] Page changed from ${oldPage} to ${newPage}`);

            // Simulate loading content for the new page
            BookViewerComponent.state['content'] = `Content for page ${newPage}...`;
        }
    },

    updateState: async (key: string, value: any) => {
        return { success: false, error: 'Not implemented', componentId: 'book_viewer', updatedKey: key, previousValue: null, newValue: value, reRendered: false };
    },

    getState: () => ({ ...BookViewerComponent.state })
};

/**
 * SearchComponent
 * Allows LLM to search for content in books
 */
export const SearchComponent: WorkspaceComponent = {
    id: 'search',
    name: 'Search',
    description: 'Search for content in books',

    state: {
        search_query: null as string | null,
        results: [] as string[]
    },

    editableStatus: {
        search_query: {
            value: null,
            schema: z.string().min(1).nullable(),
            description: 'Search query to find content in books',
            dependsOn: [],
            readonly: false
        }
    },

    render: (props?: ComponentProps) => {
        const { search_query, results } = SearchComponent.state;

        const resultsList = results.length > 0
            ? results.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')
            : '*No results*';

        return `
## 🔍 Search
**Query:** ${search_query || '*None*'}

**Results:**
${resultsList}
        `;
    },

    lifecycle: {
        onUpdate: async (prevState: ComponentState) => {
            const newQuery = SearchComponent.state['search_query'];
            const oldQuery = prevState['search_query'];
            console.log(`[Search] Query changed from "${oldQuery}" to "${newQuery}"`);

            // Simulate search results
            if (newQuery && newQuery.length > 0) {
                SearchComponent.state['results'] = [
                    `Result 1: Found "${newQuery}" in Physiology, page 42`,
                    `Result 2: Found "${newQuery}" in Anatomy, page 156`,
                    `Result 3: Found "${newQuery}" in Biochemistry, page 89`
                ];
            } else {
                SearchComponent.state['results'] = [];
            }
        }
    },

    updateState: async (key: string, value: any) => {
        return { success: false, error: 'Not implemented', componentId: 'search', updatedKey: key, previousValue: null, newValue: value, reRendered: false };
    },

    getState: () => ({ ...SearchComponent.state })
};

/**
 * WorkspaceInfo Component
 * Displays workspace information and status
 */
export const WorkspaceInfoComponent: WorkspaceComponent = {
    id: 'workspace_info',
    name: 'WorkspaceInfo',
    description: 'Displays workspace information and status',

    state: {
        lastUpdated: new Date().toISOString()
    },

    editableStatus: {},

    render: (props?: ComponentProps) => {
        const { lastUpdated } = WorkspaceInfoComponent.state;
        const formattedDate = new Date(lastUpdated).toLocaleString();

        return `
## ℹ️ Workspace Information
**Last Updated:** ${formattedDate}

**Available Books:** ${mocked_availiable_books_data.length}
**Components:** 4 (BookSelector, BookViewer, Search, WorkspaceInfo)
        `;
    },

    lifecycle: {
        onUpdate: () => {
            WorkspaceInfoComponent.state['lastUpdated'] = new Date().toISOString();
        }
    },

    updateState: async (key: string, value: any) => {
        return { success: false, error: 'Not implemented', componentId: 'workspace_info', updatedKey: key, previousValue: null, newValue: value, reRendered: false };
    },

    getState: () => ({ ...WorkspaceInfoComponent.state })
};

/**
 * Get all Bookshelf workspace components
 */
export function getBookshelfComponents(): WorkspaceComponent[] {
    return [
        WorkspaceInfoComponent,
        BookSelectorComponent,
        BookViewerComponent,
        SearchComponent
    ];
}
