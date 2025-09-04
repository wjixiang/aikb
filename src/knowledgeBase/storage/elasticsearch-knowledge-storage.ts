import { Client } from "@elastic/elasticsearch";
import { KnowledgeData, KnowledgeDataWithId, ElasticsearchKnowledgeDocument, ElasticsearchKnowledgeResponse } from "../knowledge.type";
import { AbstractKnowledgeStorage } from "./abstract-storage";
import createLoggerWithPrefix from "../logger";


export default class ElasticsearchKnowledgeStorage extends AbstractKnowledgeStorage {
    private readonly indexName = 'entities';
    private client: Client;

    logger = createLoggerWithPrefix('ElasticsearchKnowledgeStorage');

    constructor(elasticsearchUrl: string = 'http://localhost:9200') {
        super();
        this.client = new Client({
        node: elasticsearchUrl,
        auth: {
            apiKey: process.env.ELASTICSEARCH_URL_API_KEY || ""
        }
        });
    }

    async create_new_knowledge(knowledge: KnowledgeData): Promise<KnowledgeDataWithId> {
        try {


            await this.initializeIndex();
            
            // Generate a unique ID for the knowledge
            const knowledgeId = `knowledge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Transform the scopePath.scopes array of arrays into a format Elasticsearch can handle
            const transformedScopePath = {
                ...knowledge.scopePath,
                scopes: knowledge.scopePath.scopes.map(scope => ({
                    items: scope
                }))
            };

            const knowledgeWithMetadata: ElasticsearchKnowledgeDocument = {
                ...knowledge,
                knowledgeId: knowledgeId, // Use knowledgeId instead of id to avoid conflicts
                scopePathString: this.formatScopePath(knowledge.scopePath),
                createdAt: new Date().toISOString(),
            };

            // Create document body for Elasticsearch
            const documentBody = {
                ...knowledge,
                scopePath: transformedScopePath,
                scopePathString: this.formatScopePath(knowledge.scopePath),
                createdAt: knowledgeWithMetadata.createdAt,
                knowledgeId: knowledgeId, // Include knowledgeId in the document body
            };

            await this.client.index({
                index: this.indexName,
                id: knowledgeId,
                body: documentBody,
            });

            // Create a proper KnowledgeDataWithId object with the id field
            const result: KnowledgeDataWithId = {
                ...knowledge,
                id: knowledgeId,
                scopePathString: documentBody.scopePathString,
            };

            this.logger.info(`Created knowledge with id: ${knowledgeId}`);
            return result;
        } catch (error) {
            this.logger.error('Failed to create knowledge:', error);
            throw error;
        }
    }

    /**
     * Format scopePath for easier searching
     */
    private formatScopePath(scopePath: { entities: string[]; scopes: string[][] }): string {
        return `${scopePath.entities.join('.')}|${scopePath.scopes.map(s => s.join('.')).join('|')}`;
    }

    /**
     * Initialize the index with proper mappings
     */
    private async initializeIndex(): Promise<void> {
        try {
            const exists = await this.client.indices.exists({ index: this.indexName });
            
            if (!exists) {
                await this.client.indices.create({
                    index: this.indexName,
                    body: {
                        mappings: {
                            properties: {
                                scopePath: {
                                    type: 'object',
                                    properties: {
                                        entities: {
                                            type: 'text',
                                            fields: {
                                                keyword: {
                                                    type: 'keyword',
                                                },
                                            },
                                        },
                                        scopes: {
                                            type: 'nested',
                                            properties: {
                                                // Each scope is transformed from an array to an object with an items property
                                                // This allows us to store arrays of arrays in Elasticsearch
                                                items: {
                                                    type: 'text',
                                                    fields: {
                                                        keyword: {
                                                            type: 'keyword',
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                                scopePathString: {
                                    type: 'keyword',
                                },
                                content: {
                                    type: 'text',
                                    analyzer: 'standard',
                                },
                                metadata: {
                                    type: 'object',
                                    properties: {
                                        tags: {
                                            type: 'text',
                                            fields: {
                                                keyword: {
                                                    type: 'keyword',
                                                },
                                            },
                                        },
                                        createDate: {
                                            type: 'date',
                                        },
                                    },
                                },
                                id: {
                                    type: 'keyword',
                                },
                                createdAt: {
                                    type: 'date',
                                },
                            },
                        },
                    } as any,
                });
                this.logger.info(`Created index: ${this.indexName}`);
            }
        } catch (error) {
            // If index already exists, just continue
            if (error?.meta?.body?.error?.type === 'resource_already_exists_exception') {
                this.logger.info(`Index ${this.indexName} already exists, continuing`);
                return;
            }
            this.logger.error('Failed to initialize index:', error);
            throw error;
        }
    }
    
}