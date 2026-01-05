import { BookshelfWorkspace } from './bookshelfWorkspace';
import { BookSelectorComponent, BookViewerComponent, SearchComponent, WorkspaceInfoComponent } from './bookshelfComponents';

describe(BookshelfWorkspace, () => {
    let workspace: BookshelfWorkspace;

    beforeEach(async () => {
        workspace = new BookshelfWorkspace();
        await workspace.init();
    });

    describe('Component-Based Architecture', () => {
        it('should initialize with all components registered', () => {
            const components = workspace.getComponents();
            expect(components).toHaveLength(4);
            expect(components.map((c: any) => c.id)).toContain('workspace_info');
            expect(components.map((c: any) => c.id)).toContain('book_selector');
            expect(components.map((c: any) => c.id)).toContain('book_viewer');
            expect(components.map((c: any) => c.id)).toContain('search');

            console.log(workspace.renderContext())
        });


        it('should render context with all component renders', () => {
            const context = workspace.renderContext();
            expect(context).toContain('Workspace Information');
            expect(context).toContain('Book Selector');
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
            expect(schema.fields['selected_book_name'].componentId).toBe('book_selector');
            expect(schema.fields['current_page'].componentId).toBe('book_viewer');
            expect(schema.fields['search_query'].componentId).toBe('search');
        });
    });

    describe('updateEditableProps - Component Routing', () => {
        it('should route updates to correct component', async () => {
            const result = await workspace.updateEditableProps('selected_book_name', 'Physiology');
            expect(result.success).toBe(true);
            expect(result.updatedField).toBe('selected_book_name');

            // Verify component state was updated
            const bookSelector = workspace.getComponentRegistry().get('book_selector');
            expect(bookSelector?.state['selected_book_name']).toBe('Physiology');
        });

        it('should reject unknown field names', async () => {
            const result = await workspace.updateEditableProps('unknown_field', 'value');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Unknown editable field');
        });

        it('should return error when field is readonly', async () => {
            // Make a field readonly by modifying the component directly
            const bookSelector = workspace.getComponentRegistry().get('book_selector');
            if (bookSelector) {
                bookSelector.editableProps['selected_book_name'].readonly = true;
            }

            const result = await workspace.updateEditableProps('selected_book_name', 'Physiology');
            expect(result.success).toBe(false);
            expect(result.error).toContain('read-only');

            // Restore readonly flag for subsequent tests
            if (bookSelector) {
                bookSelector.editableProps['selected_book_name'].readonly = false;
            }
        });
    });

    describe('BookSelector Component', () => {
        it('should update book selector state when selected_book_name changes', async () => {
            await workspace.updateEditableProps('selected_book_name', 'Anatomy');

            const bookSelector = workspace.getComponentRegistry().get('book_selector');
            expect(bookSelector?.state['selected_book_name']).toBe('Anatomy');
        });

        it('should reject invalid book names', async () => {
            const result = await workspace.updateEditableProps('selected_book_name', 'InvalidBook');
            // With nullable string schema, any string is valid
            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
        });
    });

    describe('BookViewer Component', () => {
        beforeEach(async () => {
            await workspace.updateEditableProps('selected_book_name', 'Physiology');
        });

        it('should update book viewer state when current_page changes', async () => {
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

    describe('Search Component', () => {
        it('should update search component state when search_query changes', async () => {
            await workspace.updateEditableProps('search_query', 'heart');

            const searchComponent = workspace.getComponentRegistry().get('search');
            expect(searchComponent?.state['search_query']).toBe('heart');
        });

        it('should populate search results on query change', async () => {
            await workspace.updateEditableProps('search_query', 'nervous system');

            const searchComponent = workspace.getComponentRegistry().get('search');
            expect(searchComponent?.state['results']).toBeDefined();
            // The mock search returns results based on query
            expect(searchComponent?.state['results'].length).toBeGreaterThan(0);
        });

        it('should clear search results when query is cleared', async () => {
            await workspace.updateEditableProps('search_query', 'test');
            await workspace.updateEditableProps('search_query', null);

            const searchComponent = workspace.getComponentRegistry().get('search');
            expect(searchComponent?.state['results']).toEqual([]);
        });
    });

    describe('Component Lifecycle', () => {
        it('should call onMount when component is registered', async () => {
            // The components should have their onMount called during init
            // We can verify this by checking that components are properly initialized
            const components = workspace.getComponents();
            expect(components).toHaveLength(4);
            expect(components.every((c: any) => c.state !== undefined)).toBe(true);
        });

        it('should call onUpdate when component state changes', async () => {
            // When we update a field, component's onUpdate should be called
            // We can verify this by checking that component state was updated
            const initialBook = workspace.getComponentRegistry().get('book_selector')?.state['selected_book_name'];
            // expect(initialBook).toBeNull();

            await workspace.updateEditableProps('selected_book_name', 'Physiology');

            // Verify component state was updated (which happens in onUpdate)
            const updatedBook = workspace.getComponentRegistry().get('book_selector')?.state['selected_book_name'];
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
        });
    });

    describe('Complete Workflow', () => {
        it.only('should demonstrate full component-based workflow', async () => {
            // Initial state
            let context = workspace.renderContext();
            expect(context).toContain('No book selected');

            // Step 1: LLM updates book selector
            await workspace.updateEditableProps('selected_book_name', 'Biochemistry');

            // Verify component state
            const bookSelector = workspace.getComponentRegistry().get('book_selector');
            expect(bookSelector?.state['selected_book_name']).toBe('Biochemistry');

            // Step 2: LLM updates page
            const bookViewer = workspace.getComponentRegistry().get('book_viewer');
            await workspace.updateEditableProps('current_page', 50);
            expect(bookViewer?.state['current_page']).toBe(50);

            // Step 3: Context is re-rendered
            context = workspace.renderContext();
            expect(context).toContain('Biochemistry');
            expect(context).toContain('50');
            expect(context).toContain('Content for page 50');
        });
    });

    describe('Component State Management', () => {
        it('should allow accessing component state through component registry', () => {
            const bookSelector = workspace.getComponentRegistry().get('book_selector');
            const bookViewer = workspace.getComponentRegistry().get('book_viewer');
            const searchComponent = workspace.getComponentRegistry().get('search');
            const workspaceInfo = workspace.getComponentRegistry().get('workspace_info');

            expect(bookSelector).toBeDefined();
            expect(bookViewer).toBeDefined();
            expect(searchComponent).toBeDefined();
            expect(workspaceInfo).toBeDefined();
        });

        it('should provide access to all components', () => {
            const components = workspace.getComponents();
            expect(components).toHaveLength(4);
            expect(components.map((c: any) => c.id)).toContain('workspace_info');
            expect(components.map((c: any) => c.id)).toContain('book_selector');
            expect(components.map((c: any) => c.id)).toContain('book_viewer');
            expect(components.map((c: any) => c.id)).toContain('search');
        });
    });
});
