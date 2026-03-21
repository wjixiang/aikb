import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ImportArticleDto,
  ImportArticleOptions,
  ImportArticleResult,
} from './dto.js';
import { EmbeddingProvider, defaultEmbeddingConfig } from '@ai-embed/core';
import { Embedding } from '@ai-embed/core';

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private readonly embedding = new Embedding();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Import a single article from JSON data
   * Automatically generates embedding if embed option is true
   */
  async importArticle(
    data: ImportArticleDto,
    options: ImportArticleOptions = {},
  ): Promise<ImportArticleResult> {
    try {
      // Validate required fields
      if (!data.title) {
        throw new HttpException(
          'Title is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Generate PMID if not provided (using negative numbers to avoid conflicts)
      const pmid = data.pmid
        ? BigInt(data.pmid)
        : this.generateTemporaryPMID();

      // Parse publication date if provided
      let dateCompleted: Date | undefined;
      if (data.publicationDate) {
        dateCompleted = new Date(data.publicationDate);
      }

      // 1. Create/Find Journal
      let journalId: string | null = null;
      if (data.journal) {
        journalId = await this.findOrCreateJournal(data.journal);
      }

      // 2. Create Article
      const articleId = crypto.randomUUID();
      const article = await this.prisma.article.create({
        data: {
          id: articleId,
          pmid,
          articleTitle: data.title,
          abstract: data.abstract || null,
          language: data.language || 'en',
          publicationType: data.publicationType || null,
          dateCompleted,
          journalId,
        },
      });

      // 3. Create/Link Authors
      if (data.authors && data.authors.length > 0) {
        await this.createArticleAuthors(articleId, data.authors);
      }

      // 4. Create ArticleId (DOI, PMCID, etc.)
      const articleIdData: any = {
        articleId,
        pubmed: article.pmid,
      };
      if (data.doi) articleIdData.doi = data.doi;
      if (data.pmc) articleIdData.pmc = data.pmc;
      if (data.pii) articleIdData.pii = data.pii;

      await this.prisma.articleId.create({
        data: articleIdData,
      });

      // 5. Create MeSH Headings
      if (data.meshHeadings && data.meshHeadings.length > 0) {
        await this.createMeshHeadings(articleId, data.meshHeadings);
      }

      // 6. Generate embedding if requested
      let embedded = false;
      if (options.embed !== false) {
        embedded = await this.generateEmbedding(
          articleId,
          article.articleTitle,
          article.abstract,
          options,
        );
      }

      this.logger.log(
        `Imported article: ${article.pmid} - ${article.articleTitle.substring(0, 50)}...`,
      );

      return {
        success: true,
        articleId: article.id,
        pmid: article.pmid,
        doi: data.doi,
        embedded,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Error importing article:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Unknown error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Generate a temporary PMID using negative numbers
   */
  private generateTemporaryPMID(): bigint {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return BigInt(-(timestamp * 10000 + random));
  }

  /**
   * Find or create journal record
   */
  private async findOrCreateJournal(journalData: {
    title?: string;
    isoAbbreviation?: string;
    issn?: string;
    volume?: string;
    issue?: string;
    pubDate?: string;
    pubYear?: number;
  }): Promise<string | null> {
    // Try to find by ISSN or isoAbbreviation
    let journal: any = null;

    if (journalData.issn) {
      journal = await this.prisma.journal.findUnique({
        where: { issn: journalData.issn },
      });
    }

    if (!journal && journalData.isoAbbreviation) {
      const journals = await this.prisma.journal.findMany({
        where: { isoAbbreviation: journalData.isoAbbreviation },
        take: 1,
      });
      journal = journals[0] || null;
    }

    if (journal) {
      return journal.id;
    }

    // Create new journal
    const newJournal = await this.prisma.journal.create({
      data: {
        issn: journalData.issn || null,
        title: journalData.title || null,
        isoAbbreviation: journalData.isoAbbreviation || null,
        volume: journalData.volume || null,
        issue: journalData.issue || null,
        pubDate: journalData.pubDate || null,
        pubYear: journalData.pubYear || null,
      },
    });

    return newJournal.id;
  }

  /**
   * Create article-author relationships
   */
  private async createArticleAuthors(
    articleId: string,
    authors: Array<{ lastName?: string; foreName?: string; initials?: string }>,
  ): Promise<void> {
    for (const authorData of authors) {
      if (!authorData.lastName) continue;

      // Find or create author
      let author = await this.prisma.author.findFirst({
        where: {
          lastName: authorData.lastName,
          foreName: authorData.foreName || null,
        },
      });

      if (!author) {
        author = await this.prisma.author.create({
          data: {
            lastName: authorData.lastName,
            foreName: authorData.foreName || null,
            initials: authorData.initials || null,
          },
        });
      }

      // Link to article
      await this.prisma.authorArticle.upsert({
        where: {
          authorId_articleId: {
            authorId: author.id,
            articleId,
          },
        },
        create: {
          authorId: author.id,
          articleId,
        },
        update: {},
      });
    }
  }

  /**
   * Create MeSH headings
   */
  private async createMeshHeadings(
    articleId: string,
    meshHeadings: Array<{
      descriptorName?: string;
      qualifierName?: string;
      majorTopicYN?: boolean;
    }>,
  ): Promise<void> {
    const meshData = meshHeadings.map((m) => ({
      descriptorName: m.descriptorName || null,
      qualifierName: m.qualifierName ? String(m.qualifierName) : null,
      majorTopicYN: m.majorTopicYN || false,
      articleId,
    }));

    await this.prisma.meshHeading.createMany({
      data: meshData,
      skipDuplicates: true,
    });
  }

  /**
   * Generate embedding for the article
   */
  private async generateEmbedding(
    articleId: string,
    title: string,
    abstract: string | null,
    options: ImportArticleOptions,
  ): Promise<boolean> {
    try {
      const config = {
        provider: (options.embeddingProvider ||
          defaultEmbeddingConfig.provider) as EmbeddingProvider,
        model: options.embeddingModel || defaultEmbeddingConfig.model,
        dimension: defaultEmbeddingConfig.dimension,
        batchSize: defaultEmbeddingConfig.batchSize,
        maxRetries: defaultEmbeddingConfig.maxRetries,
        timeout: defaultEmbeddingConfig.timeout,
      };

      // Build text to embed
      const textField = options.textField || 'titleAndAbstract';
      const textToEmbed = this.buildTextToEmbed(title, abstract, textField);

      if (!textToEmbed) {
        this.logger.warn('No text to embed for article');
        return false;
      }

      // Generate embedding
      const result = await this.embedding.embed(textToEmbed, config);
      if (!result.success || !result.embedding) {
        this.logger.warn(
          `Failed to generate embedding: ${result.error || 'Unknown error'}`,
        );
        return false;
      }

      // Save embedding using raw SQL for vector field
      const embeddingVector = result.embedding;
      const embeddingStr = `[${embeddingVector
        .map((v: number) => v.toFixed(10))
        .join(',')}]`;

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "ArticleEmbedding" ("id", "articleId", "provider", "model", "dimension", "text", "vector", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8, NOW(), NOW())
         ON CONFLICT ("articleId", "provider", "model")
         DO UPDATE SET
           "text" = EXCLUDED."text",
           "vector" = EXCLUDED."vector",
           "isActive" = EXCLUDED."isActive",
           "updatedAt" = NOW()`,
        crypto.randomUUID(),
        articleId,
        config.provider,
        config.model,
        config.dimension,
        textToEmbed,
        embeddingStr,
        true,
      );

      this.logger.log(`Generated embedding for article ${articleId}`);
      return true;
    } catch (error) {
      this.logger.error('Error generating embedding:', error);
      return false;
    }
  }

  /**
   * Build text to embed based on textField option
   */
  private buildTextToEmbed(
    title: string,
    abstract: string | null,
    textField: 'title' | 'titleAndAbstract' | 'titleAndMesh',
  ): string {
    switch (textField) {
      case 'title':
        return title;

      case 'titleAndAbstract':
        return abstract ? `${title}\n\n${abstract}`.trim() : title;

      case 'titleAndMesh':
      default:
        // For titleAndMesh, we'd need to query MeSH headings
        // For now, use title and abstract
        return abstract ? `${title}\n\n${abstract}`.trim() : title;
    }
  }

  /**
   * Get an existing article by DOI or PMID
   */
  async getArticleByIdentifier(
    doi?: string,
    pmid?: string,
  ): Promise<{ id: string; pmid: bigint; articleTitle: string } | null> {
    if (doi) {
      const articleId = await this.prisma.articleId.findUnique({
        where: { doi },
        select: { article: true },
      });
      if (articleId?.article) {
        return articleId.article;
      }
    }

    if (pmid) {
      const article = await this.prisma.article.findUnique({
        where: { pmid: BigInt(pmid) },
        select: { id: true, pmid: true, articleTitle: true },
      });
      if (article) {
        return article;
      }
    }

    return null;
  }
}
