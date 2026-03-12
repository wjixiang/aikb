import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

type EmbeddingConfig = {
  provider: string;
  model: string;
  dimension: number;
  batchSize: number;
  maxRetries: number;
  timeout: number;
  concurrencyLimit: number;
};

const defaultEmbeddingConfig: EmbeddingConfig = {
  provider: 'alibaba',
  model: 'text-embedding-v4',
  dimension: 1024,
  batchSize: 20,
  maxRetries: 3,
  timeout: 20000,
  concurrencyLimit: 20,
};

export interface EmbedArticleOptions {
  provider?: string;
  model?: string;
  dimension?: number;
  batchSize?: number;
  textField?: 'title' | 'titleAndAbstract' | 'titleAndMesh';
}

export interface EmbedProgress {
  totalArticles: number;
  processedArticles: number;
  embeddedArticles: number;
  errors: number;
}

@Injectable()
export class EmbedService {
  private readonly logger = new Logger(EmbedService.name);
  private embedding: any;
  private embeddingInitialized = false;

  constructor(private prisma: PrismaService) {}

  private async getEmbedding(): Promise<any> {
    if (!this.embeddingInitialized) {
      const { Embedding } = await import('embedding');
      this.embedding = new Embedding();
      this.embeddingInitialized = true;
    }
    return this.embedding;
  }

  /**
   * Embed all articles without existing embeddings for a given model
   */
  async embedArticles(
    options: EmbedArticleOptions = {},
    onProgress?: (progress: EmbedProgress) => void,
  ): Promise<EmbedProgress> {
    const config = this.buildConfig(options);

    const progress: EmbedProgress = {
      totalArticles: 0,
      processedArticles: 0,
      embeddedArticles: 0,
      errors: 0,
    };

    // Get articles that don't have embeddings for this model
    const articles = await this.prisma.article.findMany({
      where: {
        NOT: {
          embeddings: {
            some: {
              provider: config.provider,
              model: config.model,
              isActive: true,
            },
          },
        },
      },
      select: {
        id: true,
        pmid: true,
        articleTitle: true,
      },
      take: 1000, // Process in batches
    });

    progress.totalArticles = articles.length;
    this.logger.log(
      `Found ${articles.length} articles to embed with ${config.model}`,
    );

    onProgress?.(progress);

    for (const article of articles) {
      try {
        // Build text to embed
        const textToEmbed = await this.buildTextToEmbed(article.id, options.textField);
        if (!textToEmbed) {
          progress.processedArticles++;
          onProgress?.(progress);
          continue;
        }

        // Generate embedding
        const embeddingInstance = await this.getEmbedding();
        const embedding = await embeddingInstance.embed(textToEmbed, config);
        if (!embedding) {
          this.logger.warn(`Failed to generate embedding for article ${article.pmid}`);
          progress.errors++;
          progress.processedArticles++;
          onProgress?.(progress);
          continue;
        }

        // Save embedding
        await this.prisma.articleEmbedding.upsert({
          where: {
            articleId_provider_model: {
              articleId: article.id,
              provider: config.provider,
              model: config.model,
            },
          },
          create: {
            articleId: article.id,
            provider: config.provider,
            model: config.model,
            dimension: config.dimension,
            text: textToEmbed,
            vector: embedding,
            isActive: true,
          },
          update: {
            text: textToEmbed,
            vector: embedding,
            isActive: true,
            updatedAt: new Date(),
          },
        });

        progress.embeddedArticles++;
      } catch (error) {
        this.logger.error(`Error embedding article ${article.pmid}:`, error);
        progress.errors++;
      }

      progress.processedArticles++;
      onProgress?.(progress);
    }

    this.logger.log(
      `Embedding complete: ${progress.embeddedArticles}/${progress.totalArticles} embedded, ${progress.errors} errors`,
    );

    return progress;
  }

  /**
   * Embed articles in batch mode for better performance
   */
  async embedArticlesBatch(
    options: EmbedArticleOptions = {},
    onProgress?: (progress: EmbedProgress) => void,
  ): Promise<EmbedProgress> {
    const config = this.buildConfig(options);
    const batchSize = options.batchSize || defaultEmbeddingConfig.batchSize;

    const progress: EmbedProgress = {
      totalArticles: 0,
      processedArticles: 0,
      embeddedArticles: 0,
      errors: 0,
    };

    // Get articles that don't have embeddings for this model
    const articles = await this.prisma.article.findMany({
      where: {
        NOT: {
          embeddings: {
            some: {
              provider: config.provider,
              model: config.model,
              isActive: true,
            },
          },
        },
      },
      select: {
        id: true,
        pmid: true,
        articleTitle: true,
      },
    });

    progress.totalArticles = articles.length;
    this.logger.log(
      `Found ${articles.length} articles to embed with ${config.model} (batch size: ${batchSize})`,
    );

    onProgress?.(progress);

    // Process in batches
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);
      const texts: { id: string; pmid: bigint; text: string }[] = [];

      // Build texts for batch
      for (const article of batch) {
        const text = await this.buildTextToEmbed(article.id, options.textField);
        if (text) {
          texts.push({ id: article.id, pmid: article.pmid, text });
        }
      }

