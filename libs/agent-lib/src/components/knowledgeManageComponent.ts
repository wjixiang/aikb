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
import { ReactiveToolComponent } from './core/reactiveToolComponent.js';
import { tdiv } from './ui/tdiv.js';
import type { ToolCallResult } from './core/types.js';
import type { TUIElement } from './ui/TUIElement.js';
// @ts-expect-error - Apollo client has default export at runtime but TS types are inconsistent
import apollo from '@apollo/client';
import { loadErrorMessages, loadDevMessages } from '@apollo/client/dev';
import type {
  ApolloClient,
  NormalizedCacheObject,
  InMemoryCache,
  HttpLink,
} from '@apollo/client';

const {
  ApolloClient: ApolloClientClass,
  InMemoryCache: InMemoryCacheClass,
  HttpLink: HttpLinkClass,
  gql,
} = apollo;

loadDevMessages();
loadErrorMessages();

// GraphQL Client for medWiki-service
const WIKI_SERVICE_URL =
  (process.env as any)['WIKI_SERVICE_URL'] || 'http://localhost:3000';

let apolloClient: ApolloClient<NormalizedCacheObject> | null = null;

function getApolloClient(): ApolloClient<NormalizedCacheObject> {
  if (!apolloClient) {
    apolloClient = new ApolloClientClass({
      link: new HttpLinkClass({ uri: `${WIKI_SERVICE_URL}/graphql` }),
      cache: new InMemoryCacheClass(),
    });
  }
  return apolloClient as ApolloClient<NormalizedCacheObject>;
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

interface KnowledgeState {
  allDocuments: Document[];
  allEntities: Entity[];
  isLoading: boolean;
  selectedDocumentId: string | null;
  currentDocument: Document | null;
  searchResults: SearchResult[];
  backlinks: Document[];
}

/**
 * KnowledgeManageComponent
 * Provides comprehensive knowledge management capabilities similar to Obsidian/Notion
 */
export class KnowledgeManageComponent extends ReactiveToolComponent<KnowledgeState> {
  override componentId = 'knowledge-manage';
  override displayName = 'Knowledge Management';
  override description =
    'Manage documents, entities, and knowledge base operations';
  override componentPrompt = `## Knowledge Management

This component provides comprehensive knowledge management capabilities for document and entity operations.

**Core Operations:**
- Fetch and browse documents from the knowledge base
- Create, update, and delete documents with structured metadata
- Manage entities with semantic linking and backlinking
- Apply tags for organization and filtering
- Perform semantic search across the knowledge base

**Best Practices:**
- Use semantic search for finding related content
- Link entities to create a knowledge graph
- Apply consistent tagging for easy retrieval
- Export data in structured formats for analysis`;

  protected override initialState(): KnowledgeState {
    return {
      allDocuments: [],
      allEntities: [],
      isLoading: false,
      selectedDocumentId: null,
      currentDocument: null,
      searchResults: [],
      backlinks: [],
    };
  }

  protected override toolDefs() {
    return {
      fetchDocuments: {
        desc: 'Fetch all documents from the wiki service',
        paramsSchema: z.object({}),
      },
      selectDocument: {
        desc: 'Select a document to view/edit',
        paramsSchema: z.object({
          documentId: z.string().describe('ID of the document to select'),
        }),
      },
      createDocument: {
        desc: 'Create a new document',
        paramsSchema: z.object({
          type: z.enum(['property', 'relation']).describe('Document type'),
          topic: z.string().describe('Document topic/title'),
          content: z.string().describe('Document content in markdown'),
          entities: z.array(z.string()).optional().describe('Related entities'),
          tags: z.array(z.string()).optional().describe('Document tags'),
        }),
      },
      updateDocument: {
        desc: 'Update an existing document',
        paramsSchema: z.object({
          documentId: z.string().describe('ID of the document to update'),
          topic: z.string().optional().describe('Document topic/title'),
          content: z
            .string()
            .optional()
            .describe('Document content in markdown'),
          type: z
            .enum(['property', 'relation'])
            .optional()
            .describe('Document type'),
          entities: z.array(z.string()).optional().describe('Related entities'),
          tags: z.array(z.string()).optional().describe('Document tags'),
        }),
      },
      deleteDocument: {
        desc: 'Delete a document',
        paramsSchema: z.object({
          documentId: z.string().describe('ID of the document to delete'),
        }),
      },
      filterDocuments: {
        desc: 'Filter documents by type, entities, tags, or topic',
        paramsSchema: z.object({
          type: z
            .enum(['property', 'relation'])
            .optional()
            .describe('Document type filter'),
          entities: z.array(z.string()).optional().describe('Entity filter'),
          tags: z.array(z.string()).optional().describe('Tag filter'),
          topicContains: z
            .string()
            .optional()
            .describe('Topic contains filter'),
          sortBy: z
            .enum(['topic', 'updateDate'])
            .optional()
            .describe('Sort field'),
          sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort order'),
        }),
      },
      sortDocuments: {
        desc: 'Sort documents by topic or update date',
        paramsSchema: z.object({
          sortBy: z
            .enum(['topic', 'updateDate'])
            .optional()
            .describe('Sort field'),
          sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort order'),
        }),
      },
      searchDocuments: {
        desc: 'Search documents by keyword or semantic search',
        paramsSchema: z.object({
          query: z.string().describe('Search query text'),
          searchType: z
            .enum(['keyword', 'semantic'])
            .describe('Search type: keyword or semantic'),
          topK: z.number().optional().describe('Number of results to return'),
          threshold: z
            .number()
            .optional()
            .describe('Similarity threshold for semantic search'),
        }),
      },
      fetchEntities: {
        desc: 'Fetch all entities from the wiki service',
        paramsSchema: z.object({}),
      },
      filterEntities: {
        desc: 'Filter entities by name or definition',
        paramsSchema: z.object({
          nameContains: z.string().optional().describe('Name contains filter'),
          definitionContains: z
            .string()
            .optional()
            .describe('Definition contains filter'),
        }),
      },
    };
  }

  constructor() {
    super();
    this.fetchDocuments();
    this.fetchEntities();
  }

  renderImply = async (): Promise<TUIElement[]> => {
    const s = this.snapshot;

    const docList = s.allDocuments
      .map((doc: Document, i: number) => {
        const isSelected = doc.id === s.selectedDocumentId;
        const marker = isSelected ? '→ ' : '  ';
        return `${marker}${i + 1}. ${doc.type}: ${doc.topic}`;
      })
      .join('\n');

    let viewerContent = '';
    if (!s.currentDocument) {
      viewerContent = '*No document selected. Please select a document first.*';
    } else {
      viewerContent = `**Selected Document:** ${s.currentDocument.type}: ${s.currentDocument.topic}\n\n---`;
      if (s.currentDocument.record[0]) {
        viewerContent += `\n${s.currentDocument.record[0].content}`;
      }
    }

    const resultsList =
      s.searchResults.length > 0
        ? s.searchResults
            .map((r: SearchResult, i: number) => {
              const title = r.document.topic;
              const score = r.score ? `(score: ${r.score.toFixed(3)})` : '';
              const content = r.matchedContent ? `\n${r.matchedContent}` : '';
              return `${'>'.repeat(6)}RESULT${i + 1}${'<'.repeat(6)}\n**${title}**${score}${content}`;
            })
            .join('\n--------------------\n')
        : '*No results*';

    const backlinksList =
      s.backlinks.length > 0
        ? s.backlinks
            .map((doc: Document, i: number) => {
              const marker = '↗';
              return `${marker} ${i + 1}. ${doc.type}: ${doc.topic}`;
            })
            .join('\n')
        : '*No backlinks*';

    return [
      new tdiv({
        content: '## 📚 Document List',
        styles: { width: 80, showBorder: false, margin: { bottom: 1 } },
      }),
      new tdiv({
        content: docList,
        styles: { width: 80, showBorder: false },
      }),
      new tdiv({
        content: viewerContent,
        styles: { width: 80, showBorder: false, margin: { bottom: 1 } },
      }),
      new tdiv({
        content: '### 🔍 Search',
        styles: { width: 80, showBorder: false, margin: { bottom: 1 } },
      }),
      new tdiv({
        content: `[search_query]: ${s.searchResults.length > 0 ? s.searchResults[0].document.topic.substring(0, 30) : '*None*'}`,
        styles: { width: 80, showBorder: false, margin: { bottom: 1 } },
      }),
      new tdiv({
        content: '-----Results-----\n' + resultsList,
        styles: { width: 80, showBorder: false },
      }),
      new tdiv({
        content: '### 🔗 Backlinks',
        styles: { width: 80, showBorder: false, margin: { bottom: 1 } },
      }),
      new tdiv({
        content: backlinksList,
        styles: { width: 80, showBorder: false },
      }),
    ];
  };

  async onFetchDocuments(): Promise<ToolCallResult<any>> {
    await this.fetchDocuments();
    return {
      success: true,
      data: { count: this.snapshot.allDocuments.length },
      summary: `[Knowledge] 获取文档: ${this.snapshot.allDocuments.length} 个`,
    };
  }

  async onSelectDocument(params: {
    documentId: string;
  }): Promise<ToolCallResult<any>> {
    await this.selectDocument(params.documentId);
    return {
      success: true,
      data: { documentId: params.documentId },
      summary: `[Knowledge] 选择文档: ${params.documentId}`,
    };
  }

  async onCreateDocument(params: {
    type: 'property' | 'relation';
    topic: string;
    content: string;
    entities?: string[];
    tags?: string[];
  }): Promise<ToolCallResult<any>> {
    await this.createDocument(
      params.type,
      params.topic,
      params.content,
      params.entities || [],
      params.tags || [],
    );
    return {
      success: true,
      data: { topic: params.topic, type: params.type },
      summary: `[Knowledge] 创建文档: ${params.topic}`,
    };
  }

  async onUpdateDocument(params: {
    documentId: string;
    topic?: string;
    content?: string;
    type?: 'property' | 'relation';
    entities?: string[];
    tags?: string[];
  }): Promise<ToolCallResult<any>> {
    await this.updateDocument(
      params.documentId,
      params.topic,
      params.content,
      params.type,
      params.entities,
      params.tags,
    );
    return {
      success: true,
      data: { documentId: params.documentId },
      summary: `[Knowledge] 更新文档: ${params.documentId}`,
    };
  }

  async onDeleteDocument(params: {
    documentId: string;
  }): Promise<ToolCallResult<any>> {
    await this.deleteDocument(params.documentId);
    return {
      success: true,
      data: { documentId: params.documentId },
      summary: `[Knowledge] 删除文档: ${params.documentId}`,
    };
  }

  async onFilterDocuments(params: {
    type?: 'property' | 'relation' | null;
    entities?: string[] | null;
    tags?: string[] | null;
    topicContains?: string | null;
    sortBy?: 'topic' | 'updateDate' | null;
    sortOrder?: 'asc' | 'desc' | null;
  }): Promise<ToolCallResult<any>> {
    await this.filterDocuments(
      params.type,
      params.entities,
      params.tags,
      params.topicContains,
      params.sortBy,
      params.sortOrder,
    );
    return {
      success: true,
      data: { filters: params },
      summary: `[Knowledge] 筛选文档`,
    };
  }

  async onSortDocuments(params: {
    sortBy?: 'topic' | 'updateDate';
    sortOrder?: 'asc' | 'desc';
  }): Promise<ToolCallResult<any>> {
    await this.sortDocuments(params.sortBy, params.sortOrder);
    return {
      success: true,
      data: { sortBy: params.sortBy },
      summary: `[Knowledge] 排序文档: ${params.sortBy}`,
    };
  }

  async onSearchDocuments(params: {
    query: string;
    searchType: 'keyword' | 'semantic';
    topK?: number;
    threshold?: number;
  }): Promise<ToolCallResult<any>> {
    await this.searchDocuments(
      params.query,
      params.searchType,
      params.topK,
      params.threshold,
    );
    return {
      success: true,
      data: {
        query: params.query,
        results: this.snapshot.searchResults.length,
      },
      summary: `[Knowledge] 搜索: ${params.query}, 找到 ${this.snapshot.searchResults.length} 个结果`,
    };
  }

  async onFetchEntities(): Promise<ToolCallResult<any>> {
    await this.fetchEntities();
    return {
      success: true,
      data: { count: this.snapshot.allEntities.length },
      summary: `[Knowledge] 获取实体: ${this.snapshot.allEntities.length} 个`,
    };
  }

  async onFilterEntities(params: {
    nameContains?: string | null;
    definitionContains?: string | null;
  }): Promise<ToolCallResult<any>> {
    await this.filterEntities(params.nameContains, params.definitionContains);
    return {
      success: true,
      data: { filters: params },
      summary: `[Knowledge] 筛选实体`,
    };
  }

  private async fetchDocuments(): Promise<void> {
    try {
      this.reactive.isLoading = true;
      const client = getApolloClient();
      const { data } = await client.query({
        query: GET_DOCUMENTS,
        variables: { where: {} },
      });

      this.reactive.allDocuments = data.documents || [];
      console.debug(`fetch documents successfully`);
    } catch (error) {
      console.error(
        '[KnowledgeManageComponent] Failed to fetch documents:',
        error,
      );
    } finally {
      this.reactive.isLoading = false;
    }
  }

  private async selectDocument(documentId: string): Promise<void> {
    try {
      const client = getApolloClient();
      const { data } = await client.query({
        query: GET_DOCUMENT,
        variables: { where: { id: documentId } },
      });

      const doc = data.document;
      if (doc) {
        this.reactive.selectedDocumentId = documentId;
        this.reactive.currentDocument = doc;
        this.calculateBacklinks(documentId);
      }
    } catch (error) {
      console.error(
        '[KnowledgeManageComponent] Failed to load document:',
        error,
      );
    }
  }

  private async createDocument(
    type: 'property' | 'relation',
    topic: string,
    content: string,
    entities: string[] = [],
    tags: string[] = [],
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
            tags,
          },
        },
      });

      if (data.createDocument) {
        await this.fetchDocuments();
      }
    } catch (error) {
      console.error(
        '[KnowledgeManageComponent] Failed to create document:',
        error,
      );
    }
  }

  private async updateDocument(
    documentId: string,
    topic?: string,
    content?: string,
    type?: 'property' | 'relation',
    entities?: string[],
    tags?: string[],
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
            ...(tags !== undefined && { tags }),
          },
        },
      });

      if (data.updateDocument) {
        await this.fetchDocuments();
        if (this.snapshot.selectedDocumentId === documentId) {
          this.reactive.currentDocument = data.updateDocument;
        }
      }
    } catch (error) {
      console.error(
        '[KnowledgeManageComponent] Failed to update document:',
        error,
      );
    }
  }

  private async deleteDocument(documentId: string): Promise<void> {
    try {
      const client = getApolloClient();
      const { data } = await client.mutate({
        mutation: DELETE_DOCUMENT,
        variables: {
          input: { documentId },
        },
      });

      if (data.deleteDocument) {
        await this.fetchDocuments();
        if (this.snapshot.selectedDocumentId === documentId) {
          this.reactive.selectedDocumentId = null;
          this.reactive.currentDocument = null;
          this.reactive.backlinks = [];
        }
      }
    } catch (error) {
      console.error(
        '[KnowledgeManageComponent] Failed to delete document:',
        error,
      );
    }
  }

  private async filterDocuments(
    type?: 'property' | 'relation' | null,
    entities?: string[] | null,
    tags?: string[] | null,
    topicContains?: string | null,
    sortBy?: 'topic' | 'updateDate' | null,
    sortOrder?: 'asc' | 'desc' | null,
  ): Promise<void> {
    let filtered = [...this.snapshot.allDocuments];

    if (type) {
      filtered = filtered.filter((doc) => doc.type === type);
    }

    if (entities && entities.length > 0) {
      filtered = filtered.filter((doc) =>
        entities.some((e: string) => doc.entities.includes(e)),
      );
    }

    if (tags && tags.length > 0) {
      filtered = filtered.filter((doc) =>
        tags.some((t: string) => doc.metadata.tags.includes(t)),
      );
    }

    if (topicContains) {
      const query = topicContains.toLowerCase();
      filtered = filtered.filter((doc) =>
        doc.topic.toLowerCase().includes(query),
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

    this.reactive.allDocuments = filtered;
  }

  private async sortDocuments(
    sortBy?: 'topic' | 'updateDate',
    sortOrder?: 'asc' | 'desc',
  ): Promise<void> {
    let sorted = [...this.snapshot.allDocuments];

    if (sortBy) {
      if (sortBy === 'topic') {
        sorted.sort((a, b) => a.topic.localeCompare(b.topic));
      } else if (sortBy === 'updateDate') {
        sorted.sort((a, b) => {
          const dateA = a.record[0]?.updateDate || '';
          const dateB = b.record[0]?.updateDate || '';
          return dateA.localeCompare(dateB);
        });
      }
    }

    if (sortOrder === 'desc') {
      sorted.reverse();
    }

    this.reactive.allDocuments = sorted;
  }

  private async searchDocuments(
    query: string,
    searchType: 'keyword' | 'semantic' = 'keyword',
    topK: number = 10,
    threshold: number = 0.0,
  ): Promise<void> {
    if (!query || query.length === 0) {
      this.reactive.searchResults = [];
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
              topic_contains: query,
            },
          },
        });

        results = (data.documents || []).map((doc: Document) => ({
          document: doc,
        }));
      } else {
        const { data } = await client.query({
          query: GET_DOCUMENTS,
          variables: {
            where: {
              document_semantic_search: {
                searchText: query,
                topK,
                threshold,
              },
            },
          },
        });

        results = (data.documents || []).map((doc: Document) => ({
          document: doc,
        }));
      }

      this.reactive.searchResults = results;
    } catch (error) {
      console.error(
        '[KnowledgeManageComponent] Failed to perform search:',
        error,
      );
      this.reactive.searchResults = [];
    }
  }

  private async fetchEntities(): Promise<void> {
    try {
      const client = getApolloClient();
      const { data } = await client.query({
        query: GET_ENTITIES,
        variables: { where: {} },
      });

      this.reactive.allEntities = data.entities || [];
      console.debug(`fetch entities successfully`);
    } catch (error) {
      console.error(
        '[KnowledgeManageComponent] Failed to fetch entities:',
        error,
      );
    }
  }

  private async filterEntities(
    nameContains?: string | null,
    definitionContains?: string | null,
  ): Promise<void> {
    let filtered = [...this.snapshot.allEntities];

    if (nameContains) {
      const query = nameContains.toLowerCase();
      filtered = filtered.filter((entity) =>
        entity.nomenclature.some((n) => n.name.toLowerCase().includes(query)),
      );
    }

    if (definitionContains) {
      const query = definitionContains.toLowerCase();
      filtered = filtered.filter((entity) =>
        entity.definition.toLowerCase().includes(query),
      );
    }

    this.reactive.allEntities = filtered;
  }

  private calculateBacklinks(documentId: string): void {
    const allDocs = this.snapshot.allDocuments;
    const targetDoc = allDocs.find((d) => d.id === documentId);
    if (!targetDoc) return;

    const content = (targetDoc.record[0]?.content || '').toLowerCase();
    const topic = targetDoc.topic.toLowerCase();

    this.reactive.backlinks = allDocs.filter((doc) => {
      if (doc.id === documentId) return false;

      const docContent = (doc.record[0]?.content || '').toLowerCase();

      if (docContent.includes(topic)) return true;

      const hasCommonEntity = doc.entities.some((e) =>
        targetDoc.entities.includes(e),
      );
      if (hasCommonEntity) return true;

      return false;
    });
  }
}
