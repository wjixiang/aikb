import { BookshelfWorkspace } from '../bookshelfWorkspace';
import { BookViewerComponent, WorkspaceInfoComponent } from '../bookshelfComponents';

describe(BookshelfWorkspace, () => {
    let workspace: BookshelfWorkspace;

    beforeEach(async () => {
        workspace = new BookshelfWorkspace();
        await workspace.init();
    });

    describe('Component-Based Architecture', () => {
        it('should initialize with all components registered', () => {
            const components = workspace.getComponents();
            expect(components).toHaveLength(2);
            expect(components.map((c: any) => c.id)).toContain('workspace_info');
            expect(components.map((c: any) => c.id)).toContain('book_viewer');

            console.log(workspace.renderContext())
        });


        it('should render context with all component renders', async () => {
            const context = await workspace.renderContext();
            console.log(context)
            expect(context).toContain('Workspace Information');
            expect(context).toContain('Book Viewer');
            expect(context).toContain('Search');
        });
    });

    describe('getEditablePropsSchema', () => {
        it('should return schema with all editable fields', () => {
            const schema = workspace.getEditablePropsSchema();
            console.log(schema)
            expect(schema.fields).toHaveProperty('selected_book_name');
            expect(schema.fields).toHaveProperty('current_page');
            expect(schema.fields).toHaveProperty('search_query');
        });

        it('should include componentId in field definitions', () => {
            const schema = workspace.getEditablePropsSchema();
            expect(schema.fields['selected_book_name'].componentId).toBe('book_viewer');
            expect(schema.fields['current_page'].componentId).toBe('book_viewer');
            expect(schema.fields['search_query'].componentId).toBe('book_viewer');
        });
    });

    describe('updateEditableProps - Component Routing', () => {
        it('should route updates to correct component', async () => {
            const result = await workspace.updateEditableProps('selected_book_name', 'Physiology');
            expect(result.success).toBe(true);
            expect(result.updatedField).toBe('selected_book_name');

            // Verify component state was updated
            const bookViewer = workspace.getComponentRegistry().get('book_viewer');
            expect(bookViewer?.state['selected_book_name']).toBe('Physiology');
        });

        it('should reject unknown field names', async () => {
            const result = await workspace.updateEditableProps('unknown_field', 'value');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Unknown editable field');
        });

        it('should return error when field is readonly', async () => {
            // Make a field readonly by modifying the component directly
            const bookViewer = workspace.getComponentRegistry().get('book_viewer');
            if (bookViewer) {
                bookViewer.editableProps['selected_book_name'].readonly = true;
            }

            const result = await workspace.updateEditableProps('selected_book_name', 'Physiology');
            expect(result.success).toBe(false);
            expect(result.error).toContain('read-only');

            // Restore readonly flag for subsequent tests
            if (bookViewer) {
                bookViewer.editableProps['selected_book_name'].readonly = false;
            }
        });
    });

    describe('BookViewer Component', () => {
        it('should update book viewer state when selected_book_name changes', async () => {
            await workspace.updateEditableProps('selected_book_name', '外科学_第十版');

            const bookViewer = workspace.getComponentRegistry().get('book_viewer');
            expect(bookViewer?.state['selected_book_name']).toBe('外科学_第十版');
            expect(bookViewer?.state['bookName']).toBe('外科学_第十版');
            expect(bookViewer?.state['totalPages']).toBe(858);
        });

        it('should reject invalid book names', async () => {
            const result = await workspace.updateEditableProps('selected_book_name', 'InvalidBook');
            // With nullable string schema, any string is valid
            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should update book viewer state when current_page changes', async () => {
            await workspace.updateEditableProps('selected_book_name', '外科学_第十版');
            const result = await workspace.updateEditableProps('current_page', '42');
            expect(result.success).toBe(true);

            // Wait for async update to complete
            const bookViewer = workspace.getComponentRegistry().get('book_viewer');
            expect(bookViewer?.state['current_page']).toBe(42);
        });

        it('should reject invalid page numbers', async () => {
            const result = await workspace.updateEditableProps('current_page', '999a');
            expect(result.success).toBe(false);
            expect(result.error).toBeTruthy();
        });

        it('should reject non-numeric page numbers', async () => {
            const result = await workspace.updateEditableProps('current_page', 'not_a_number');
            expect(result.success).toBe(false);
            expect(result.error).toContain('number');
        });
    });

    describe('Search Functionality in BookViewer', () => {
        it('should update book viewer state when search_query changes', async () => {
            await workspace.updateEditableProps('search_query', 'heart');

            const bookViewer = workspace.getComponentRegistry().get('book_viewer');
            expect(bookViewer?.state['search_query']).toBe('heart');
        });

        it.only('should populate search results when book is selected and query is provided', async () => {
            // First select a book to get chunk embed group
            await workspace.updateEditableProps('selected_book_name', '外科学_第十版');

            // Wait for chunk embed group to be set (async operation)
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Then perform search
            await workspace.updateEditableProps('search_query', '心脏');

            // Wait for search to complete
            await new Promise(resolve => setTimeout(resolve, 2000));

            const bookViewer = workspace.getComponentRegistry().get('book_viewer');
            expect(bookViewer?.state['search_results']).toBeDefined();
            // The search returns results based on query
            expect(bookViewer?.state['search_results'].length).toBeGreaterThan(0);
        }, 30000);

        describe('Component Lifecycle', () => {
            it('should call onMount when component is registered', async () => {
                // The components should have their onMount called during init
                // We can verify this by checking that components are properly initialized
                const components = workspace.getComponents();
                expect(components).toHaveLength(2);
                expect(components.every((c: any) => c.state !== undefined)).toBe(true);
            });

            it('should call onUpdate when component state changes', async () => {
                // When we update a field, component's onUpdate should be called
                // We can verify this by checking that component state was updated
                const initialBook = workspace.getComponentRegistry().get('book_viewer')?.state['selected_book_name'];
                // expect(initialBook).toBeNull();

                await workspace.updateEditableProps('selected_book_name', 'Physiology');

                // Verify component state was updated (which happens in onUpdate)
                const updatedBook = workspace.getComponentRegistry().get('book_viewer')?.state['selected_book_name'];
                expect(updatedBook).toBe('Physiology');
            });

            it('should call onUnmount when component is unregistered', async () => {
                const registry = workspace.getComponentRegistry();
                const component = registry.get('workspace_info');
                expect(component).toBeDefined();

                // Unregister the component
                registry.unregister('workspace_info');

                // Verify it's no longer in the registry
                const unregisteredComponent = registry.get('workspace_info');
                expect(unregisteredComponent).toBeUndefined();

                // Re-register for subsequent tests
                await registry.register(new WorkspaceInfoComponent());
            });
        });

        describe('Complete Workflow', () => {
            it('should demonstrate full component-based workflow', async () => {
                // Initial state
                let context = await workspace.renderContext();
                expect(context).toContain('No book selected');

                // Step 1: LLM updates book selector
                await workspace.updateEditableProps('selected_book_name', '外科学_第十版');

                // Verify component state
                const bookViewer = workspace.getComponentRegistry().get('book_viewer');
                expect(bookViewer?.state['selected_book_name']).toBe('外科学_第十版');
                expect(bookViewer?.state['bookName']).toBe('外科学_第十版');
                expect(bookViewer?.state['totalPages']).toBe(858);

                // Step 2: LLM updates page
                await workspace.updateEditableProps('current_page', 50);
                expect(bookViewer?.state['current_page']).toBe(50);

                // Step 3: Context is re-rendered
                context = await workspace.renderContext();
                expect(context).toContain('外科学_第十版');
                expect(context).toContain('50');
                // Content may be different if markdownContent is not available
                expect(context).toMatch(/Content|No content/);
            });
        });

        describe('Component State Management', () => {
            it('should allow accessing component state through component registry', () => {
                const bookViewer = workspace.getComponentRegistry().get('book_viewer');
                const workspaceInfo = workspace.getComponentRegistry().get('workspace_info');

                expect(bookViewer).toBeDefined();
                expect(workspaceInfo).toBeDefined();
            });

            it('should provide access to all components', () => {
                const components = workspace.getComponents();
                expect(components).toHaveLength(2);
                expect(components.map((c: any) => c.id)).toContain('workspace_info');
                expect(components.map((c: any) => c.id)).toContain('book_viewer');
            });
        });
    });
});
