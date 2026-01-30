/**
 * Knowledge Management Component (v2)
 * LLM-interaction based component for managing knowledge base
 * Similar to Obsidian/Notion with features:
 * - Document CRUD operations
 * - Semantic search
 * - Document linking/backlinking
 * - Tag management
 * - Document filtering and sorting
 */

import { z } from 'zod';
import { Permission, State, StatefulComponent } from 'statefulContext';
import { proxy, subscribe } from 'valtio';
import { tdiv, TUIElement } from 'statefulContext';
import { ApolloClient, InMemoryCache, HttpLink, gql, NormalizedCacheObject } from '@apollo/client';
import { loadErrorMessages, loadDevMessages } from "@apollo/client/dev";

loadDevMessages();
loadErrorMessages();

// GraphQL Client for medWiki-service
const WIKI_SERVICE_URL = (process.env as any)['WIKI_SERVICE_URL'] || 'http://localhost:3000';

let apolloClient: ApolloClient<NormalizedCacheObject> | null = null;

function getApolloClient(): ApolloClient<NormalizedCacheObject> {
    if (!apolloClient) {
        apolloClient = new ApolloClient({
            link: new HttpLink({ uri: `${WIKI_SERVICE_URL}/graphql` }),
            cache: new InMemoryCache(),
        });
    }
    return apolloClient;
}

// GraphQL queries and mutations
const GET_DOCUMENTS = gql`
    query GetDocuments($where: documentWhereInput) {
        documents(where: $where) {
            id
            type
            entities
            topic
            metadata {
                tags
            }
            record {
                topic
                content
                updateDate
            }
        }
    }
`;

const GET_DOCUMENT = gql`
    query GetDocument($where: documentWhereInput) {
        document(where: $where) {
            id
            type
            entities
            topic
            metadata {
                tags
            }
            record {
                topic
                content
                updateDate
            }
        }
    }
`;

const CREATE_DOCUMENT = gql`
    mutation CreateDocument($input: createDocumentInput!) {
        createDocument(input: $input) {
            id
            type
            entities
            topic
            metadata {
                tags
            }
            record {
                topic
                content
                updateDate
            }
        }
    }
`;

const UPDATE_DOCUMENT = gql`
    mutation UpdateDocument($input: updateDocumentInput!) {
        updateDocument(input: $input) {
            id
            type
            entities
            topic
            metadata {
                tags
            }
            record {
                topic
                content
                updateDate
            }
        }
    }
`;

const DELETE_DOCUMENT = gql`
    mutation DeleteDocument($input: deleteDocumentInput!) {
        deleteDocument(input: $input) {
            id
            type
            entities
            topic
            metadata {
                tags
            }
            record {
                topic
                content
                updateDate
            }
        }
    }
`;

const GET_ENTITIES = gql`
    query GetEntities($where: entityWhereInput) {
        entities(where: $where) {
            id
            nomenclature {
                name
                acronym
                language
            }
            definition
        }
    }
`;

// Type definitions
export interface Document {
    id: string;
    type: 'property' | 'relation';
    entities: string[];
    topic: string;
    metadata: {
        tags: string[];
    };
    record: {
        topic: string;
        content: string;
        updateDate: string;
    }[];
}

export interface Entity {
    id: string;
    nomenclature: {
        name: string;
        acronym?: string;
        language: string;
    }[];
    definition: string;
}

export interface SearchResult {
    document: Document;
    score?: number;
    matchedContent?: string;
}

// Type-safe state interfaces
interface DocumentListState {
    documents: Document[];
    filter?: {
        type?: 'property' | 'relation' | null;
        entities?: string[];
        tags?: string[];
        topic_contains?: string | null;
    };
    sort_by?: 'topic' | 'updateDate';
    sort_order?: 'asc' | 'desc';
}

interface DocumentEditorState {
    selected_document_id: string | null;
    mode: 'view' | 'edit' | 'create';
    topic: string | null;
    type: 'property' | 'relation' | null;
    entities: string[];
    tags: string[];
    content: string | null;
}

