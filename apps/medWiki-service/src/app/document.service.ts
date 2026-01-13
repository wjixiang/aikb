import { Inject, Injectable } from '@nestjs/common';
import { CreateDocumentInput, Document, UpdateDocumentInput, DeleteDocumentInput, DocumentWhereInput, SemanticSearchInput } from '../graphql';
import { WIKI_PRISMA_SERVICE_TOKEN } from './entity.service';
import { wikiPrismaService } from 'wiki-db';
import { randomUUID } from 'crypto';
import { EmbeddingService } from 'EmbeddingModule';
import { defaultEmbeddingConfig } from 'embedding';


@Injectable()
export class DocumentService {
    constructor(
        @Inject(WIKI_PRISMA_SERVICE_TOKEN) // For test purposes, need to use custom token to assure mocking
        private storageService: wikiPrismaService,
        private embeddingService: EmbeddingService,
    ) { }

    async createDocument(input: CreateDocumentInput): Promise<Document> {
        // Generate embedding for the document
        const embeddingResult = await this.embeddingService.embed({
            text: input.topic + "\n" + input.content,
        });

        if (!embeddingResult.success || !embeddingResult.embedding) {
            throw new Error(
                `Failed to generate embedding: ${embeddingResult.error || 'Unknown error'}`
            );
        }

        // Create the document with its embedding
        // Note: The 'vector' field is marked as Unsupported in Prisma schema,
        // so we cannot set it directly. The vector storage is handled separately.
        const embeddingId = randomUUID();
        const documentId = randomUUID();

        const dbDocument = await this.storageService.document.create({
            data: {
                id: documentId,
                topic: input.topic,
                type: input.type as unknown as string,
                entities: input.entities,
                records: {
                    create: {
                        topic: input.topic,
                        content: input.content,
                    },
                },
                embedding: {
                    create: {
                        id: embeddingId,
                        model: defaultEmbeddingConfig.model as string,
                        dimension: defaultEmbeddingConfig.dimension,
                        provider: embeddingResult.provider || defaultEmbeddingConfig.provider,
                    },
                },
                documentEmbeddingId: embeddingId
            },
            include: {
                records: {
                    orderBy: {
                        id: 'desc'
                    }
                }
            }
        });

        // Insert embedding vector
        // Only insert vector if embedding was successful and we have a valid vector
        if (embeddingResult.success && embeddingResult.embedding && Array.isArray(embeddingResult.embedding) && embeddingResult.embedding.length > 0) {

            const vectorUpdatedResult = await this.storageService.$queryRawUnsafe(
                `UPDATE "DocumentEmbedding" SET vector = \'[${embeddingResult.embedding.join(',')}]\' WHERE id = '${embeddingId}';`
            )
        }

        // Map Prisma document to GraphQL Document type
        const document: Document = {
            id: dbDocument.id,
            type: input.type,
            entities: input.entities,
            topic: dbDocument.topic,
            record: dbDocument.records.map(r => ({
                topic: r.topic,
                content: r.content,
                updateDate: new Date().toISOString(),
            })),
            metadata: {
                tags: [], // Tags not currently stored in database
            },
        };

        return document;
    }