      if (texts.length === 0) {
        progress.processedArticles += batch.length;
        continue;
      }

      try {
        // Batch embed
        const embeddingInstance = await this.getEmbedding();
        const embeddings = await embeddingInstance.embedBatch(
          texts.map((t) => t.text),
          config,
        );

        // Save embeddings
        for (let j = 0; j < texts.length; j++) {
          const item = texts[j];
          const embedding = embeddings[j];

          if (!embedding) {
            progress.errors++;
            continue;
          }

          await this.prisma.articleEmbedding.upsert({
            where: {
              articleId_provider_model: {
                articleId: item.id,
                provider: config.provider,
                model: config.model,
              },
            },
            create: {
              articleId: item.id,
              provider: config.provider,
              model: config.model,
              dimension: config.dimension,
              text: item.text,
              vector: embedding,
              isActive: true,
            },
            update: {
              text: item.text,
              vector: embedding,
              isActive: true,
              updatedAt: new Date(),
            },
          });

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
      `Batch embedding complete: ${progress.embeddedArticles}/${progress.totalArticles} embedded, ${progress.errors} errors`,
    );

    return progress;
  }

  /**
   * Get embeddings for a specific article
   */
  async getArticleEmbeddings(articleId: string): Promise<
    Array<{
      id: string;
      provider: string;
      model: string;
      dimension: number;
      isActive: boolean;
    }>
  > {
    return this.prisma.articleEmbedding.findMany({
      where: { articleId },
      select: {
        id: true,
        provider: true,
        model: true,
        dimension: true,
        isActive: true,
      },
    });
  }

  /**
   * Delete embeddings for a specific article and model
   */
  async deleteEmbedding(
    articleId: string,
    provider: string,
    model: string,
  ): Promise<void> {
    await this.prisma.articleEmbedding.deleteMany({
      where: { articleId, provider, model },
    });
  }

  /**
   * Rebuild embeddings for existing embeddings (re-embed)
   */
  async rebuildEmbeddings(
    options: EmbedArticleOptions = {},
    onProgress?: (progress: EmbedProgress) => void,
  ): Promise<EmbedProgress> {
    const config = this.buildConfig(options);

    const progress: EmbedProgress = {
      totalArticles: 0,
      processedArticles: 0,
      embeddedArticles: 0,
      errors: 0,
    };

    // Get articles that have embeddings for this model
    const embeddings = await this.prisma.articleEmbedding.findMany({
      where: {
        provider: config.provider,
        model: config.model,
      },
      select: {
        articleId: true,
        article: {
          select: {
            pmid: true,
            articleTitle: true,
          },
        },
      },
    });

    progress.totalArticles = embeddings.length;
    this.logger.log(
      `Rebuilding ${embeddings.length} embeddings for ${config.model}`,
    );

    onProgress?.(progress);

    for (const emb of embeddings) {
      try {
        const text = await this.buildTextToEmbed(emb.articleId, options.textField);
        if (!text) {
          progress.errors++;
          continue;
        }

        const embeddingInstance = await this.getEmbedding();
        const embedding = await embeddingInstance.embed(text, config);
        if (!embedding) {
          progress.errors++;
          continue;
        }

        await this.prisma.articleEmbedding.update({
          where: {
            articleId_provider_model: {
              articleId: emb.articleId,
              provider: config.provider,
              model: config.model,
            },
          },
          data: {
            text,
            vector: embedding,
            updatedAt: new Date(),
          },
        });

        progress.embeddedArticles++;
      } catch (error) {
        this.logger.error(`Error rebuilding embedding:`, error);
        progress.errors++;
      }

      progress.processedArticles++;
      onProgress?.(progress);
    }

    return progress;
  }

  private buildConfig(options: EmbedArticleOptions): EmbeddingConfig {
    const provider = options.provider || defaultEmbeddingConfig.provider;
    const model = (options.model || defaultEmbeddingConfig.model) as any;
    const dimension = options.dimension || defaultEmbeddingConfig.dimension;

    return {
      provider,
      model,
      dimension,
      batchSize: options.batchSize || defaultEmbeddingConfig.batchSize,
      maxRetries: defaultEmbeddingConfig.maxRetries,
      timeout: defaultEmbeddingConfig.timeout,
      concurrencyLimit: defaultEmbeddingConfig.concurrencyLimit,
    };
  }

  private async buildTextToEmbed(
    articleId: string,
    textField?: 'title' | 'titleAndAbstract' | 'titleAndMesh',
  ): Promise<string | null> {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: {
        articleTitle: true,
        meshHeadings: {
          select: { descriptorName: true, qualifierName: true },
        },
      },
    });

    if (!article) return null;

    const title = article.articleTitle || '';

    switch (textField) {
      case 'title':
        return title;

      case 'titleAndMesh': {
        const meshTerms = article.meshHeadings
          .map((m) => m.descriptorName)
          .filter(Boolean)
          .slice(0, 10);
        return `${title} ${meshTerms.join(' ')}`;
      }

      case 'titleAndAbstract':
      default:
        // For now, just return title (abstract not yet implemented)
        return title;
    }
  }
}