interface SearchState {
    search_query: string | null;
    search_type: 'keyword' | 'semantic';
    search_results: SearchResult[];
    top_k?: number;
    threshold?: number;
}

interface BacklinksState {
    target_document_id: string | null;
    backlinks: Document[];
}

interface EntitiesState {
    entities: Entity[];
    filter?: {
        name_contains?: string | null;
        definition_contains?: string | null;
    };
}

/**
 * KnowledgeManageComponent
 * Provides comprehensive knowledge management capabilities similar to Obsidian/Notion
 */
export class KnowledgeManageComponent extends StatefulComponent {
    protected override states: Record<string, State> = {
        // Document list state
        document_list_state: {
            permission: Permission.rw,
            schema: z.object({
                documents: z.array(z.any()).describe('List of documents'),
                filter: z.object({
                    type: z.enum(['property', 'relation']).nullable().optional(),
                    entities: z.array(z.string()).optional(),
                    tags: z.array(z.string()).optional(),
                    topic_contains: z.string().nullable().optional()
                }).optional().describe('Filter criteria for documents'),
                sort_by: z.enum(['topic', 'updateDate']).optional().describe('Sort field'),
                sort_order: z.enum(['asc', 'desc']).optional().describe('Sort order')
            }),
            sideEffectsDesc: `Changing filter or sort will refresh the document list. Documents are fetched from the wiki service.`,
            state: proxy<DocumentListState>({
                documents: [],
                filter: {},
                sort_by: 'topic',
                sort_order: 'asc'
            })
        },

        // Document editor state
        document_editor_state: {
            permission: Permission.rw,
            schema: z.object({
                selected_document_id: z.string().nullable().describe('ID of the currently selected document'),
                mode: z.enum(['view', 'edit', 'create']).describe('Current editor mode'),
                topic: z.string().nullable().describe('Document topic/title'),
                type: z.enum(['property', 'relation']).nullable().describe('Document type'),
                entities: z.array(z.string()).describe('Related entities'),
                tags: z.array(z.string()).describe('Document tags'),
                content: z.string().nullable().describe('Document content in markdown')
            }),
            sideEffectsDesc: `Changing selected_document_id will load the document. Changing mode, topic, type, entities, tags, or content in edit/create mode will update the document.`,
            state: proxy<DocumentEditorState>({
                selected_document_id: null,
                mode: 'view',
                topic: null,
                type: null,
                entities: [],
                tags: [],
                content: null
            })
        },

        // Search state
        search_state: {
            permission: Permission.rw,
            schema: z.object({
                search_query: z.string().nullable().describe('Search query text'),
                search_type: z.enum(['keyword', 'semantic']).describe('Search type: keyword or semantic'),
                search_results: z.array(z.any()).describe('Search results'),
                top_k: z.number().optional().describe('Number of results to return'),
                threshold: z.number().optional().describe('Similarity threshold for semantic search')
            }),
            sideEffectsDesc: `Changing search_query will perform search based on search_type. Results are stored in search_results.`,
            state: proxy<SearchState>({
                search_query: null,
                search_type: 'semantic',
                search_results: [],
                top_k: 10,
                threshold: 0.0
            })
        },

        // Backlinks state (documents that link to the current document)
        backlinks_state: {
            permission: Permission.r,
            schema: z.object({
                target_document_id: z.string().nullable().describe('ID of document to find backlinks for'),
                backlinks: z.array(z.any()).describe('List of documents that link to the target document')
            }),
            sideEffectsDesc: `Read-only state. Backlinks are automatically calculated when a document is selected.`,
            state: proxy<BacklinksState>({
                target_document_id: null,
                backlinks: []
            })
        },

        // Entities state
        entities_state: {
            permission: Permission.r,
            schema: z.object({
                entities: z.array(z.any()).describe('List of available entities'),
                filter: z.object({
                    name_contains: z.string().nullable().optional(),
                    definition_contains: z.string().nullable().optional()
                }).optional().describe('Filter criteria for entities')
            }),
            sideEffectsDesc: `Read-only state. Entities are fetched from the wiki service.`,
            state: proxy<EntitiesState>({
                entities: [],
                filter: {}
            })
        }
    };

