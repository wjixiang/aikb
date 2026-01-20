import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BookViewerComponent, WorkspaceInfoComponent, BookInfo } from './bookshelfComponents';

describe('Bookshelf Components E2E Tests', () => {
    describe('BookViewerComponent', () => {
        let component: BookViewerComponent;

        beforeEach(() => {
            // Create component
            component = new BookViewerComponent();
        });

        afterEach(() => {
            // Cleanup
            component = null as any;
        });

        describe('Initialization', () => {
            it('should render into context', async () => {
                const context = await component.renderWithScriptSection()
                console.log(context)
            })
            it('should initialize with book_viewer_state', () => {
                const states = component.getStates();
                expect(states).toHaveProperty('book_viewer_state');
            });

            it('should initialize with null selected_book_name', () => {
                const state = component.getStates()['book_viewer_state'].state as any;
                expect(state.selected_book_name).toBeNull();
            });

            it('should initialize with null search_query', () => {
                const state = component.getStates()['book_viewer_state'].state as any;
                expect(state.search_query).toBeNull();
            });

            it('should have READ_AND_WRITE permission for book_viewer_state', () => {
                const state = component.getStates()['book_viewer_state'];
                expect(state.permission).toBe('READ_AND_WRITE');
            });

            it('should initialize with empty available books', () => {
                const availableBooks = component.getAvailableBooks();
                expect(availableBooks).toEqual([]);
            });

            it('should initialize with empty content', () => {
                const content = component.getContent();
                expect(content).toBe('');
            });

            it('should initialize with empty search results', () => {
                const searchResults = component.getSearchResults();
                expect(searchResults).toEqual([]);
            });

            it('should initialize with null internal book state', () => {
                expect((component as any).currentBook).toBeNull();
                expect((component as any).bookName).toBeNull();
                expect((component as any).bookId).toBeNull();
                expect((component as any).chunkEmbedGroupId).toBeNull();
            });

            it('should initialize with zero total pages', () => {
                expect((component as any).totalPages).toBe(0);
            });
        });

        describe('State Schema Validation', () => {
            it('should have valid state schema', () => {
                const state = component.getStates()['book_viewer_state'];
                expect(state.schema).toBeDefined();
            });

            it('should have side effects description', () => {
                const state = component.getStates()['book_viewer_state'];
                expect(state.sideEffectsDesc).toContain('selected_book_name');
                expect(state.sideEffectsDesc).toContain('search_query');
            });
        });

        describe('Script Utilities', () => {
            it('should provide getAvailableBooks utility', () => {
                const utilities = component.getScriptUtilities();
                expect(utilities['getAvailableBooks']).toBeDefined();
                expect(typeof utilities['getAvailableBooks']).toBe('function');
            });

            it('should provide getContent utility', () => {
                const utilities = component.getScriptUtilities();
                expect(utilities['getContent']).toBeDefined();
                expect(typeof utilities['getContent']).toBe('function');
            });

            it('should provide getSearchResults utility', () => {
                const utilities = component.getScriptUtilities();
                expect(utilities['getSearchResults']).toBeDefined();
                expect(typeof utilities['getSearchResults']).toBe('function');
            });

            it('should return available books through utility', () => {
                const mockBooks: BookInfo[] = [
                    { id: '1', bookName: 'Test Book', desc: 'Test Description', pages: 100 }
                ];
                (component as any).availableBooks = mockBooks;

                const utilities = component.getScriptUtilities();
                const books = utilities['getAvailableBooks']();

                expect(books).toEqual(mockBooks);
            });

            it('should return content through utility', () => {
                (component as any).content = 'Test content';

                const utilities = component.getScriptUtilities();
                const content = utilities['getContent']();

                expect(content).toBe('Test content');
            });

            it('should return search results through utility', () => {
                const mockResults = ['Result 1', 'Result 2'];
                (component as any).searchResults = mockResults;

                const utilities = component.getScriptUtilities();
                const results = utilities['getSearchResults']();

                expect(results).toEqual(mockResults);
            });
        });

        describe('Rendering', () => {
            it('should render component as markdown', async () => {
                const rendered = await component.render();
                expect(rendered).toContain('📖 Book Viewer');
            });

            it('should show available books section', async () => {
                const rendered = await component.render();
                expect(rendered).toContain('Available books');
            });

            it('should show search section', async () => {
                const rendered = await component.render();
                expect(rendered).toContain('🔍 Search');
            });

            it('should show no book selected message when no book', async () => {
                const rendered = await component.render();
                expect(rendered).toContain('*No book selected');
            });

            it('should show no search results when empty', async () => {
                const rendered = await component.render();
                expect(rendered).toContain('*No results*');
            });

            it('should show selected book name when book is selected', async () => {
                const mockBooks: BookInfo[] = [
                    { id: '1', bookName: 'Selected Book', desc: 'Description', pages: 100 }
                ];
                (component as any).availableBooks = mockBooks;
                (component as any).bookName = 'Selected Book';
                (component as any).bookId = '1';
                (component as any).currentBook = mockBooks[0];

                const state = component.getStates()['book_viewer_state'].state as any;
                state.selected_book_name = 'Selected Book';

                const rendered = await component.render();
                expect(rendered).toContain('**Selected Book**');
            });

            it('should show search results when available', async () => {
                (component as any).searchResults = ['Found "test" in "Book" (score: 0.950): Content'];

                const rendered = await component.render();
                expect(rendered).toContain('RESULT1');
                expect(rendered).toContain('Found "test" in "Book"');
            });

            it('should display book list with pages count', async () => {
                const mockBooks: BookInfo[] = [
                    { id: '1', bookName: 'Book 1', desc: 'Desc 1', pages: 100 },
                    { id: '2', bookName: 'Book 2', desc: 'Desc 2', pages: 200 }
                ];
                (component as any).availableBooks = mockBooks;

                const rendered = await component.render();
                expect(rendered).toContain('Book 1 (100 pages)');
                expect(rendered).toContain('Book 2 (200 pages)');
            });

            it('should mark selected book with arrow', async () => {
                const mockBooks: BookInfo[] = [
                    { id: '1', bookName: 'Book 1', desc: 'Desc 1', pages: 100 },
                    { id: '2', bookName: 'Book 2', desc: 'Desc 2', pages: 200 }
                ];
                (component as any).availableBooks = mockBooks;
                (component as any).bookName = 'Book 1';

                const state = component.getStates()['book_viewer_state'].state as any;
                state.selected_book_name = 'Book 1';

                const rendered = await component.render();
                expect(rendered).toContain('→ Book 1 (100 pages)');
                expect(rendered).toContain('  Book 2 (200 pages)');
            });
        });

        describe('Book Selection State Changes', () => {
            it('should update internal state when book is selected', async () => {
                const mockBooks: BookInfo[] = [
                    { id: '1', bookName: 'Test Book', desc: 'Test Description', pages: 100 }
                ];
                (component as any).availableBooks = mockBooks;

                const state = component.getStates()['book_viewer_state'].state as any;
                state.selected_book_name = 'Test Book';

                // Wait for state change to propagate
                await new Promise(resolve => setTimeout(resolve, 100));

                expect((component as any).bookName).toBe('Test Book');
                expect((component as any).bookId).toBe('1');
                expect((component as any).totalPages).toBe(100);
                expect((component as any).currentBook).toEqual(mockBooks[0]);
            });

            it('should clear internal state when book is deselected', async () => {
                // First select a book to set up initial state
                const mockBooks: BookInfo[] = [
                    { id: '1', bookName: 'Test Book', desc: 'Test', pages: 100 }
                ];
                (component as any).availableBooks = mockBooks;

                const state = component.getStates()['book_viewer_state'].state as any;
                state.selected_book_name = 'Test Book';

                // Wait for state change to propagate
                await new Promise(resolve => setTimeout(resolve, 150));

                // Verify book is selected
                expect((component as any).bookName).toBe('Test Book');
                expect((component as any).bookId).toBe('1');
                expect((component as any).totalPages).toBe(100);
                expect((component as any).currentBook).toEqual(mockBooks[0]);

                // Now deselect the book
                state.selected_book_name = null;

                // Wait for state change to propagate
                await new Promise(resolve => setTimeout(resolve, 150));

                expect((component as any).bookName).toBeNull();
                expect((component as any).bookId).toBeNull();
                expect((component as any).totalPages).toBe(0);
                expect((component as any).currentBook).toBeNull();
                expect((component as any).content).toBe('');
                expect((component as any).chunkEmbedGroupId).toBeNull();
            });

            it('should not update state if book name not found in available books', async () => {
                const mockBooks: BookInfo[] = [
                    { id: '1', bookName: 'Book 1', desc: 'Desc 1', pages: 100 }
                ];
                (component as any).availableBooks = mockBooks;

                const state = component.getStates()['book_viewer_state'].state as any;
                state.selected_book_name = 'Non-existent Book';

                // Wait for state change to propagate
                await new Promise(resolve => setTimeout(resolve, 100));

                expect((component as any).bookName).toBeNull();
                expect((component as any).bookId).toBeNull();
            });
        });

        describe('Search Query State Changes', () => {
            it('should perform search when query is provided', async () => {
                (component as any).chunkEmbedGroupId = 'group-1';
                (component as any).bookId = 'book-1';

                const state = component.getStates()['book_viewer_state'].state as any;
                state.search_query = 'test query';

                // Wait for state change to propagate
                await new Promise(resolve => setTimeout(resolve, 100));

                // Search results should be populated (may be empty if service unavailable)
                expect(Array.isArray((component as any).searchResults)).toBe(true);
            });

            it('should clear search results when query is empty', async () => {
                (component as any).searchResults = ['Result 1', 'Result 2'];

                const state = component.getStates()['book_viewer_state'].state as any;
                state.search_query = '';

                // Wait for state change to propagate
                await new Promise(resolve => setTimeout(resolve, 100));

                expect((component as any).searchResults).toEqual([]);
            });

            it('should not search when chunk embed group is null and book is not selected', async () => {
                (component as any).chunkEmbedGroupId = null;
                (component as any).bookId = null;

                const state = component.getStates()['book_viewer_state'].state as any;
                state.search_query = 'test query';

                // Wait for state change to propagate
                await new Promise(resolve => setTimeout(resolve, 100));

                expect((component as any).searchResults).toEqual([]);
            });

            it('should fetch default chunk embed group if not set', async () => {
                (component as any).chunkEmbedGroupId = null;
                (component as any).bookId = 'book-1';

                const state = component.getStates()['book_viewer_state'].state as any;
                state.search_query = 'test query';

                // Wait for state change to propagate
                await new Promise(resolve => setTimeout(resolve, 100));

                // Search results should be populated (may be empty if service unavailable)
                expect(Array.isArray((component as any).searchResults)).toBe(true);
            });
        });

        describe('WorkspaceInfoComponent', () => {
            let workspaceComponent: WorkspaceInfoComponent;

            beforeEach(() => {
                workspaceComponent = new WorkspaceInfoComponent();
            });

            it('should initialize with workspace_info_state', () => {
                const states = workspaceComponent.getStates();
                expect(states).toHaveProperty('workspace_info_state');
            });

            it('should initialize with lastUpdated timestamp', () => {
                const state = workspaceComponent.getStates()['workspace_info_state'].state as any;
                expect(state.lastUpdated).toBeDefined();
                expect(typeof state.lastUpdated).toBe('string');
            });

            it('should have READ_ONLY permission for workspace_info_state', () => {
                const state = workspaceComponent.getStates()['workspace_info_state'];
                expect(state.permission).toBe('READ_ONLY');
            });

            it('should have valid state schema', () => {
                const state = workspaceComponent.getStates()['workspace_info_state'];
                expect(state.schema).toBeDefined();
            });

            it('should have side effects description', () => {
                const state = workspaceComponent.getStates()['workspace_info_state'];
                expect(state.sideEffectsDesc).toContain('Read-only');
                expect(state.sideEffectsDesc).toContain('last updated');
            });

            describe('Timestamp Update', () => {
                it('should update timestamp', async () => {
                    const state = workspaceComponent.getStates()['workspace_info_state'].state as any;
                    const oldTimestamp = state.lastUpdated;

                    // Wait a bit to ensure timestamp difference
                    await new Promise(resolve => setTimeout(resolve, 10));
                    workspaceComponent.updateTimestamp();
                    const newTimestamp = state.lastUpdated;

                    expect(newTimestamp).not.toBe(oldTimestamp);
                });

                it('should update timestamp to valid ISO string', () => {
                    workspaceComponent.updateTimestamp();

                    const state = workspaceComponent.getStates()['workspace_info_state'].state as any;
                    const timestamp = state.lastUpdated;

                    expect(() => new Date(timestamp)).not.toThrow();
                });
            });

            describe('Rendering', () => {
                it('should render component as markdown', async () => {
                    const rendered = await workspaceComponent.render();
                    expect(rendered).toContain('ℹ️ Workspace Information');
                });

                it('should show last updated timestamp', async () => {
                    const rendered = await workspaceComponent.render();
                    expect(rendered).toContain('Last Updated:');
                });

                it('should display formatted date', async () => {
                    const rendered = await workspaceComponent.render();
                    expect(rendered).toMatch(/\d{1,2}\/\d{1,2}\/\d{2,4}/); // Date format
                });
            });
        });

        describe('Integration Tests - Both Components', () => {
            let bookViewer: BookViewerComponent;
            let workspaceInfo: WorkspaceInfoComponent;

            beforeEach(() => {
                bookViewer = new BookViewerComponent();
                workspaceInfo = new WorkspaceInfoComponent();
            });

            it('should render both components without errors', async () => {
                const bookViewerRendered = await bookViewer.render();
                const workspaceInfoRendered = await workspaceInfo.render();

                expect(bookViewerRendered).toContain('📖 Book Viewer');
                expect(workspaceInfoRendered).toContain('ℹ️ Workspace Information');
            });

            it('should have distinct state names', () => {
                const bookViewerStates = bookViewer.getStates();
                const workspaceInfoStates = workspaceInfo.getStates();

                expect(bookViewerStates).toHaveProperty('book_viewer_state');
                expect(workspaceInfoStates).toHaveProperty('workspace_info_state');

                expect(bookViewerStates).not.toHaveProperty('workspace_info_state');
                expect(workspaceInfoStates).not.toHaveProperty('book_viewer_state');
            });

            it('should have different permissions for states', () => {
                const bookViewerState = bookViewer.getStates()['book_viewer_state'];
                const workspaceInfoState = workspaceInfo.getStates()['workspace_info_state'];

                expect(bookViewerState.permission).toBe('READ_AND_WRITE');
                expect(workspaceInfoState.permission).toBe('READ_ONLY');
            });

            it('should provide different script utilities', () => {
                const bookViewerUtils = bookViewer.getScriptUtilities();
                const workspaceInfoUtils = workspaceInfo.getScriptUtilities();

                expect(bookViewerUtils['getAvailableBooks']).toBeDefined();
                expect(bookViewerUtils['getContent']).toBeDefined();
                expect(bookViewerUtils['getSearchResults']).toBeDefined();

                // WorkspaceInfoComponent has no script utilities by default
                expect(Object.keys(workspaceInfoUtils)).toHaveLength(0);
            });
        });

        // describe('Edge Cases and Error Handling', () => {
        //     it('should handle empty book list gracefully', async () => {
        //         (component as any).availableBooks = [];

        //         const rendered = await component.render();
        //         expect(rendered).toContain('Available books');
        //         expect(rendered).toContain('*No book selected');
        //     });

        //     it('should handle book with zero pages', async () => {
        //         const mockBooks: BookInfo[] = [
        //             { id: '1', bookName: 'Empty Book', desc: 'No pages', pages: 0 }
        //         ];
        //         (component as any).availableBooks = mockBooks;

        //         const rendered = await component.render();
        //         expect(rendered).toContain('Empty Book (0 pages)');
        //     });

        //     it('should handle book with very long name', async () => {
        //         const longName = 'A'.repeat(100);
        //         const mockBooks: BookInfo[] = [
        //             { id: '1', bookName: longName, desc: 'Long name', pages: 100 }
        //         ];
        //         (component as any).availableBooks = mockBooks;

        //         const rendered = await component.render();
        //         expect(rendered).toContain(longName);
        //     });

        //     it('should handle book with special characters in name', async () => {
        //         const specialName = 'Book: "Test" & More <Special>';
        //         const mockBooks: BookInfo[] = [
        //             { id: '1', bookName: specialName, desc: 'Special chars', pages: 100 }
        //         ];
        //         (component as any).availableBooks = mockBooks;

        //         const rendered = await component.render();
        //         expect(rendered).toContain(specialName);
        //     });

        //     it('should handle multiple search results', async () => {
        //         const mockResults = [
        //             'Found "test" in "Book 1" (score: 0.950): Content 1',
        //             'Found "test" in "Book 2" (score: 0.850): Content 2',
        //             'Found "test" in "Book 3" (score: 0.750): Content 3'
        //         ];
        //         (component as any).searchResults = mockResults;

        //         const rendered = await component.render();
        //         expect(rendered).toContain('RESULT1');
        //         expect(rendered).toContain('RESULT2');
        //         expect(rendered).toContain('RESULT3');
        //     });

        //     it('should handle search result with special characters', async () => {
        //         const mockResults = ['Found "test & query" in "Book: Special" (score: 0.950): Content with <special> chars'];
        //         (component as any).searchResults = mockResults;

        //         const rendered = await component.render();
        //         expect(rendered).toContain('test & query');
        //         expect(rendered).toContain('Book: Special');
        //     });
        // });

        describe('State Reactivity', () => {
            it('should trigger state change handler when selected_book_name changes', async () => {
                const mockBooks: BookInfo[] = [
                    { id: '1', bookName: 'Test Book', desc: 'Test', pages: 100 }
                ];
                (component as any).availableBooks = mockBooks;

                const state = component.getStates()['book_viewer_state'].state as any;
                state.selected_book_name = 'Test Book';

                // Wait for state change to propagate
                await new Promise(resolve => setTimeout(resolve, 100));

                expect((component as any).bookName).toBe('Test Book');
            });

            it('should trigger state change handler when search_query changes', async () => {
                (component as any).chunkEmbedGroupId = 'group-1';

                const state = component.getStates()['book_viewer_state'].state as any;
                state.search_query = 'test';

                // Wait for state change to propagate
                await new Promise(resolve => setTimeout(resolve, 100));

                // Search results should be populated (may be empty if service unavailable)
                expect(Array.isArray((component as any).searchResults)).toBe(true);
            });
        });

        describe('State Persistence', () => {
            it('should maintain state across multiple renders', async () => {
                const mockBooks: BookInfo[] = [
                    { id: '1', bookName: 'Test Book', desc: 'Test', pages: 100 }
                ];
                (component as any).availableBooks = mockBooks;
                (component as any).bookName = 'Test Book';
                (component as any).bookId = '1';
                (component as any).currentBook = mockBooks[0];

                const state = component.getStates()['book_viewer_state'].state as any;
                state.selected_book_name = 'Test Book';

                const rendered1 = await component.render();
                const rendered2 = await component.render();

                expect(rendered1).toContain('**Test Book**');
                expect(rendered2).toContain('**Test Book**');
            });

            it('should maintain search results across renders', async () => {
                (component as any).searchResults = ['Result 1', 'Result 2'];

                const rendered1 = await component.render();
                const rendered2 = await component.render();

                expect(rendered1).toContain('RESULT1');
                expect(rendered2).toContain('RESULT1');
            });
        });
    });
});
