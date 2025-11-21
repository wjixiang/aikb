import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaItemVectorStorage } from './prisma-item-vector-storage.js';
import { ChunkEmbedGroupMetadata, ItemChunk, ChunkEmbedGroupStatus, ItemVectorStorageStatus } from './types.js';
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

        // Create a test item chunk using raw SQL to avoid JSON formatting issues
        testChunkId = uuidv4();
        const testChunkVector = Array(1024).fill(0.1);
        const vectorString = `[${testChunkVector.join(',')}]`;
        
        await prisma.$executeRaw`
            INSERT INTO item_chunks (
                id, item_id, dense_vector_index_group_id, title, content, "index", 
                embedding, strategy_metadata, metadata, created_at, updated_at
            ) VALUES (
                ${testChunkId}, ${testItemId}, ${testGroupId}, 
                ${'Test Chunk'}, ${'This is test content for chunk.'}, ${0}, 
                ${vectorString}::vector, ${JSON.stringify({
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
                })}, ${JSON.stringify({
                    chunkType: 'paragraph',
                    startPosition: 0,
                    endPosition: 50,
                    wordCount: 10
                })}, ${new Date()}, ${new Date()}
            )
        `;
    });

    afterEach(async () => {
        // Clean up test data
        await prisma.item_chunks.deleteMany({
            where: { item_id: testItemId }
        });
        await prisma.chunk_embed_groups.deleteMany({
            where: { item_id: testItemId }
        });
        await prisma.items.deleteMany({
            where: { id: testItemId }
        });
    });

    it('should get status of a chunk embed group', async () => {
        const result = await storage.getStatus(testGroupId);
        expect(result).toBeDefined();
        expect(result).toBe(ItemVectorStorageStatus.PENDING);
    });

    it('should get chunk embed group info by id', async () => {
        const result = await storage.getChunkEmbedGroupInfoById(testGroupId);
        expect(result).toBeDefined();
        expect(result.id).toBe(testGroupId);
        expect(result.itemId).toBe(testItemId);
        expect(result.name).toBe('Test Group');
    });

    it('should create a new chunk embed group', async () => {
        const newGroupConfig: Omit<ChunkEmbedGroupMetadata, "id"> = {
            itemId: testItemId,
            name: 'New Test Group',
            description: 'New test group description',
            chunkingConfig: {
                maxChunkSize: 500,
                minChunkSize: 50,
                overlap: 25,
                strategy: ChunkingStrategy.PARAGRAPH
            },
            embeddingConfig: {
                model: AlibabaModel.TEXT_EMBEDDING_V3,
                dimension: 1024,
                batchSize: 10,
                maxRetries: 3,
                timeout: 15000,
                provider: EmbeddingProvider.ALIBABA
            },
            isDefault: false,
            isActive: true,
            createdBy: 'test-user-2',
            tags: ['test-new'],
            status: ChunkEmbedGroupStatus.WAIT_FOR_CHUNK_EMBED,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await storage.createNewChunkEmbedGroupInfo(newGroupConfig);
        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.itemId).toBe(testItemId);
        expect(result.name).toBe('New Test Group');

        // Clean up
        await prisma.chunk_embed_groups.delete({
            where: { id: result.id }
        });
    });

    it('should insert an item chunk', async () => {
        const newChunkId = uuidv4();
        const newChunk: ItemChunk = {
            id: newChunkId,
            itemId: testItemId,
            denseVectorIndexGroupId: testGroupId,
            title: 'New Test Chunk',
            content: 'This is new test content for chunk.',
            index: 1,
            embedding: Array(1024).fill(0.2),
            strategyMetadata: {
                chunkingStrategy: 'paragraph',
                chunkingConfig: {
                    maxChunkSize: 1000,
                    minChunkSize: 100,
                    overlap: 50,
                    strategy: ChunkingStrategy.PARAGRAPH
                },
                embeddingConfig: {
                    model: AlibabaModel.TEXT_EMBEDDING_V3,
                    dimension: 1024,
                    batchSize: 20,
                    maxRetries: 3,
                    timeout: 20000,
                    provider: EmbeddingProvider.ALIBABA
                },
                processingTimestamp: new Date(),
                processingDuration: 1000
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

        // Verify chunk was inserted
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

        // Add a chunk to group using raw SQL
        const chunkToDeleteId = uuidv4();
        const chunkToDeleteVector = Array(1024).fill(0.3);
        const chunkVectorString = `[${chunkToDeleteVector.join(',')}]`;
        
        await prisma.$executeRaw`
            INSERT INTO item_chunks (
                id, item_id, dense_vector_index_group_id, title, content, "index", 
                embedding, strategy_metadata, metadata, created_at, updated_at
            ) VALUES (
                ${chunkToDeleteId}, ${testItemId}, ${deleteGroup.id}, 
                ${'Chunk to Delete'}, ${'This chunk will be deleted.'}, ${0}, 
                ${chunkVectorString}::vector, ${JSON.stringify({
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
                })}, ${JSON.stringify({
                    chunkType: 'paragraph',
                    startPosition: 0,
                    endPosition: 30,
                    wordCount: 6
                })}, ${new Date()}, ${new Date()}
            )
        `;

        const deleteResult = await storage.deleteChunkEmbedGroupById(deleteGroup.id);
        expect(deleteResult).toBeDefined();
        expect(deleteResult.deletedGroupId).toBe(deleteGroup.id);
        expect(deleteResult.deletedChunkNum).toBe(1);

        // Verify group and chunk were deleted
        const deletedGroup = await prisma.chunk_embed_groups.findUnique({
            where: { id: deleteGroup.id }
        });
        expect(deletedGroup).toBeNull();

        const deletedChunk = await prisma.item_chunks.findUnique({
            where: { id: chunkToDeleteId }
        });
        expect(deletedChunk).toBeNull();
    });

    it('should perform semantic search and return similar chunks', async () => {
        // Create additional chunks with different content for testing similarity
        const chunk1Id = uuidv4();
        const chunk2Id = uuidv4();
        
        // Create chunks with similar embeddings (simulating similar content)
        const baseEmbedding = Array(1024).fill(0.1);
        const similarEmbedding = [...baseEmbedding];
        similarEmbedding[0] = 0.15; // Slight variation to simulate similarity
        
        const differentEmbedding = Array(1024).fill(0.8); // Very different embedding

        // Insert similar chunk
        const similarVectorString = `[${similarEmbedding.join(',')}]`;
        await prisma.$executeRaw`
            INSERT INTO item_chunks (
                id, item_id, dense_vector_index_group_id, title, content, "index", 
                embedding, strategy_metadata, metadata, created_at, updated_at
            ) VALUES (
                ${chunk1Id}, ${testItemId}, ${testGroupId}, 
                ${'Similar Chunk 1'}, ${'This content is similar to search query.'}, ${1}, 
                ${similarVectorString}::vector, ${JSON.stringify({
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
                })}, ${JSON.stringify({
                    chunkType: 'paragraph',
                    startPosition: 100,
                    endPosition: 150,
                    wordCount: 12
                })}, ${new Date()}, ${new Date()}
            )
        `;

        // Insert different chunk
        const differentVectorString = `[${differentEmbedding.join(',')}]`;
        await prisma.$executeRaw`
            INSERT INTO item_chunks (
                id, item_id, dense_vector_index_group_id, title, content, "index", 
                embedding, strategy_metadata, metadata, created_at, updated_at
            ) VALUES (
                ${chunk2Id}, ${testItemId}, ${testGroupId}, 
                ${'Different Chunk'}, ${'This content is completely different from search query.'}, ${2}, 
                ${differentVectorString}::vector, ${JSON.stringify({
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
                })}, ${JSON.stringify({
                    chunkType: 'paragraph',
                    startPosition: 200,
                    endPosition: 250,
                    wordCount: 14
                })}, ${new Date()}, ${new Date()}
            )
        `;

        // Perform semantic search using base embedding
        const searchQuery = {
            itemId: [testItemId],
            groupId: testGroupId,
            searchVector: baseEmbedding,
            resultNum: 2,
            threshold: 0.5 // Allow for some similarity difference
        };

        const result = await storage.semanticSearch(searchQuery);
        
        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.itemId).toBe(testItemId);
        expect(result.denseVectorIndexGroupId).toBe(testGroupId);
        expect(result.title).toBeDefined();
        expect(result.content).toBeDefined();
        // The result should be one of chunks with similar embeddings
        expect(['Test Chunk', 'Similar Chunk 1']).toContain(result.title);

        // Clean up
        await prisma.item_chunks.deleteMany({
            where: { id: { in: [chunk1Id, chunk2Id] } }
        });
    });

    it('should perform semantic search by item and group ID with similarity scores', async () => {
        // Create test chunks with different similarity levels
        const chunk1Id = uuidv4();
        const chunk2Id = uuidv4();
        
        const searchVector = Array(1024).fill(0.1);
        const verySimilarEmbedding = [...searchVector];
        verySimilarEmbedding[0] = 0.11; // Very small difference
        
        const somewhatSimilarEmbedding = [...searchVector];
        somewhatSimilarEmbedding[0] = 0.3; // Moderate difference

        // Insert very similar chunk
        const verySimilarVectorString = `[${verySimilarEmbedding.join(',')}]`;
        await prisma.$executeRaw`
            INSERT INTO item_chunks (
                id, item_id, dense_vector_index_group_id, title, content, "index", 
                embedding, strategy_metadata, metadata, created_at, updated_at
            ) VALUES (
                ${chunk1Id}, ${testItemId}, ${testGroupId}, 
                ${'Very Similar Chunk'}, ${'This content is very similar to search query.'}, ${1}, 
                ${verySimilarVectorString}::vector, ${JSON.stringify({
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
                })}, ${JSON.stringify({
                    chunkType: 'paragraph',
                    startPosition: 100,
                    endPosition: 150,
                    wordCount: 12
                })}, ${new Date()}, ${new Date()}
            )
        `;

        // Insert somewhat similar chunk
        const somewhatSimilarVectorString = `[${somewhatSimilarEmbedding.join(',')}]`;
        await prisma.$executeRaw`
            INSERT INTO item_chunks (
                id, item_id, dense_vector_index_group_id, title, content, "index", 
                embedding, strategy_metadata, metadata, created_at, updated_at
            ) VALUES (
                ${chunk2Id}, ${testItemId}, ${testGroupId}, 
                ${'Somewhat Similar Chunk'}, ${'This content is somewhat similar to search query.'}, ${2}, 
                ${somewhatSimilarVectorString}::vector, ${JSON.stringify({
                    chunkingStrategy: 'h1',
                    chunkingConfig: {
                        maxChunkSize: 1000,
                        minChunkSize: 100,
                        overlap: 50,
                        strategy: 'h1'
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
                })}, ${JSON.stringify({
                    chunkType: 'h1',
                    startPosition: 200,
                    endPosition: 250,
                    wordCount: 14
                })}, ${new Date()}, ${new Date()}
            )
        `;

        // Perform semantic search with filtering
        const results = await storage.semanticSearchByItemidAndGroupid(
            testItemId,
            testGroupId,
            searchVector,
            3, // topK
            0.5, // scoreThreshold
            { chunkType: 'h1' } // filter - match chunkType we created
        );

        expect(results).toBeDefined();
        expect(results.length).toBeGreaterThan(0);
        
        // Check that results have similarity scores
        results.forEach(result => {
            expect(result.similarity).toBeDefined();
            expect(typeof result.similarity).toBe('number');
            expect(result.id).toBeDefined();
            expect(result.itemId).toBe(testItemId);
            expect(result.denseVectorIndexGroupId).toBe(testGroupId);
        });

        // Results should be ordered by similarity (ascending, as lower distance = higher similarity)
        if (results.length > 1) {
            expect(results[0].similarity).toBeLessThanOrEqual(results[1].similarity);
        }

        // Clean up
        await prisma.item_chunks.deleteMany({
            where: { id: { in: [chunk1Id, chunk2Id] } }
        });
    });

    it('should handle semantic search with no results', async () => {
        // Use a non-existent item ID to ensure no results
        const nonExistentItemId = uuidv4();
        
        const searchQuery = {
            itemId: [nonExistentItemId],
            groupId: testGroupId,
            searchVector: Array(1024).fill(0.5),
            resultNum: 1,
            threshold: 0.5
        };

        await expect(storage.semanticSearch(searchQuery)).rejects.toThrow('No results found');
    });

    it('should handle semantic search by item and group with no results', async () => {
        // Use a non-existent item ID to ensure no results
        const nonExistentItemId = uuidv4();
        
        const results = await storage.semanticSearchByItemidAndGroupid(
            nonExistentItemId,
            testGroupId,
            Array(1024).fill(0.5),
            1, // topK
            0.5, // scoreThreshold
            undefined // no filter
        );

        expect(results).toBeDefined();
        expect(results.length).toBe(0);
    });
});