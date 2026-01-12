import { Inject, Injectable } from '@nestjs/common';
import { CreateDocumentInput, Document, UpdateDocumentInput } from '../graphql';
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
                embedding: {
                    create: {
                        id: embeddingId,
                        entityId: documentId,
                        model: defaultEmbeddingConfig.model as string,
                        dimension: defaultEmbeddingConfig.dimension,
                        provider: embeddingResult.provider || defaultEmbeddingConfig.provider,
                    },
                },
            },
        });

        // Map Prisma document to GraphQL Document type
        // Note: This is a simplified mapping. The actual implementation may need
        // to handle additional fields like records, metadata, etc.
        const document: Document = {
            id: dbDocument.id,
            type: input.type,
            entities: input.entities,
            topic: dbDocument.topic,
            record: [
                {
                    topic: input.topic,
                    content: input.content,
                    updateDate: new Date().toISOString(),
                },
            ],
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
}
