import { PrismaService } from '../prisma/prisma.service.js';
import { Logger } from '../utils/logger.js';
import {
  Embedding,
  EmbeddingProvider,
  defaultEmbeddingConfig,
} from '@ai-embed/core';

export interface EmbedOptions {
  provider?: EmbeddingProvider;
  model?: string;
  dimension?: number;
  batchSize?: number;
}

export interface EmbedProgress {
  totalArticles: number;
  processedArticles: number;
  embeddedArticles: number;
  errors: number;
}

export class ArticleEmbeddingService {
  private readonly logger = new Logger(ArticleEmbeddingService.name);
  private embedding: Embedding;

  constructor(private prisma: PrismaService) {
    this.embedding = new Embedding();
  }

  async embedSearchResults(
    taskId: string,
    options: EmbedOptions = {},
    onProgress?: (progress: EmbedProgress) => void,
  ): Promise<EmbedProgress> {
    const config = this.buildConfig(options);

    const progress: EmbedProgress = {
      totalArticles: 0,
      processedArticles: 0,
      embeddedArticles: 0,
      errors: 0,
    };

    const articles = await this.prisma.$queryRaw`
      SELECT asr.id, asr.pmid, asr.title, asr.snippet
      FROM "ArticleSearchResult" asr
      JOIN "ArticleSearch" s ON s.id = asr."searchId"
      LEFT JOIN "ArticleEmbedding" ae ON ae."resultId" = asr.id
      WHERE s."taskId" = ${taskId} AND ae.id IS NULL
    `;

    progress.totalArticles = (articles as any[]).length;
    this.logger.log(
      `Found ${progress.totalArticles} articles to embed for task ${taskId}`,
    );

    onProgress?.(progress);

    const batchSize = config.batchSize || 10;

    for (let i = 0; i < (articles as any[]).length; i += batchSize) {
      const batch = (articles as any[]).slice(i, i + batchSize);
      const texts = batch.map((a: any) =>
        this.buildTextToEmbed(a.title, a.snippet),
      );

      try {
        const results = await this.embedding.embedBatch(texts, config);

        for (let j = 0; j < batch.length; j++) {
          const article = batch[j];
          const result = results.results[j];

          if (!result.success || !result.embedding) {
            this.logger.warn(`Failed to embed article ${article.pmid}`);
            progress.errors++;
            continue;
          }

          const embeddingVector = result.embedding;
          const embeddingStr = `[${embeddingVector.map((v: number) => v.toFixed(10)).join(',')}]`;

          await this.prisma.$executeRawUnsafe(
            `INSERT INTO "ArticleEmbedding" (id, "resultId", "provider", "model", "dimension", "text", "vector", "isActive", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8, NOW(), NOW())`,
            crypto.randomUUID(),
            article.id,
            config.provider,
            config.model,
            config.dimension,
            texts[j],
            embeddingStr,
            true,
          );

          progress.embeddedArticles++;
        }
      } catch (error) {
        this.logger.error(`Error in batch embedding:`, error);
        progress.errors += batch.length;
      }

      progress.processedArticles += batch.length;
      onProgress?.(progress);
    }

    this.logger.log(
      `Embedding complete: ${progress.embeddedArticles}/${progress.totalArticles} embedded, ${progress.errors} errors`,
    );

    return progress;
  }

  async embedSingleArticle(
    resultId: string,
    title: string,
    snippet: string | null,
    options: EmbedOptions = {},
  ): Promise<boolean> {
    const config = this.buildConfig(options);
    const text = this.buildTextToEmbed(title, snippet);

    try {
      const result = await this.embedding.embed(text, config);

      if (!result.success || !result.embedding) {
        this.logger.warn(`Failed to embed article result ${resultId}`);
        return false;
      }

      const embeddingVector = result.embedding;
      const embeddingStr = `[${embeddingVector.map((v: number) => v.toFixed(10)).join(',')}]`;

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "ArticleEmbedding" (id, "resultId", "provider", "model", "dimension", "text", "vector", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8, NOW(), NOW())
         ON CONFLICT ("resultId") 
         DO UPDATE SET 
           "text" = EXCLUDED."text",
           "vector" = EXCLUDED."vector",
           "isActive" = EXCLUDED."isActive",
           "updatedAt" = NOW()`,
        crypto.randomUUID(),
        resultId,
        config.provider,
        config.model,
        config.dimension,
        text,
        embeddingStr,
        true,
      );

      return true;
    } catch (error) {
      this.logger.error(`Error embedding article ${resultId}:`, error);
      return false;
    }
  }

  private buildConfig(options: EmbedOptions): any {
    return {
      provider: options.provider || defaultEmbeddingConfig.provider,
      model: options.model || defaultEmbeddingConfig.model,
      dimension: options.dimension || defaultEmbeddingConfig.dimension,
      batchSize: options.batchSize || defaultEmbeddingConfig.batchSize,
      maxRetries: defaultEmbeddingConfig.maxRetries,
      timeout: defaultEmbeddingConfig.timeout,
    };
  }

  private buildTextToEmbed(title: string, snippet: string | null): string {
    if (snippet) {
      return `${title}. ${snippet}`;
    }
    return title;
  }
}
