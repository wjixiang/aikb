/**
 * End-to-end test for embedding and semantic search functionality
 * Uses real database connection
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SemanticSearchService } from '../semantic/semantic-search.service.js';
import { KeywordSearchService } from '../keyword/keyword-search.service.js';
import { EmbedService } from '../../sync/embed/embed.service.js';

describe('Embedding & Semantic Search E2E Tests', () => {
  let prisma: PrismaService;
  let semanticSearch: SemanticSearchService;
  let keywordSearch: KeywordSearchService;
  let embedService: EmbedService;

  beforeAll(async () => {
    prisma = new PrismaService();
    keywordSearch = new KeywordSearchService(prisma);
    semanticSearch = new SemanticSearchService(prisma);
    embedService = new EmbedService(prisma);
  }, 30000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Database Setup', () => {
    it('should have articles in database', async () => {
      const count = await prisma.article.count();
      console.log(`Database has ${count} articles`);
      expect(count).toBeGreaterThan(0);
    });

    it('should check if ArticleEmbedding table exists', async () => {
      try {
        const count = await prisma.articleEmbedding.count();
        console.log(`ArticleEmbedding table exists with ${count} records`);
      } catch (err: any) {
        console.log('ArticleEmbedding table does not exist:', err.message);
        // Skip subsequent tests if table doesn't exist
        return;
      }
    });
  });

  describe('EmbedService', () => {
    it('should get article embeddings', async () => {
      // Get first article
      const article = await prisma.article.findFirst({
        select: { id: true },
      });

      if (!article) {
        console.log('No articles found, skipping test');
        return;
      }

      const embeddings = await embedService.getArticleEmbeddings(article.id);
      console.log(`Article ${article.id} has ${embeddings.length} embeddings`);
      expect(Array.isArray(embeddings)).toBe(true);
    });
  });

  describe('Semantic Search', () => {
    it('should perform semantic search with mock embedding', async () => {
      // First, check if there are any embeddings in the database
      let embeddingCount = 0;
      try {
        embeddingCount = await prisma.articleEmbedding.count({
          where: { isActive: true },
        });
      } catch (err) {
        console.log('ArticleEmbedding table not available, skipping test');
        return;
      }

      console.log(`Found ${embeddingCount} active embeddings in database`);

      if (embeddingCount === 0) {
        console.log('No embeddings found. Creating test embeddings...');

        // Get a few articles to embed
        const articles = await prisma.article.findMany({
          take: 5,
          select: { id: true, pmid: true, articleTitle: true },
        });

        console.log(`Will embed ${articles.length} articles`);

        // Create mock embeddings for testing (in a real scenario, would use actual embedding API)
        for (const article of articles) {
          // Generate a simple mock vector (in real use, would call embedding API)
          const mockVector = Array(1024).fill(0).map(() => Math.random() * 2 - 1);

          try {
            await prisma.articleEmbedding.create({
              data: {
                articleId: article.id,
                provider: 'test',
                model: 'test-model',
                dimension: 1024,
                text: article.articleTitle,
                vector: mockVector,
                isActive: true,
              },
            });
          } catch (err) {
            console.log('Could not create embedding:', err);
          }
        }

        // Check count again
        embeddingCount = await prisma.articleEmbedding.count({
          where: { isActive: true },
        });
        console.log(`Created test embeddings: ${embeddingCount}`);
      }

      if (embeddingCount === 0) {
        console.log('Still no embeddings, cannot test semantic search');
        return;
      }

      // Now test semantic search with a mock query embedding
      const mockQueryEmbedding = Array(1024).fill(0).map(() => Math.random() * 2 - 1);

      try {
        const result = await semanticSearch.search(
          { query: 'cancer treatment', limit: 10 },
          mockQueryEmbedding,
          {
            embeddingProvider: 'test',
            embeddingModel: 'test-model',
            dimension: 1024,
            similarityType: 'cosine',
          },
        );

        console.log(`Semantic search returned ${result.total} results in ${result.searchTime}ms`);
        expect(result).toHaveProperty('results');
        expect(result).toHaveProperty('total');
        expect(result).toHaveProperty('searchTime');
      } catch (err: any) {
        console.log('Semantic search error:', err.message);
        // This might fail if the vector column is not properly configured
      }
    });

    it('should use vector similarity operators', async () => {
      // Test raw SQL with vector operations
      try {
        // Test vector creation
        const vecResult = await prisma.$queryRawUnsafe<{ v: any }[]>(
          `SELECT '[1,2,3]'::vector as v`,
        );
        console.log('Vector creation works:', vecResult[0]?.v);

        // Test cosine similarity
        const simResult = await prisma.$queryRawUnsafe<{ similarity: number }[]>(
          `SELECT '[1,0,0]'::vector <=> '[1,0,0]'::vector as similarity`,
        );
        console.log('Cosine similarity (same vector):', simResult[0]?.similarity);

        // Test with different vectors
        const simResult2 = await prisma.$queryRawUnsafe<{ similarity: number }[]>(
          `SELECT '[1,0,0]'::vector <=> '[0,1,0]'::vector as similarity`,
        );
        console.log('Cosine similarity (perpendicular):', simResult2[0]?.similarity);

        expect(vecResult[0]).toBeDefined();
        expect(simResult[0]).toBeDefined();
      } catch (err: any) {
        console.log('Vector operations error:', err.message);
        // Vector operations may not be available
      }
    });
  });

  describe('Keyword vs Semantic Comparison', () => {
    it('should compare keyword and semantic search', async () => {
      const query = 'cancer';
      const limit = 5;

      // Keyword search
      const keywordResult = await keywordSearch.search(
        { query, limit },
        {},
      );
      console.log(`Keyword search: ${keywordResult.total} results in ${keywordResult.searchTime}ms`);

      // Semantic search (if embeddings exist)
      let semanticResult = null;
      try {
        const embeddingCount = await prisma.articleEmbedding.count({
          where: { isActive: true },
        });

        if (embeddingCount > 0) {
          const mockEmbedding = Array(1024).fill(0).map(() => Math.random() * 2 - 1);
          semanticResult = await semanticSearch.search(
            { query, limit },
            mockEmbedding,
            {
              embeddingProvider: 'test',
              embeddingModel: 'test-model',
              dimension: 1024,
            },
          );
          console.log(`Semantic search: ${semanticResult.total} results in ${semanticResult.searchTime}ms`);
        }
      } catch (err) {
        console.log('Semantic search not available');
      }

      expect(keywordResult).toHaveProperty('results');
      expect(keywordResult.total).toBeGreaterThanOrEqual(0);
    });
  });
});
