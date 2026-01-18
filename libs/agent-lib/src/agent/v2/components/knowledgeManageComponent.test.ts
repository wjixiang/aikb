import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { KnowledgeManageComponent, Document, Entity, SearchResult } from './knowledgeManageComponent';
import * as z from 'zod';

describe('KnowledgeManageComponent', () => {
    let component: KnowledgeManageComponent;

    beforeEach(() => {
        // Reset environment
        (process.env as any)['WIKI_SERVICE_URL'] = 'http://localhost:3001';

        // Create component
        component = new KnowledgeManageComponent();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with all states', () => {
            const states = component.getStates();
            expect(states).toHaveProperty('document_list_state');
            expect(states).toHaveProperty('document_editor_state');
            expect(states).toHaveProperty('search_state');
            expect(states).toHaveProperty('backlinks_state');
            expect(states).toHaveProperty('entities_state');
        });

        it('should initialize with empty document list', () => {
            const listState = component.getStates()['document_list_state'].state as any;
            expect(listState.documents).toEqual([]);
        });

        it('should initialize with empty search results', () => {
            const searchState = component.getStates()['search_state'].state as any;
            expect(searchState.search_results).toEqual([]);
        });

        it('should initialize with view mode', () => {
            const editorState = component.getStates()['document_editor_state'].state as any;
            expect(editorState.mode).toBe('view');
            expect(editorState.selected_document_id).toBeNull();
        });
    });

    describe('State Schemas', () => {
        it('should have valid document list state schema', () => {
            const state = component.getStates()['document_list_state'];
            expect(state.schema).toBeInstanceOf(z.ZodObject);
            expect(state.permission).toBe('READ_AND_WRITE');
        });

        it('should have valid document editor state schema', () => {
            const state = component.getStates()['document_editor_state'];
            expect(state.schema).toBeInstanceOf(z.ZodObject);
            expect(state.permission).toBe('READ_AND_WRITE');
        });

        it('should have valid search state schema', () => {
            const state = component.getStates()['search_state'];
            expect(state.schema).toBeInstanceOf(z.ZodObject);
            expect(state.permission).toBe('READ_AND_WRITE');
        });

        it('should have read-only backlinks state', () => {
            const state = component.getStates()['backlinks_state'];
            expect(state.permission).toBe('READ_ONLY');
        });

        it('should have read-only entities state', () => {
            const state = component.getStates()['entities_state'];
            expect(state.permission).toBe('READ_ONLY');
        });
    });

    describe('Document List State', () => {
        it('should have default sort settings', () => {
            const listState = component.getStates()['document_list_state'].state as any;
            expect(listState.sort_by).toBe('topic');
            expect(listState.sort_order).toBe('asc');
        });

        it('should have empty filter by default', () => {
            const listState = component.getStates()['document_list_state'].state as any;
            expect(listState.filter).toEqual({});
        });
    });

    describe('Document Editor State', () => {
        it('should have null values for new document', () => {
            const editorState = component.getStates()['document_editor_state'].state as any;
            expect(editorState.selected_document_id).toBeNull();
            expect(editorState.topic).toBeNull();
            expect(editorState.type).toBeNull();
            expect(editorState.content).toBeNull();
        });

        it('should have empty arrays for entities and tags', () => {
            const editorState = component.getStates()['document_editor_state'].state as any;
            expect(editorState.entities).toEqual([]);
            expect(editorState.tags).toEqual([]);
        });
    });

    describe('Search State', () => {
        it('should have semantic search as default type', () => {
            const searchState = component.getStates()['search_state'].state as any;
            expect(searchState.search_type).toBe('semantic');
        });

        it('should have default search parameters', () => {
            const searchState = component.getStates()['search_state'].state as any;
            expect(searchState.top_k).toBe(10);
            expect(searchState.threshold).toBe(0.0);
        });
    });

    describe('Script Utilities', () => {
        it('should provide createDocument utility', () => {
            const utilities = component.getScriptUtilities();
            expect(utilities['createDocument']).toBeDefined();
            expect(typeof utilities['createDocument']).toBe('function');
        });

        it('should provide updateDocument utility', () => {
            const utilities = component.getScriptUtilities();
            expect(utilities['updateDocument']).toBeDefined();
            expect(typeof utilities['updateDocument']).toBe('function');
        });

        it('should provide deleteDocument utility', () => {
            const utilities = component.getScriptUtilities();
            expect(utilities['deleteDocument']).toBeDefined();
            expect(typeof utilities['deleteDocument']).toBe('function');
        });

        it('should provide getAllDocuments utility', () => {
            const utilities = component.getScriptUtilities();
            expect(utilities['getAllDocuments']).toBeDefined();
            expect(typeof utilities['getAllDocuments']).toBe('function');
        });

        it('should provide getAllEntities utility', () => {
            const utilities = component.getScriptUtilities();
            expect(utilities['getAllEntities']).toBeDefined();
            expect(typeof utilities['getAllEntities']).toBe('function');
        });

        it('should provide getAllTags utility', () => {
            const utilities = component.getScriptUtilities();
            expect(utilities['getAllTags']).toBeDefined();
            expect(typeof utilities['getAllTags']).toBe('function');
        });

        it('should provide getBacklinks utility', () => {
            const utilities = component.getScriptUtilities();
            expect(utilities['getBacklinks']).toBeDefined();
            expect(typeof utilities['getBacklinks']).toBe('function');
        });

        it('should provide searchDocuments utility', () => {
            const utilities = component.getScriptUtilities();
            expect(utilities['searchDocuments']).toBeDefined();
            expect(typeof utilities['searchDocuments']).toBe('function');
        });

        it('should provide findLinkedDocuments utility', () => {
            const utilities = component.getScriptUtilities();
            expect(utilities['findLinkedDocuments']).toBeDefined();
            expect(typeof utilities['findLinkedDocuments']).toBe('function');
        });
    });

    describe('Rendering', () => {
        it('should render component as markdown', async () => {
            const rendered = await component.render();
            expect(rendered).toContain('📚 Knowledge Management');
            expect(rendered).toContain('📄 Document List');
            expect(rendered).toContain('✏️ Document Editor');
            expect(rendered).toContain('🔍 Search');
            expect(rendered).toContain('🔗 Backlinks');
            expect(rendered).toContain('🏷️ Entities');
        });

        it('should show no documents message when empty', async () => {
            const rendered = await component.render();
            expect(rendered).toContain('*No documents*');
        });

        it('should show no results message when no search results', async () => {
            const rendered = await component.render();
            expect(rendered).toContain('*No results*');
        });

        it('should show no backlinks message when no document selected', async () => {
            const rendered = await component.render();
            expect(rendered).toContain('*No backlinks*');
        });

        it('should show no entities message when no entities', async () => {
            const rendered = await component.render();
            expect(rendered).toContain('*No entities*');
        });
    });

    describe('Tag Management', () => {
        it('should return empty array when no documents', () => {
            const tags = component.getAllTags();
            expect(tags).toEqual([]);
        });

        it('should extract unique tags from documents', () => {
            // Simulate having documents with tags
            const mockDocuments: Document[] = [
                {
                    id: '1',
                    type: 'property',
                    entities: [],
                    topic: 'Doc 1',
                    metadata: { tags: ['tag1', 'tag2'] },
                    record: [{ topic: 'Doc 1', content: 'Content', updateDate: '2024-01-01' }]
                },
                {
                    id: '2',
                    type: 'property',
                    entities: [],
                    topic: 'Doc 2',
                    metadata: { tags: ['tag2', 'tag3'] },
                    record: [{ topic: 'Doc 2', content: 'Content', updateDate: '2024-01-01' }]
                }
            ];

            // Access private property for testing
            (component as any).allDocuments = mockDocuments;
            const tags = component.getAllTags();

            expect(tags).toEqual(['tag1', 'tag2', 'tag3']);
        });
    });

    describe('Entity Management', () => {
        it('should return empty array when no entities', () => {
            const entities = component.getAllEntities();
            expect(entities).toEqual([]);
        });

        it('should return all entities', () => {
            const mockEntities: Entity[] = [
                {
                    id: '1',
                    nomenclature: [{ name: 'Entity 1', language: 'en' }],
                    definition: 'Definition 1'
                },
                {
                    id: '2',
                    nomenclature: [{ name: 'Entity 2', language: 'en' }],
                    definition: 'Definition 2'
                }
            ];

            (component as any).allEntities = mockEntities;
            const entities = component.getAllEntities();

            expect(entities).toEqual(mockEntities);
        });
    });

    describe('Backlink Calculation', () => {
        it('should calculate backlinks for a document', () => {
            const mockDocuments: Document[] = [
                {
                    id: '1',
                    type: 'property',
                    entities: ['entity1'],
                    topic: 'Target Document',
                    metadata: { tags: [] },
                    record: [{ topic: 'Target Document', content: 'Content', updateDate: '2024-01-01' }]
                },
                {
                    id: '2',
                    type: 'property',
                    entities: ['entity1'],
                    topic: 'Linking Document',
                    metadata: { tags: [] },
                    record: [{ topic: 'Linking Document', content: 'This references Target Document', updateDate: '2024-01-01' }]
                }
            ];

            (component as any).allDocuments = mockDocuments;
            (component as any).calculateBacklinks('1');

            const backlinksState = component.getStates()['backlinks_state'].state as any;
            expect(backlinksState.backlinks).toHaveLength(1);
            expect(backlinksState.backlinks[0].id).toBe('2');
        });

        it('should find linked documents', () => {
            const mockDocuments: Document[] = [
                {
                    id: '1',
                    type: 'property',
                    entities: [],
                    topic: 'Source Document',
                    metadata: { tags: [] },
                    record: [{ topic: 'Source Document', content: 'See Target Document for details', updateDate: '2024-01-01' }]
                },
                {
                    id: '2',
                    type: 'property',
                    entities: [],
                    topic: 'Target Document',
                    metadata: { tags: [] },
                    record: [{ topic: 'Target Document', content: 'Content', updateDate: '2024-01-01' }]
                }
            ];

            (component as any).allDocuments = mockDocuments;
            const linkedDocs = component.getScriptUtilities()['findLinkedDocuments']('1');

            expect(linkedDocs).toHaveLength(1);
            expect(linkedDocs[0].id).toBe('2');
        });
    });

    describe('Document Filtering and Sorting', () => {
        it('should filter documents by type', () => {
            const mockDocuments: Document[] = [
                {
                    id: '1',
                    type: 'property',
                    entities: [],
                    topic: 'Property Doc',
                    metadata: { tags: [] },
                    record: [{ topic: 'Property Doc', content: 'Content', updateDate: '2024-01-01' }]
                },
                {
                    id: '2',
                    type: 'relation',
                    entities: [],
                    topic: 'Relation Doc',
                    metadata: { tags: [] },
                    record: [{ topic: 'Relation Doc', content: 'Content', updateDate: '2024-01-01' }]
                }
            ];

            (component as any).allDocuments = mockDocuments;
            const listState = component.getStates()['document_list_state'].state as any;
            listState.filter = { type: 'property' };

            (component as any).filterAndSortDocuments();

            expect(listState.documents).toHaveLength(1);
            expect(listState.documents[0].type).toBe('property');
        });

        it('should filter documents by tags', () => {
            const mockDocuments: Document[] = [
                {
                    id: '1',
                    type: 'property',
                    entities: [],
                    topic: 'Doc 1',
                    metadata: { tags: ['tag1'] },
                    record: [{ topic: 'Doc 1', content: 'Content', updateDate: '2024-01-01' }]
                },
                {
                    id: '2',
                    type: 'property',
                    entities: [],
                    topic: 'Doc 2',
                    metadata: { tags: ['tag2'] },
                    record: [{ topic: 'Doc 2', content: 'Content', updateDate: '2024-01-01' }]
                }
            ];

            (component as any).allDocuments = mockDocuments;
            const listState = component.getStates()['document_list_state'].state as any;
            listState.filter = { tags: ['tag1'] };

            (component as any).filterAndSortDocuments();

            expect(listState.documents).toHaveLength(1);
            expect(listState.documents[0].id).toBe('1');
        });

        it('should sort documents by topic', () => {
            const mockDocuments: Document[] = [
                {
                    id: '1',
                    type: 'property',
                    entities: [],
                    topic: 'Zebra',
                    metadata: { tags: [] },
                    record: [{ topic: 'Zebra', content: 'Content', updateDate: '2024-01-01' }]
                },
                {
                    id: '2',
                    type: 'property',
                    entities: [],
                    topic: 'Apple',
                    metadata: { tags: [] },
                    record: [{ topic: 'Apple', content: 'Content', updateDate: '2024-01-01' }]
                }
            ];

            (component as any).allDocuments = mockDocuments;
            const listState = component.getStates()['document_list_state'].state as any;
            listState.sort_by = 'topic';
            listState.sort_order = 'asc';

            (component as any).filterAndSortDocuments();

            expect(listState.documents[0].topic).toBe('Apple');
            expect(listState.documents[1].topic).toBe('Zebra');
        });

        it('should sort documents by updateDate', () => {
            const mockDocuments: Document[] = [
                {
                    id: '1',
                    type: 'property',
                    entities: [],
                    topic: 'Doc 1',
                    metadata: { tags: [] },
                    record: [{ topic: 'Doc 1', content: 'Content', updateDate: '2024-01-01' }]
                },
                {
                    id: '2',
                    type: 'property',
                    entities: [],
                    topic: 'Doc 2',
                    metadata: { tags: [] },
                    record: [{ topic: 'Doc 2', content: 'Content', updateDate: '2024-01-02' }]
                }
            ];

            (component as any).allDocuments = mockDocuments;
            const listState = component.getStates()['document_list_state'].state as any;
            listState.sort_by = 'updateDate';
            listState.sort_order = 'desc';

            (component as any).filterAndSortDocuments();

            expect(listState.documents[0].id).toBe('2');
            expect(listState.documents[1].id).toBe('1');
        });
    });

    describe('Integration Tests', () => {
        it('should render with all sections', async () => {
            const rendered = await component.render();

            expect(rendered).toContain('Document List');
            expect(rendered).toContain('Document Editor');
            expect(rendered).toContain('Search');
            expect(rendered).toContain('Backlinks');
            expect(rendered).toContain('Entities');
        });
    });
});
