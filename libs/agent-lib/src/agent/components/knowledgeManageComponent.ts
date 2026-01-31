/**
 * Knowledge Management Component (v3)
 * Tool-call based component for managing knowledge base
 * Similar to Obsidian/Notion with features:
 * - Document CRUD operations
 * - Semantic search
 * - Document linking/backlinking
 * - Tag management
 * - Document filtering and sorting
 */

import { z } from 'zod';
import { ToolComponent, Tool } from 'statefulContext';
import { tdiv } from 'statefulContext';
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

/**
 * KnowledgeManageComponent
 * Provides comprehensive knowledge management capabilities similar to Obsidian/Notion
 */
export class KnowledgeManageComponent extends ToolComponent {
    toolSet = new Map<string, Tool>([
        ['fetchDocuments', {
            toolName: 'fetchDocuments',
            desc: 'Fetch all documents from the wiki service',
            paramsSchema: z.object({})
        }],
        ['selectDocument', {
            toolName: 'selectDocument',
            desc: 'Select a document to view/edit',
            paramsSchema: z.object({ documentId: z.string().describe('ID of the document to select') })
        }],
        ['createDocument', {
            toolName: 'createDocument',
            desc: 'Create a new document',
            paramsSchema: z.object({
                type: z.enum(['property', 'relation']).describe('Document type'),
                topic: z.string().describe('Document topic/title'),
                content: z.string().describe('Document content in markdown'),
                entities: z.array(z.string()).optional().describe('Related entities'),
                tags: z.array(z.string()).optional().describe('Document tags')
            })
        }],
        ['updateDocument', {
            toolName: 'updateDocument',
            desc: 'Update an existing document',
            paramsSchema: z.object({
                documentId: z.string().describe('ID of the document to update'),
                topic: z.string().optional().describe('Document topic/title'),
                content: z.string().optional().describe('Document content in markdown'),
                type: z.enum(['property', 'relation']).optional().describe('Document type'),
                entities: z.array(z.string()).optional().describe('Related entities'),
                tags: z.array(z.string()).optional().describe('Document tags')
            })
        }],
        ['deleteDocument', {
            toolName: 'deleteDocument',
            desc: 'Delete a document',
            paramsSchema: z.object({ documentId: z.string().describe('ID of the document to delete') })
        }],
        ['filterDocuments', {
            toolName: 'filterDocuments',
            desc: 'Filter documents by type, entities, tags, or topic',
            paramsSchema: z.object({
                type: z.enum(['property', 'relation']).optional().describe('Document type filter'),
                entities: z.array(z.string()).optional().describe('Entity filter'),
                tags: z.array(z.string()).optional().describe('Tag filter'),
                topicContains: z.string().optional().describe('Topic contains filter'),
                sortBy: z.enum(['topic', 'updateDate']).optional().describe('Sort field'),
                sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort order')
            })
        }],
        ['sortDocuments', {
            toolName: 'sortDocuments',
            desc: 'Sort documents by topic or update date',
            paramsSchema: z.object({
                sortBy: z.enum(['topic', 'updateDate']).optional().describe('Sort field'),
                sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort order')
            })
        }],
        ['searchDocuments', {
            toolName: 'searchDocuments',
            desc: 'Search documents by keyword or semantic search',
            paramsSchema: z.object({
                query: z.string().describe('Search query text'),
                searchType: z.enum(['keyword', 'semantic']).describe('Search type: keyword or semantic'),
                topK: z.number().optional().describe('Number of results to return'),
                threshold: z.number().optional().describe('Similarity threshold for semantic search')
            })
        }],
        ['fetchEntities', {
            toolName: 'fetchEntities',
            desc: 'Fetch all entities from the wiki service',
            paramsSchema: z.object({})
        }],
        ['filterEntities', {
            toolName: 'filterEntities',
            desc: 'Filter entities by name or definition',
            paramsSchema: z.object({
                nameContains: z.string().optional().describe('Name contains filter'),
                definitionContains: z.string().optional().describe('Definition contains filter')
            })
        }]
    ]);