    async updateDocument(input: UpdateDocumentInput): Promise<Document> {
        // Prepare update data for the document
        const updateData: any = {};

        if (input.topic !== undefined) {
            updateData.topic = input.topic;
        }

        if (input.type !== undefined) {
            updateData.type = input.type as unknown as string;
        }

        if (input.entities !== undefined) {
            updateData.entities = input.entities;
        }

        // If content is provided, we need to:
        // 1. Create a new record entry
        // 2. Regenerate the embedding
        if (input.content !== undefined) {
            // Get the current document to preserve topic if not provided
            const currentDoc = await this.storageService.document.findUnique({
                where: { id: input.documentId },
            });

            if (!currentDoc) {
                throw new Error(`Document with id ${input.documentId} not found`);
            }

            const topicToUse = input.topic ?? currentDoc.topic;

            // Generate new embedding for the updated content
            const embeddingResult = await this.embeddingService.embed({
                text: topicToUse + "\n" + input.content,
            });

            if (!embeddingResult.success || !embeddingResult.embedding) {
                throw new Error(
                    `Failed to generate embedding: ${embeddingResult.error || 'Unknown error'}`
                );
            }

            // Update the embedding
            updateData.embedding = {
                update: {
                    model: defaultEmbeddingConfig.model as string,
                    dimension: defaultEmbeddingConfig.dimension,
                    provider: embeddingResult.provider || defaultEmbeddingConfig.provider,
                },
            };

            // Create a new record entry
            updateData.records = {
                create: {
                    topic: topicToUse,
                    content: input.content,
                },
            };
        }

        // Update the document
        const updatedResult = await this.storageService.document.update({
            where: {
                id: input.documentId
            },
            data: updateData,
        });

        // Fetch all records for the updated document
        const allRecords = await this.storageService.record.findMany({
            where: {
                documentId: updatedResult.id
            },
            orderBy: {
                // Assuming there's a createdAt field or we use the id as a proxy
                id: 'desc'
            }
        });

        // Map Prisma records to DocumentRecord format
        const documentRecords = allRecords.map(r => ({
            topic: r.topic,
            content: r.content,
            updateDate: r.id.substring(0, 8) === r.id.substring(0, 8)
                ? new Date().toISOString()
                : new Date().toISOString(), // In production, you'd have a proper timestamp
        }));

        // Map Prisma document to GraphQL Document type
        const document: Document = {
            id: updatedResult.id,
            type: updatedResult.type as any,
            entities: updatedResult.entities,
            topic: updatedResult.topic,
            record: documentRecords,
        };

        return document;
    }

    async deleteDocument(input: DeleteDocumentInput): Promise<Document> {
        // First, fetch the document before deletion to return it
        const document = await this.storageService.document.findUnique({
            where: { id: input.documentId },
            include: {
                records: {
                    orderBy: {
                        id: 'desc'
                    }
                }
            }
        });

        if (!document) {
            throw new Error(`Document with id ${input.documentId} not found`);
        }

        // Delete the document (Prisma will handle cascading deletes for related records)
        await this.storageService.document.delete({
            where: { id: input.documentId }
        });

        // Return the deleted document
        return {
            id: document.id,
            type: document.type as any,
            entities: document.entities,
            topic: document.topic,
            record: document.records.map(r => ({
                topic: r.topic,
                content: r.content,
                updateDate: new Date().toISOString(),
            })),
            metadata: {
                tags: [], // Tags not currently stored in database
            },
        };
    }

    /**
     * Get a single document based on filter criteria
     * @param filter - The filter criteria to match documents
     * @returns The first matching document or null if no match found
     */
    async getDocument(filter: DocumentWhereInput): Promise<Document | null> {
        // Identify semantic search query
        if (filter.topic_semantic_search) {
            const results = await this.performSemanticSearch(filter.topic_semantic_search, 1);
            return results.length > 0 ? results[0] : null;
        } else if (filter.record_semantic_search) {
            const results = await this.performRecordSemanticSearch(filter.record_semantic_search, 1);
            return results.length > 0 ? results[0] : null;
        } else {
            const prismaFilter = this.convertToPrismaWhere(filter);
            const document = await this.storageService.document.findFirst({
                where: prismaFilter,
                include: {
                    records: {
                        orderBy: {
                            id: 'desc'
                        }
                    }
                }
            });
            return document ? this.convertToGraphQLDocument(document) : null;
        }
    }

    /**
     * Get all documents based on filter criteria
     * @param filter - The filter criteria to match documents
     * @returns Array of matching documents
     */
    async getDocuments(filter: DocumentWhereInput): Promise<Document[]> {
        // Identify semantic search query
        if (filter.topic_semantic_search) {
            return this.performSemanticSearch(filter.topic_semantic_search);
        } else if (filter.record_semantic_search) {
            return this.performRecordSemanticSearch(filter.record_semantic_search);
        } else {
            const prismaFilter = this.convertToPrismaWhere(filter);
            const documents = await this.storageService.document.findMany({
                where: prismaFilter,
                include: {
                    records: {
                        orderBy: {
                            id: 'desc'
                        }
                    }
                }
            });
            return documents.map(d => this.convertToGraphQLDocument(d));
        }
    }