    // Internal state
    private allDocuments: Document[] = [];
    private allEntities: Entity[] = [];
    private isLoading: boolean = false;
    private lastSelectedDocumentId: string | null = null;
    private isInitializing: boolean = false;

    constructor() {
        super();

        // Subscribe to state changes for reactive behavior
        subscribe(this.states['document_list_state'].state, async () => {
            const state = this.states['document_list_state'].state as DocumentListState;
            await this.handleDocumentListChange(state);
        });

        subscribe(this.states['document_editor_state'].state, async () => {
            const state = this.states['document_editor_state'].state as DocumentEditorState;
            await this.handleEditorStateChange(state);
        });

        subscribe(this.states['search_state'].state, async () => {
            const state = this.states['search_state'].state as SearchState;
            await this.handleSearchChange(state);
        });

        subscribe(this.states['entities_state'].state, async () => {
            const state = this.states['entities_state'].state as EntitiesState;
            await this.handleEntitiesChange(state);
        });
    }

    /**
     * Initialize KnowledgeManage component
     * Fetches initial documents and entities
     */
    protected async init(): Promise<void> {
        // Set initialization flag to prevent subscribe callbacks from interfering
        this.isInitializing = true;
        try {
            // Execute both fetch operations in parallel for better performance
            await Promise.all([
                this.fetchDocuments(),
                this.fetchEntities()
            ]);
            console.debug(`init successfully`);
        } finally {
            this.isInitializing = false;
        }
    }

    /**
     * Handle document list state changes
     */
    private async handleDocumentListChange(state: DocumentListState): Promise<void> {
        // Skip processing during initialization or when already loading
        if (this.isLoading || this.isInitializing) return;

        // Re-filter and sort documents
        this.filterAndSortDocuments();
    }

    /**
     * Handle editor state changes
     */
    private async handleEditorStateChange(state: DocumentEditorState): Promise<void> {
        const { selected_document_id, mode } = state;

        // Handle document selection
        if (selected_document_id !== this.lastSelectedDocumentId) {
            this.lastSelectedDocumentId = selected_document_id;
            await this.loadDocument(selected_document_id);
        }

        // Handle mode changes
        if (mode === 'create') {
            // Clear editor for new document
            state.topic = '';
            state.type = 'property';
            state.entities = [];
            state.tags = [];
            state.content = '';
        }
    }

    /**
     * Handle search state changes
     */
    private async handleSearchChange(state: SearchState): Promise<void> {
        const { search_query, search_type } = state;

        if (!search_query || search_query.trim().length === 0) {
            state.search_results = [];
            return;
        }

        await this.performSearch(search_query, search_type, state.top_k, state.threshold);
    }

    /**
     * Handle entities state changes
     */
    private async handleEntitiesChange(state: EntitiesState): Promise<void> {
        // Skip processing during initialization
        if (this.isInitializing) return;

        // Re-filter entities
        this.filterEntities();
    }