    // Internal state
    private allDocuments: Document[] = [];
    private allEntities: Entity[] = [];
    private isLoading: boolean = false;
    private selectedDocumentId: string | null = null;
    private currentDocument: Document | null = null;
    private searchResults: SearchResult[] = [];
    private backlinks: Document[] = [];

    constructor() {
        super();
        this.fetchDocuments();
        this.fetchEntities();
    }

    /**
     * Render component as TUIElement array
     */
    renderImply = async () => {
        const docList = this.allDocuments
            .map((doc: Document, i: number) => {
                const isSelected = doc.id === this.selectedDocumentId;
                const marker = isSelected ? '→ ' : '  ';
                return `${marker}${i + 1}. ${doc.type}: ${doc.topic}`;
            })
            .join('\n');

        let viewerContent = '';
        if (!this.currentDocument) {
            viewerContent = '*No document selected. Please select a document first.*';
        } else {
            viewerContent = `**Selected Document:** ${this.currentDocument.type}: ${this.currentDocument.topic}\n\n---`;
            if (this.currentDocument.record[0]) {
                viewerContent += `\n${this.currentDocument.record[0].content}`;
            }
        }

        // Render search results
        const resultsList = this.searchResults.length > 0
            ? this.searchResults.map((r: SearchResult, i: number) => {
                const title = r.document.topic;
                const score = r.score ? `(score: ${r.score.toFixed(3)})` : '';
                const content = r.matchedContent ? `\n${r.matchedContent}` : '';
                return `${'>'.repeat(6)}RESULT${i + 1}${'<'.repeat(6)}\n**${title}**${score}${content}`;
            }).join('\n--------------------\n')
            : '*No results*';

        // Render backlinks
        const backlinksList = this.backlinks.length > 0
            ? this.backlinks.map((doc: Document, i: number) => {
                const marker = '↗';
                return `${marker} ${i + 1}. ${doc.type}: ${doc.topic}`;
            }).join('\n')
            : '*No backlinks*';

        return [
            new tdiv({
                content: '## 📚 Document List',
                styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
            }),
            new tdiv({
                content: docList,
                styles: { width: 80, showBorder: false }
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
                content: `[search_query]: ${this.searchResults.length > 0 ? this.searchResults[0].document.topic.substring(0, 30) : '*None*'}`,
                styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
            }),
            new tdiv({
                content: '-----Results-----\n' + resultsList,
                styles: { width: 80, showBorder: false }
            }),
            new tdiv({
                content: '### 🔗 Backlinks',
                styles: { width: 80, showBorder: false, margin: { bottom: 1 } }
            }),
            new tdiv({
                content: backlinksList,
                styles: { width: 80, showBorder: false }
            })
        ];
    };

    /**
     * Handle tool calls
     */
    handleToolCall = async (toolName: string, params: any): Promise<void> => {
        switch (toolName) {
            case 'fetchDocuments':
                await this.fetchDocuments();
                break;
            case 'selectDocument':
                await this.selectDocument(params.documentId);
                break;
            case 'createDocument':
                await this.createDocument(
                    params.type,
                    params.topic,
                    params.content,
                    params.entities || [],
                    params.tags || []
                );
                break;
            case 'updateDocument':
                await this.updateDocument(
                    params.documentId,
                    params.topic,
                    params.content,
                    params.type,
                    params.entities,
                    params.tags
                );
                break;
            case 'deleteDocument':
                await this.deleteDocument(params.documentId);
                break;
            case 'filterDocuments':
                await this.filterDocuments(
                    params.type,
                    params.entities,
                    params.tags,
                    params.topicContains,
                    params.sortBy,
                    params.sortOrder
                );
                break;
            case 'sortDocuments':
                await this.sortDocuments(params.sortBy, params.sortOrder);
                break;
            case 'searchDocuments':
                await this.searchDocuments(
                    params.query,
                    params.searchType,
                    params.topK,
                    params.threshold
                );
                break;
            case 'fetchEntities':
                await this.fetchEntities();
                break;
            case 'filterEntities':
                await this.filterEntities(params.nameContains, params.definitionContains);
                break;
        }
    };