    /**
     * Perform semantic search on document topics
     * @param semanticSearchInput - The semantic search parameters
     * @param limit - Optional limit for number of results
     * @returns Array of matching documents ordered by similarity
     */
    private async performSemanticSearch(
        semanticSearchInput: SemanticSearchInput,
        limit?: number
    ): Promise<Document[]> {
        // Generate embedding for the search query
        const embeddingResult = await this.embeddingService.embed({
            text: semanticSearchInput.searchText,
        });

        if (!embeddingResult.success || !embeddingResult.embedding) {
            throw new Error(
                `Failed to generate embedding: ${embeddingResult.error || 'Unknown error'}`
            );
        }

        const searchVector = embeddingResult.embedding;
        const topK = limit ?? semanticSearchInput.topK ?? 10;
        const threshold = semanticSearchInput.threshold ?? 0.0;

        // Convert searchVector to PostgreSQL vector format
        const vectorString = `[${searchVector.join(',')}]`;

        try {
            // Use pgvector's <=> operator for cosine similarity with raw SQL
            const results = (await this.storageService.$queryRawUnsafe(
                `
                SELECT
                    d.id,
                    d.topic,
                    1 - (de.vector <=> $1::vector) as similarity
                FROM documents d
                INNER JOIN "DocumentEmbedding" de ON d."documentEmbeddingId" = de.id
                WHERE 1 - (de.vector <=> $1::vector) >= $2
                ORDER BY similarity DESC
                LIMIT $3
            `,
                vectorString,
                threshold,
                topK,
            )) as any[];

            if (results.length === 0) {
                return [];
            }

            // Fetch full document data with records for all matching IDs
            const documentIds = results.map((r) => r.id);
            const documents = await this.storageService.document.findMany({
                where: {
                    id: { in: documentIds },
                },
                include: {
                    records: {
                        orderBy: {
                            id: 'desc'
                        }
                    }
                },
            });

            // Sort documents by similarity score from the search results
            const documentMap = new Map(
                documents.map((d) => [d.id, this.convertToGraphQLDocument(d)])
            );

            return results
                .map((r) => documentMap.get(r.id))
                .filter((d): d is Document => d !== undefined);
        } catch (error) {
            console.error('Error in semantic search:', error);
            throw error;
        }
    }

    /**
     * Perform semantic search on document records
     * @param semanticSearchInput - The semantic search parameters
     * @param limit - Optional limit for number of results
     * @returns Array of matching documents ordered by similarity
     */
    private async performRecordSemanticSearch(
        semanticSearchInput: SemanticSearchInput,
        limit?: number
    ): Promise<Document[]> {
        // Generate embedding for the search query
        const embeddingResult = await this.embeddingService.embed({
            text: semanticSearchInput.searchText,
        });

        if (!embeddingResult.success || !embeddingResult.embedding) {
            throw new Error(
                `Failed to generate embedding: ${embeddingResult.error || 'Unknown error'}`
            );
        }

        const searchVector = embeddingResult.embedding;
        const topK = limit ?? semanticSearchInput.topK ?? 10;
        const threshold = semanticSearchInput.threshold ?? 0.0;

        // Convert searchVector to PostgreSQL vector format
        const vectorString = `[${searchVector.join(',')}]`;

        try {
            // Use pgvector's <=> operator for cosine similarity with raw SQL
            // Note: Records don't have embeddings directly, so we search by document topic
            const results = (await this.storageService.$queryRawUnsafe(
                `
                SELECT DISTINCT
                    d.id,
                    d.topic,
                    1 - (de.vector <=> $1::vector) as similarity
                FROM documents d
                INNER JOIN "DocumentEmbedding" de ON d."documentEmbeddingId" = de.id
                WHERE 1 - (de.vector <=> $1::vector) >= $2
                ORDER BY similarity DESC
                LIMIT $3
            `,
                vectorString,
                threshold,
                topK,
            )) as any[];

            if (results.length === 0) {
                return [];
            }

            // Fetch full document data with records for all matching IDs
            const documentIds = results.map((r) => r.id);
            const documents = await this.storageService.document.findMany({
                where: {
                    id: { in: documentIds },
                },
                include: {
                    records: {
                        orderBy: {
                            id: 'desc'
                        }
                    }
                },
            });

            // Sort documents by similarity score from the search results
            const documentMap = new Map(
                documents.map((d) => [d.id, this.convertToGraphQLDocument(d)])
            );

            return results
                .map((r) => documentMap.get(r.id))
                .filter((d): d is Document => d !== undefined);
        } catch (error) {
            console.error('Error in record semantic search:', error);
            throw error;
        }
    }

