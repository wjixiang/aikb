import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaItemVectorStorage } from './prisma-item-vector-storage.js';
import { ChunkEmbedGroupMetadata, ItemChunk, ChunkEmbedGroupStatus } from './types.js';
import { prisma } from 'bibliography-db';
import { ChunkingStrategy } from 'chunking';
import { EmbeddingProvider, AlibabaModel } from 'embedding';
import { v4 as uuidv4 } from 'uuid';

describe('PrismaItemVectorStorage', () => {
    let storage: PrismaItemVectorStorage;
    let testItemId: string;
    let testGroupId: string;
    let testChunkId: string;

    beforeEach(async () => {
        storage = new PrismaItemVectorStorage();
        
        // Create a test item
        const testItem = await prisma.items.create({
            data: {
                title: 'Test Item for Vector Storage',
                abstract: 'Test abstract',
                publication_year: 2023,
                publisher: 'Test Publisher',
                isbn: '1234567890',
                doi: '10.1000/test',
                url: 'https://example.com',
                tags: ['test', 'vector'],
                notes: 'Test notes',
                language: 'en',
                markdown_content: '# Test Content\n\nThis is test content for chunking and embedding.',
            }
        });
        testItemId = testItem.id;

        // Create a test chunk embed group
        const testGroup = await prisma.chunk_embed_groups.create({
            data: {
                item_id: testItemId,
                name: 'Test Group',
                description: 'Test group description',
                chunking_config: {
                    maxChunkSize: 1000,
                    minChunkSize: 100,
                    overlap: 50,
                    strategy: 'paragraph'
                },
                embedding_config: {
                    model: 'text-embedding-v3',
                    dimension: 1024,
                    batchSize: 20,
                    maxRetries: 3,
                    timeout: 20000,
                    provider: 'alibaba'
                },
                is_default: true,
                is_active: true,
                created_by: 'test-user',
                tags: ['test'],
                status: ChunkEmbedGroupStatus.WAIT_FOR_CHUNK_EMBED
            }
        });
        testGroupId = testGroup.id;

        // Create a test item chunk
        const testChunk = await prisma.item_chunks.create({
            data: {
                id: uuidv4(),
                item_id: testItemId,
                dense_vector_index_group_id: testGroupId,
                title: 'Test Chunk',
                content: 'This is test content for the chunk.',
                index: 0,
                embedding: Array(1024).fill(0.1), // Simple test embedding
                strategy_metadata: {
                    chunkingStrategy: 'paragraph',
                    chunkingConfig: {
                        maxChunkSize: 1000,
                        minChunkSize: 100,
                        overlap: 50,
                        strategy: 'paragraph'
                    },
                    embeddingConfig: {
                        model: 'text-embedding-v3',
                        dimension: 1024,
                        batchSize: 20,
                        maxRetries: 3,
                        timeout: 20000,
                        provider: 'alibaba'
                    },
                    processingTimestamp: new Date(),
                    processingDuration: 1000
                },
                metadata: {
                    chunkType: 'paragraph',
                    startPosition: 0,
                    endPosition: 50,
                    wordCount: 10
                }
            }
        });
        testChunkId = testChunk.id;
    });

    afterEach(async () => {
        // Clean up test data
        await prisma.item_chunks.deleteMany({
            where: { item_id: testItemId }
        });
        await prisma.chunk_embed_groups.deleteMany({
            where: { item_id: testItemId }
        });
        await prisma.items.delete({
            where: { id: testItemId }
        });
    });

    it('should get status of a chunk embed group', async () => {
        const status = await storage.getStatus(testGroupId);
        expect(status).toBeDefined();
    });

    it('should get chunk embed group info by id', async () => {
        const groupInfo = await storage.getChunkEmbedGroupInfoById(testGroupId);
        expect(groupInfo).toBeDefined();
        expect(groupInfo.id).toBe(testGroupId);
        expect(groupInfo.itemId).toBe(testItemId);
        expect(groupInfo.name).toBe('Test Group');
    });

    it('should create a new chunk embed group', async () => {
        const newGroupConfig: Omit<ChunkEmbedGroupMetadata, 'id'> = {
            itemId: testItemId,
            name: 'New Test Group',
            description: 'New test group description',
            chunkingConfig: {
                maxChunkSize: 500,
                minChunkSize: 50,
                overlap: 25,
                strategy: ChunkingStrategy.H1
            },
            embeddingConfig: {
                model: AlibabaModel.TEXT_EMBEDDING_V4,
                dimension: 1024,
                batchSize: 10,
                maxRetries: 2,
                timeout: 15000,
                provider: EmbeddingProvider.ALIBABA
            },
            isDefault: false,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'test-user-2',
            tags: ['test', 'new'],
            status: ChunkEmbedGroupStatus.WAIT_FOR_CHUNK_EMBED
        };

        const newGroup = await storage.createNewChunkEmbedGroupInfo(newGroupConfig);
        expect(newGroup).toBeDefined();
        expect(newGroup.id).toBeDefined();
        expect(newGroup.name).toBe('New Test Group');
        expect(newGroup.itemId).toBe(testItemId);

        // Clean up
        await prisma.chunk_embed_groups.delete({
            where: { id: newGroup.id }
        });
    });

    it('should insert an item chunk', async () => {
        const newChunkId = uuidv4();
        const newChunk: ItemChunk = {
            id: newChunkId,
            itemId: testItemId,
            denseVectorIndexGroupId: testGroupId,
            title: 'New Test Chunk',
            content: 'This is new test content for the chunk.',
            index: 1,
            embedding: Array(1024).fill(0.2),
            strategyMetadata: {
                chunkingStrategy: 'h1',
                chunkingConfig: {
                    maxChunkSize: 500,
                    minChunkSize: 50,
                    overlap: 25,
                    strategy: ChunkingStrategy.H1
                },
                embeddingConfig: {
                    model: AlibabaModel.TEXT_EMBEDDING_V4,
                    dimension: 1024,
                    batchSize: 10,
                    maxRetries: 2,
                    timeout: 15000,
                    provider: EmbeddingProvider.ALIBABA
                },
                processingTimestamp: new Date(),
                processingDuration: 800
            },
            metadata: {
                chunkType: 'h1',
                startPosition: 51,
                endPosition: 100,
                wordCount: 8
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await storage.insertItemChunk(
            await storage.getChunkEmbedGroupInfoById(testGroupId),
            newChunk
        );
        expect(result).toBe(true);

        // Verify the chunk was inserted
        const insertedChunk = await prisma.item_chunks.findUnique({
            where: { id: newChunkId }
        });
        expect(insertedChunk).toBeDefined();
        expect(insertedChunk?.title).toBe('New Test Chunk');

        // Clean up
        await prisma.item_chunks.delete({
            where: { id: newChunkId }
        });
    });

    it('should list chunk embed groups', async () => {
        const result = await storage.listChunkEmbedGroupInfo(testItemId);
        expect(result).toBeDefined();
        expect(result.groups).toBeDefined();
        expect(result.groups.length).toBeGreaterThan(0);
        expect(result.totalSize).toBeGreaterThan(0);
        expect(result.groups[0].itemId).toBe(testItemId);
    });

    it('should delete a chunk embed group', async () => {
        // Create a group to delete
        const deleteGroup = await prisma.chunk_embed_groups.create({
            data: {
                item_id: testItemId,
                name: 'Group to Delete',
                description: 'This group will be deleted',
                chunking_config: {
                    maxChunkSize: 1000,
                    minChunkSize: 100,
                    overlap: 50,
                    strategy: 'paragraph'
                },
                embedding_config: {
                    model: 'text-embedding-v3',
                    dimension: 1024,
                    batchSize: 20,
                    maxRetries: 3,
                    timeout: 20000,
                    provider: 'alibaba'
                },
                is_default: false,
                is_active: true,
                created_by: 'test-user',
                tags: ['delete-test'],
                status: ChunkEmbedGroupStatus.WAIT_FOR_CHUNK_EMBED
            }
        });

        // Add a chunk to the group
        const chunkToDeleteId = uuidv4();
        await prisma.item_chunks.create({
            data: {
                id: chunkToDeleteId,
                item_id: testItemId,
                dense_vector_index_group_id: deleteGroup.id,
                title: 'Chunk to Delete',
                content: 'This chunk will be deleted.',
                index: 0,
                embedding: Array(1024).fill(0.3),
                strategy_metadata: {
                    chunkingStrategy: 'paragraph',
                    chunkingConfig: {
                        maxChunkSize: 1000,
                        minChunkSize: 100,
                        overlap: 50,
                        strategy: 'paragraph'
                    },
                    embeddingConfig: {
                        model: 'text-embedding-v3',
                        dimension: 1024,
                        batchSize: 20,
                        maxRetries: 3,
                        timeout: 20000,
                        provider: 'alibaba'
                    },
                    processingTimestamp: new Date(),
                    processingDuration: 500
                },
                metadata: {
                    chunkType: 'paragraph',
                    startPosition: 0,
                    endPosition: 30,
                    wordCount: 6
                }
            }
        });

        const deleteResult = await storage.deleteChunkEmbedGroupById(deleteGroup.id);
        expect(deleteResult).toBeDefined();
        expect(deleteResult.deletedGroupId).toBe(deleteGroup.id);
        expect(deleteResult.deletedChunkNum).toBe(1);

        // Verify the group and chunk were deleted
        const deletedGroup = await prisma.chunk_embed_groups.findUnique({
            where: { id: deleteGroup.id }
        });
        expect(deletedGroup).toBeNull();

        const deletedChunk = await prisma.item_chunks.findUnique({
            where: { id: chunkToDeleteId }
        });
        expect(deletedChunk).toBeNull();
    });
});