    /**
     * Fetch all documents from wiki service
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
            console.debug(`fetch documents successfully`);
        } catch (error) {
            console.error('[KnowledgeManageComponent] Failed to fetch documents:', error);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Select a document to view/edit
     */
    private async selectDocument(documentId: string): Promise<void> {
        try {
            const client = getApolloClient();
            const { data } = await client.query({
                query: GET_DOCUMENT,
                variables: { where: { id: documentId } }
            });

            const doc = data.document;
            if (doc) {
                this.selectedDocumentId = documentId;
                this.currentDocument = doc;
                this.calculateBacklinks(documentId);
            }
        } catch (error) {
            console.error('[KnowledgeManageComponent] Failed to load document:', error);
        }
    }

    /**
     * Create a new document
     */
    private async createDocument(
        type: 'property' | 'relation',
        topic: string,
        content: string,
        entities: string[] = [],
        tags: string[] = []
    ): Promise<void> {
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
                await this.fetchDocuments();
            }
        } catch (error) {
            console.error('[KnowledgeManageComponent] Failed to create document:', error);
        }
    }

    /**
     * Update an existing document
     */
    private async updateDocument(
        documentId: string,
        topic?: string,
        content?: string,
        type?: 'property' | 'relation',
        entities?: string[],
        tags?: string[]
    ): Promise<void> {
        try {
            const client = getApolloClient();
            const { data } = await client.mutate({
                mutation: UPDATE_DOCUMENT,
                variables: {
                    input: {
                        documentId,
                        ...(topic !== undefined && { topic }),
                        ...(content !== undefined && { content }),
                        ...(type !== undefined && { type }),
                        ...(entities !== undefined && { entities }),
                        ...(tags !== undefined && { tags })
                    }
                }
            });

            if (data.updateDocument) {
                await this.fetchDocuments();
                if (this.selectedDocumentId === documentId) {
                    // Update current document if it's the selected one
                    this.currentDocument = data.updateDocument;
                }
            }
        } catch (error) {
            console.error('[KnowledgeManageComponent] Failed to update document:', error);
        }
    }

    /**
     * Delete a document
     */
    private async deleteDocument(documentId: string): Promise<void> {
        try {
            const client = getApolloClient();
            const { data } = await client.mutate({
                mutation: DELETE_DOCUMENT,
                variables: {
                    input: { documentId }
                }
            });

            if (data.deleteDocument) {
                await this.fetchDocuments();
                if (this.selectedDocumentId === documentId) {
                    this.selectedDocumentId = null;
                    this.currentDocument = null;
                    this.backlinks = [];
                }
            }
        } catch (error) {
            console.error('[KnowledgeManageComponent] Failed to delete document:', error);
        }
    }

    /**
     * Filter documents
     */
    private async filterDocuments(
        type?: 'property' | 'relation' | null,
        entities?: string[] | null,
        tags?: string[] | null,
        topicContains?: string | null,
        sortBy?: 'topic' | 'updateDate' | null,
        sortOrder?: 'asc' | 'desc' | null
    ): Promise<void> {
        let filtered = [...this.allDocuments];

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

        if (topicContains) {
            const query = topicContains.toLowerCase();
            filtered = filtered.filter(doc =>
                doc.topic.toLowerCase().includes(query)
            );
        }

        if (sortBy === 'topic') {
            filtered.sort((a, b) => a.topic.localeCompare(b.topic));
        } else if (sortBy === 'updateDate') {
            filtered.sort((a, b) => {
                const dateA = a.record[0]?.updateDate || '';
                const dateB = b.record[0]?.updateDate || '';
                return dateA.localeCompare(dateB);
            });
        }

        const effectiveSortOrder = sortOrder || 'asc';
        if (effectiveSortOrder === 'desc') {
            filtered.reverse();
        }

        this.allDocuments = filtered;
    }

    /**
     * Sort documents
     */
    private async sortDocuments(sortBy?: 'topic' | 'updateDate', sortOrder?: 'asc' | 'desc'): Promise<void> {
        if (sortBy) {
            if (sortBy === 'topic') {
                this.allDocuments.sort((a, b) => a.topic.localeCompare(b.topic));
            } else if (sortBy === 'updateDate') {
                this.allDocuments.sort((a, b) => {
                    const dateA = a.record[0]?.updateDate || '';
                    const dateB = b.record[0]?.updateDate || '';
                    return dateA.localeCompare(dateB);
                });
            }
        }

        if (sortOrder === 'desc') {
            this.allDocuments.reverse();
        }
    }

    /**
     * Search documents (keyword or semantic)
     */
    private async searchDocuments(
        query: string,
        searchType: 'keyword' | 'semantic' = 'keyword',
        topK: number = 10,
        threshold: number = 0.0
    ): Promise<void> {
        if (!query || query.length === 0) {
            this.searchResults = [];
            return;
        }

        try {
            const client = getApolloClient();
            let results: SearchResult[] = [];

            if (searchType === 'keyword') {
                const { data } = await client.query({
                    query: GET_DOCUMENTS,
                    variables: {
                        where: {
                            topic_contains: query
                        }
                    }
                });

                results = (data.documents || []).map((doc: Document) => ({
                    document: doc
                }));
            } else {
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

                results = (data.documents || []).map((doc: Document) => ({
                    document: doc
                }));
            }

            this.searchResults = results;
        } catch (error) {
            console.error('[KnowledgeManageComponent] Failed to perform search:', error);
            this.searchResults = [];
        }
    }

    /**
     * Fetch all entities from wiki service
     */
    private async fetchEntities(): Promise<void> {
        try {
            const client = getApolloClient();
            const { data } = await client.query({
                query: GET_ENTITIES,
                variables: { where: {} }
            });

            this.allEntities = data.entities || [];
            console.debug(`fetch entities successfully`);
        } catch (error) {
            console.error('[KnowledgeManageComponent] Failed to fetch entities:', error);
        }
    }

    /**
     * Filter entities
     */
    private async filterEntities(nameContains?: string | null, definitionContains?: string | null): Promise<void> {
        let filtered = [...this.allEntities];

        if (nameContains) {
            const query = nameContains.toLowerCase();
            filtered = filtered.filter(entity =>
                entity.nomenclature.some(n => n.name.toLowerCase().includes(query))
            );
        }

        if (definitionContains) {
            const query = definitionContains.toLowerCase();
            filtered = filtered.filter(entity =>
                entity.definition.toLowerCase().includes(query)
            );
        }

        this.allEntities = filtered;
    }

    /**
     * Calculate backlinks for a document
     */
    private calculateBacklinks(documentId: string): void {
        const targetDoc = this.allDocuments.find(d => d.id === documentId);
        if (!targetDoc) return;

        const content = (targetDoc.record[0]?.content || '').toLowerCase();
        const topic = targetDoc.topic.toLowerCase();

        this.backlinks = this.allDocuments.filter(doc => {
            if (doc.id === documentId) return false;

            const docContent = (doc.record[0]?.content || '').toLowerCase();
            const docTopic = doc.topic.toLowerCase();

            if (docContent.includes(topic)) return true;

            const hasCommonEntity = doc.entities.some(e => targetDoc.entities.includes(e));
            if (hasCommonEntity) return true;

            return false;
        });
    }
}