    /**
     * Convert GraphQL filter to Prisma where clause
     * @param filter - The GraphQL filter input
     * @returns Prisma where clause
     */
    private convertToPrismaWhere(filter: DocumentWhereInput): any {
        if (!filter) {
            return {};
        }

        const where: any = {};

        // Handle NOT operator
        if (filter.NOT) {
            where.NOT = this.convertToPrismaWhere(filter.NOT);
        }

        // Handle AND operator
        if (filter.AND && filter.AND.length > 0) {
            where.AND = filter.AND.map(f => this.convertToPrismaWhere(f));
        }

        // Handle OR operator
        if (filter.OR && filter.OR.length > 0) {
            where.OR = filter.OR.map(f => this.convertToPrismaWhere(f));
        }

        // Filter by id
        if (filter.id !== undefined && filter.id !== null) {
            where.id = filter.id;
        }

        // Filter by id_in
        if (filter.id_in && filter.id_in.length > 0) {
            where.id = { in: filter.id_in };
        }

        // Filter by id_not_in
        if (filter.id_not_in && filter.id_not_in.length > 0) {
            where.id = { notIn: filter.id_not_in };
        }

        // Filter by type
        if (filter.type !== undefined && filter.type !== null) {
            where.type = filter.type as unknown as string;
        }

        // Filter by type_in
        if (filter.type_in && filter.type_in.length > 0) {
            where.type = { in: filter.type_in.map(t => t as unknown as string) };
        }

        // Filter by type_not_in
        if (filter.type_not_in && filter.type_not_in.length > 0) {
            where.type = { notIn: filter.type_not_in.map(t => t as unknown as string) };
        }

        // Filter by entities (array contains)
        if (filter.entities !== undefined && filter.entities !== null) {
            where.entities = { has: filter.entities };
        }

        // Filter by entities_in
        if (filter.entities_in && filter.entities_in.length > 0) {
            where.entities = { hasEvery: filter.entities_in };
        }

        // Filter by entities_not_in
        if (filter.entities_not_in && filter.entities_not_in.length > 0) {
            where.entities = { hasNone: filter.entities_not_in };
        }

        // Filter by entities_contains
        if (filter.entities_contains !== undefined && filter.entities_contains !== null) {
            where.entities = { has: filter.entities_contains };
        }

        // Filter by entities_starts_with
        if (filter.entities_starts_with !== undefined && filter.entities_starts_with !== null) {
            where.entities = { has: filter.entities_starts_with };
        }

        // Filter by entities_ends_with
        if (filter.entities_ends_with !== undefined && filter.entities_ends_with !== null) {
            where.entities = { has: filter.entities_ends_with };
        }

        // Filter by topic
        if (filter.topic !== undefined && filter.topic !== null) {
            where.topic = filter.topic;
        }

        // Filter by topic_contains
        if (filter.topic_contains !== undefined && filter.topic_contains !== null) {
            where.topic = { contains: filter.topic_contains, mode: 'insensitive' };
        }

        // Filter by topic_starts_with
        if (filter.topic_starts_with !== undefined && filter.topic_starts_with !== null) {
            where.topic = { startsWith: filter.topic_starts_with, mode: 'insensitive' };
        }

        // Filter by topic_ends_with
        if (filter.topic_ends_with !== undefined && filter.topic_ends_with !== null) {
            where.topic = { endsWith: filter.topic_ends_with, mode: 'insensitive' };
        }

        // Filter by topic_in
        if (filter.topic_in && filter.topic_in.length > 0) {
            where.topic = { in: filter.topic_in };
        }

        // Filter by topic_not_in
        if (filter.topic_not_in && filter.topic_not_in.length > 0) {
            where.topic = { notIn: filter.topic_not_in };
        }

        // Filter by metadata
        if (filter.metadata) {
            // Note: metadata is not directly stored in the Prisma schema
            // This would need to be implemented if metadata fields are added to the database
            console.warn('Metadata filtering is not yet implemented');
        }

        // Filter by record (exact match on at least one record)
        if (filter.record) {
            where.records = { some: this.convertRecordFilter(filter.record) };
        }

        // Filter by record_some (at least one record matches)
        if (filter.record_some) {
            where.records = { some: this.convertRecordFilter(filter.record_some) };
        }

        // Filter by record_every (all records match)
        if (filter.record_every) {
            where.records = { every: this.convertRecordFilter(filter.record_every) };
        }

        // Filter by record_none (no record matches)
        if (filter.record_none) {
            where.records = { none: this.convertRecordFilter(filter.record_none) };
        }

        return where;
    }