    /**
     * Fetch all documents from the wiki service
     */
    private async fetchDocuments(): Promise<void> {
        try {
            this.isLoading = true;
            const client = getApolloClient();
            const { data } = await client.query({
                query: GET_DOCUMENTS,
                variables: { where: {} }
            });

            this.allDocuments = data.documents || [];
            // Only call filterAndSortDocuments if not initializing (to avoid triggering subscription)
            if (!this.isInitializing) {
                this.filterAndSortDocuments();
            } else {
                // During initialization, directly set the state to avoid triggering subscription
                const state = this.states['document_list_state'].state as DocumentListState;
                state.documents = [...this.allDocuments];
            }
            console.debug(`fetch documents successfully`)
        } catch (error) {
            console.error('[KnowledgeManageComponent] Failed to fetch documents:', error);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Filter and sort documents based on current state
     */
    private filterAndSortDocuments(): void {
        const state = this.states['document_list_state'].state as DocumentListState;
        let filtered = [...this.allDocuments];

        // Apply filters
        if (state.filter) {
            const { type, entities, tags, topic_contains } = state.filter;

            if (type) {
                filtered = filtered.filter(doc => doc.type === type);
            }

            if (entities && entities.length > 0) {
                filtered = filtered.filter(doc =>
                    entities.some((e: string) => doc.entities.includes(e))
                );
            }

            if (tags && tags.length > 0) {
                filtered = filtered.filter(doc =>
                    tags.some((t: string) => doc.metadata.tags.includes(t))
                );
            }

            if (topic_contains) {
                const query = topic_contains.toLowerCase();
                filtered = filtered.filter(doc =>
                    doc.topic.toLowerCase().includes(query)
                );
            }
        }

        // Apply sorting
        const sortBy = state.sort_by || 'topic';
        const sortOrder = state.sort_order || 'asc';

        filtered.sort((a, b) => {
            let comparison = 0;

            if (sortBy === 'topic') {
                comparison = a.topic.localeCompare(b.topic);
            } else if (sortBy === 'updateDate') {
                const dateA = a.record[0]?.updateDate || '';
                const dateB = b.record[0]?.updateDate || '';
                comparison = dateA.localeCompare(dateB);
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });

        state.documents = filtered;
    }

    /**
     * Load a document into the editor
     */
    private async loadDocument(documentId: string | null): Promise<void> {
        if (!documentId) {
            // Clear editor
            const editorState = this.states['document_editor_state'].state as DocumentEditorState;
            editorState.topic = null;
            editorState.type = null;
            editorState.entities = [];
            editorState.tags = [];
            editorState.content = null;
            editorState.mode = 'view';

            // Clear backlinks
            const backlinksState = this.states['backlinks_state'].state as BacklinksState;
            backlinksState.target_document_id = null;
            backlinksState.backlinks = [];
            return;
        }

        try {
            const client = getApolloClient();
            const { data } = await client.query({
                query: GET_DOCUMENT,
                variables: { where: { id: documentId } }
            });

            const doc = data.document;
            if (doc) {
                const editorState = this.states['document_editor_state'].state as DocumentEditorState;
                editorState.topic = doc.topic;
                editorState.type = doc.type;
                editorState.entities = doc.entities;
                editorState.tags = doc.metadata?.tags || [];
                editorState.content = doc.record[0]?.content || '';
                editorState.mode = 'view';

                // Calculate backlinks
                this.calculateBacklinks(documentId);
            }
        } catch (error) {
            console.error('[KnowledgeManageComponent] Failed to load document:', error);
        }
    }

    /**
     * Calculate backlinks for a document
     */
    private calculateBacklinks(documentId: string): void {
        const targetDoc = this.allDocuments.find(d => d.id === documentId);
        if (!targetDoc) return;

        // Find documents that reference this document's topic or entities
        const backlinks = this.allDocuments.filter(doc => {
            if (doc.id === documentId) return false;

            const content = (doc.record[0]?.content || '').toLowerCase();
            const topic = targetDoc.topic.toLowerCase();

            // Check if content contains topic
            if (content.includes(topic)) return true;

            // Check if entities overlap
            const hasCommonEntity = doc.entities.some(e => targetDoc.entities.includes(e));
            if (hasCommonEntity) return true;

            return false;
        });

        const backlinksState = this.states['backlinks_state'].state as BacklinksState;
        backlinksState.target_document_id = documentId;
        backlinksState.backlinks = backlinks;
    }

    /**
     * Perform search (keyword or semantic)
     */
    private async performSearch(
        query: string,
        type: 'keyword' | 'semantic',
        topK: number = 10,
        threshold: number = 0.0
    ): Promise<void> {
        try {
            const client = getApolloClient();
            const searchState = this.states['search_state'].state as SearchState;

            if (type === 'keyword') {
                // Keyword search using topic_contains
                const { data } = await client.query({
                    query: GET_DOCUMENTS,
                    variables: {
                        where: {
                            topic_contains: query
                        }
                    }
                });

                searchState.search_results = (data.documents || []).map((doc: Document) => ({
                    document: doc
                }));
            } else {
                // Semantic search
                const { data } = await client.query({
                    query: GET_DOCUMENTS,
                    variables: {
                        where: {
                            document_semantic_search: {
                                searchText: query,
                                topK,
                                threshold
                            }
                        }
                    }
                });

                searchState.search_results = (data.documents || []).map((doc: Document) => ({
                    document: doc
                }));
            }
        } catch (error) {
            console.error('[KnowledgeManageComponent] Failed to perform search:', error);
            const searchState = this.states['search_state'].state as SearchState;
            searchState.search_results = [];
        }
    }

    /**
     * Fetch all entities from the wiki service
     */
    private async fetchEntities(): Promise<void> {
        try {
            const client = getApolloClient();
            const { data } = await client.query({
                query: GET_ENTITIES,
                variables: { where: {} }
            });

            this.allEntities = data.entities || [];
            // Only call filterEntities if not initializing (to avoid triggering subscription)
            if (!this.isInitializing) {
                this.filterEntities();
            } else {
                // During initialization, directly set the state to avoid triggering subscription
                const state = this.states['entities_state'].state as EntitiesState;
                state.entities = [...this.allEntities];
            }
            console.debug(`fetch entities successfully`)
        } catch (error) {
            console.error('[KnowledgeManageComponent] Failed to fetch entities:', error);
        }
    }

    /**
     * Filter entities based on current state
     */
    private filterEntities(): void {
        const state = this.states['entities_state'].state as EntitiesState;
        let filtered = [...this.allEntities];

        if (state.filter) {
            const { name_contains, definition_contains } = state.filter;

            if (name_contains) {
                const query = name_contains.toLowerCase();
                filtered = filtered.filter(entity =>
                    entity.nomenclature.some(n => n.name.toLowerCase().includes(query))
                );
            }

            if (definition_contains) {
                const query = definition_contains.toLowerCase();
                filtered = filtered.filter(entity =>
                    entity.definition.toLowerCase().includes(query)
                );
            }
        }

        state.entities = filtered;
    }

    /**
     * Create a new document
     */
    async createDocument(
        type: 'property' | 'relation',
        topic: string,
        content: string,
        entities: string[] = [],
        tags: string[] = []
    ): Promise<Document | null> {
        try {
            const client = getApolloClient();
            const { data } = await client.mutate({
                mutation: CREATE_DOCUMENT,
                variables: {
                    input: {
                        type,
                        topic,
                        content,
                        entities,
                        tags
                    }
                }
            });

            if (data.createDocument) {
                // Refresh document list
                await this.fetchDocuments();
                return data.createDocument;
            }
        } catch (error) {
            console.error('[KnowledgeManageComponent] Failed to create document:', error);
        }
        return null;
    }

    /**
     * Update an existing document
     */
    async updateDocument(
        documentId: string,
        updates: {
            topic?: string;
            content?: string;
            type?: 'property' | 'relation';
            entities?: string[];
            tags?: string[];
        }
    ): Promise<Document | null> {
        try {
            const client = getApolloClient();
            const { data } = await client.mutate({
                mutation: UPDATE_DOCUMENT,
                variables: {
                    input: {
                        documentId,
                        ...updates
                    }
                }
            });

            if (data.updateDocument) {
                // Refresh document list
                await this.fetchDocuments();
                return data.updateDocument;
            }
        } catch (error) {
            console.error('[KnowledgeManageComponent] Failed to update document:', error);
        }
        return null;
    }

    /**
     * Delete a document
     */
    async deleteDocument(documentId: string): Promise<Document | null> {
        try {
            const client = getApolloClient();
            const { data } = await client.mutate({
                mutation: DELETE_DOCUMENT,
                variables: {
                    input: { documentId }
                }
            });

            if (data.deleteDocument) {
                // Refresh document list
                await this.fetchDocuments();

                // Clear editor if deleted document was selected
                const editorState = this.states['document_editor_state'].state as DocumentEditorState;
                if (editorState.selected_document_id === documentId) {
                    editorState.selected_document_id = null;
                    editorState.mode = 'view';
                }

                return data.deleteDocument;
            }
        } catch (error) {
            console.error('[KnowledgeManageComponent] Failed to delete document:', error);
        }
        return null;
    }

    /**
     * Get all available tags
     */
    getAllTags(): string[] {
        const tags = new Set<string>();
        this.allDocuments.forEach(doc => {
            doc.metadata.tags.forEach(tag => tags.add(tag));
        });
        return Array.from(tags).sort();
    }

    /**
     * Get all available entities
     */
    getAllEntities(): Entity[] {
        return this.allEntities;
    }

    /**
     * Get script utilities for this component
     */
    override getScriptUtilities(): Record<string, Function> {
        return {
            // Document CRUD
            createDocument: (type: string, topic: string, content: string, entities?: string[], tags?: string[]) =>
                this.createDocument(type as 'property' | 'relation', topic, content, entities, tags),
            updateDocument: (documentId: string, updates: any) =>
                this.updateDocument(documentId, updates),
            deleteDocument: (documentId: string) =>
                this.deleteDocument(documentId),

            // Data access
            getAllDocuments: () => this.allDocuments,
            getAllEntities: () => this.getAllEntities(),
            getAllTags: () => this.getAllTags(),
            getBacklinks: (documentId: string) => {
                this.calculateBacklinks(documentId);
                const backlinksState = this.states['backlinks_state'].state as BacklinksState;
                return backlinksState.backlinks;
            },

            // Search
            searchDocuments: (query: string, type: 'keyword' | 'semantic' = 'semantic', topK?: number, threshold?: number) =>
                this.performSearch(query, type, topK, threshold),

            // Link detection
            findLinkedDocuments: (documentId: string) => {
                const doc = this.allDocuments.find(d => d.id === documentId);
                if (!doc) return [];

                const content = (doc.record[0]?.content || '').toLowerCase();
                const linkedDocs: Document[] = [];

                this.allDocuments.forEach(otherDoc => {
                    if (otherDoc.id === documentId) return;
                    if (content.includes(otherDoc.topic.toLowerCase())) {
                        linkedDocs.push(otherDoc);
                    }
                });

                return linkedDocs;
            }
        };
    }

    /**
     * Render component as markdown
     */
    override async render(): Promise<TUIElement> {
        // Ensure initialization before rendering (calls init() if not already initialized)
        await this.ensureInitialized();

        const listState = this.states['document_list_state'].state as DocumentListState;
        const editorState = this.states['document_editor_state'].state as DocumentEditorState;
        const searchState = this.states['search_state'].state as SearchState;
        const backlinksState = this.states['backlinks_state'].state as BacklinksState;
        const entitiesState = this.states['entities_state'].state as EntitiesState;

        // Create container tdiv
        const container = new tdiv({
            content: '',
            styles: {
                width: 80,
                showBorder: false
            }
        });

        // Add main header
        container.addChild(new tdiv({
            content: '## 📚 Knowledge Management',
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));

        // Render document list
        const documentList = listState.documents
            .map((doc: Document, i: number) => {
                const isSelected = doc.id === editorState.selected_document_id;
                const marker = isSelected ? '→ ' : '  ';
                const typeIcon = doc.type === 'property' ? '📄' : '🔗';
                const tags = doc.metadata.tags.length > 0 ? ` [${doc.metadata.tags.join(', ')}]` : '';
                return `${marker}${i + 1}. ${typeIcon} ${doc.topic}${tags}`;
            })
            .join('\n');

        // Render filter info
        const filterInfo = listState.filter ?
            `**Filter:**\n- Type: ${listState.filter.type || '*Any*'}\n- Topic contains: ${listState.filter.topic_contains || '*None*'}\n- Entities: ${listState.filter.entities?.join(', ') || '*None*'}\n- Tags: ${listState.filter.tags?.join(', ') || '*None*'}\n**Sort:** ${listState.sort_by} (${listState.sort_order})` : '';

        // Add document list section
        container.addChild(new tdiv({
            content: '### 📄 Document List',
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));
        if (filterInfo) {
            container.addChild(new tdiv({
                content: filterInfo,
                styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
            }));
        }
        container.addChild(new tdiv({
            content: documentList || '*No documents*',
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));

        // Render editor content
        let editorContent = '';
        if (editorState.mode === 'create') {
            editorContent = `**Mode:** Create New Document\n- [topic]: ${editorState.topic || '*Not set*'}\n- [type]: ${editorState.type || '*Not set*'}\n- [entities]: ${editorState.entities.length > 0 ? editorState.entities.join(', ') : '*None*'}\n- [tags]: ${editorState.tags.length > 0 ? editorState.tags.join(', ') : '*None*'}\n- [content]: ${editorState.content ? '```markdown\n' + editorState.content + '\n```' : '*Empty*'}`;
        } else if (editorState.selected_document_id) {
            const doc = this.allDocuments.find(d => d.id === editorState.selected_document_id);
            if (doc) {
                editorContent = `**Mode:** ${editorState.mode === 'view' ? 'View' : 'Edit'}\n**Document ID:** ${doc.id}\n**Type:** ${doc.type}\n**Topic:** ${doc.topic}\n**Entities:** ${doc.entities.join(', ') || '*None*'}\n**Tags:** ${doc.metadata.tags.join(', ') || '*None*'}\n**Last Updated:** ${doc.record[0]?.updateDate || '*Unknown*'}\n\n---\n**Content:**\n\`\`\`markdown\n${doc.record[0]?.content || '*No content*'}\n\`\`\``;
            }
        } else {
            editorContent = '*No document selected. Select a document from the list or create a new one.*';
        }

        // Add editor section
        container.addChild(new tdiv({
            content: '### ✏️ Document Editor',
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));
        container.addChild(new tdiv({
            content: editorContent,
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));

        // Render search results
        const searchResults = searchState.search_results.length > 0
            ? searchState.search_results.map((result: SearchResult, i: number) => {
                const score = result.score ? ` (score: ${result.score.toFixed(3)})` : '';
                return `${i + 1}. ${result.document.topic}${score}`;
            }).join('\n')
            : '*No results*';

        // Add search section
        container.addChild(new tdiv({
            content: '### 🔍 Search',
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));
        container.addChild(new tdiv({
            content: `- [search_query]: ${searchState.search_query || '*None*'}\n- [search_type]: ${searchState.search_type}\n- [top_k]: ${searchState.top_k}\n- [threshold]: ${searchState.threshold}`,
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));
        container.addChild(new tdiv({
            content: '**Results:**\n' + searchResults,
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));

        // Render backlinks
        const backlinksList = backlinksState.backlinks.length > 0
            ? backlinksState.backlinks.map((doc: Document, i: number) => {
                const typeIcon = doc.type === 'property' ? '📄' : '🔗';
                return `${i + 1}. ${typeIcon} ${doc.topic}`;
            }).join('\n')
            : '*No backlinks*';

        // Add backlinks section
        container.addChild(new tdiv({
            content: '### 🔗 Backlinks',
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));
        container.addChild(new tdiv({
            content: `**Target:** ${backlinksState.target_document_id || '*None*'}\n${backlinksList}`,
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));

        // Render entities
        const entitiesList = entitiesState.entities.length > 0
            ? entitiesState.entities.map((entity: Entity, i: number) => {
                const names = entity.nomenclature.map(n => n.name).join(', ');
                return `${i + 1}. ${names}`;
            }).join('\n')
            : '*No entities*';

        // Add entities section
        container.addChild(new tdiv({
            content: '### 🏷️ Entities',
            styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
        }));
        container.addChild(new tdiv({
            content: entitiesList,
            styles: { width: 80, showBorder: false }
        }));

        return container;
    }
}