    /**
     * Convert GraphQL record filter to Prisma record filter
     * @param filter - The record filter criteria
     * @returns Prisma record filter
     */
    private convertRecordFilter(filter: any): any {
        const where: any = {};

        // Handle NOT operator
        if (filter.NOT) {
            where.NOT = this.convertRecordFilter(filter.NOT);
        }

        // Handle AND operator
        if (filter.AND && filter.AND.length > 0) {
            where.AND = filter.AND.map((f: any) => this.convertRecordFilter(f));
        }

        // Handle OR operator
        if (filter.OR && filter.OR.length > 0) {
            where.OR = filter.OR.map((f: any) => this.convertRecordFilter(f));
        }

        // Filter by topic
        if (filter.topic !== undefined && filter.topic !== null) {
            where.topic = filter.topic;
        }

        // Filter by topic_contains
        if (filter.topic_contains !== undefined && filter.topic_contains !== null) {
            where.topic = { contains: filter.topic_contains, mode: 'insensitive' };
        }

        // Filter by topic_starts_with
        if (filter.topic_starts_with !== undefined && filter.topic_starts_with !== null) {
            where.topic = { startsWith: filter.topic_starts_with, mode: 'insensitive' };
        }

        // Filter by topic_ends_with
        if (filter.topic_ends_with !== undefined && filter.topic_ends_with !== null) {
            where.topic = { endsWith: filter.topic_ends_with, mode: 'insensitive' };
        }

        // Filter by topic_in
        if (filter.topic_in && filter.topic_in.length > 0) {
            where.topic = { in: filter.topic_in };
        }

        // Filter by topic_not_in
        if (filter.topic_not_in && filter.topic_not_in.length > 0) {
            where.topic = { notIn: filter.topic_not_in };
        }

        // Filter by content
        if (filter.content !== undefined && filter.content !== null) {
            where.content = filter.content;
        }

        // Filter by content_contains
        if (filter.content_contains !== undefined && filter.content_contains !== null) {
            where.content = { contains: filter.content_contains, mode: 'insensitive' };
        }

        // Filter by content_starts_with
        if (filter.content_starts_with !== undefined && filter.content_starts_with !== null) {
            where.content = { startsWith: filter.content_starts_with, mode: 'insensitive' };
        }

        // Filter by content_ends_with
        if (filter.content_ends_with !== undefined && filter.content_ends_with !== null) {
            where.content = { endsWith: filter.content_ends_with, mode: 'insensitive' };
        }

        // Filter by content_in
        if (filter.content_in && filter.content_in.length > 0) {
            where.content = { in: filter.content_in };
        }

        // Filter by content_not_in
        if (filter.content_not_in && filter.content_not_in.length > 0) {
            where.content = { notIn: filter.content_not_in };
        }

        // Note: updateDate is not stored in the Prisma schema for records
        // This would need to be implemented if timestamps are added

        return where;
    }

    /**
     * Convert Prisma document to GraphQL document
     * @param document - The Prisma document
     * @returns GraphQL document
     */
    private convertToGraphQLDocument(document: any): Document {
        return {
            id: document.id,
            type: document.type as any,
            entities: document.entities,
            topic: document.topic,
            record: document.records.map((r: any) => ({
                topic: r.topic,
                content: r.content,
                updateDate: new Date().toISOString(), // In production, use actual timestamp
            })),
            metadata: {
                tags: [], // Tags not currently stored in database
            },
        };
    }
}
