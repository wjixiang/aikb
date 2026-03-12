import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service.js';
import { PubmedParser } from './parsers/pubmed.parser.js';
import type { ParsedArticle, SyncProgress, SyncOptions } from './parsers/types.js';

interface CacheData {
  journals: Map<string, string>;
  authors: Map<string, string>;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly parser = new PubmedParser();

  constructor(@Inject(forwardRef(() => PrismaService)) private prisma: PrismaService) {}

  async syncFromDirectory(dirPath: string, options: SyncOptions = {}): Promise<SyncProgress> {
    const progress: SyncProgress = {
      totalFiles: 0,
      processedFiles: 0,
      totalArticles: 0,
      processedArticles: 0,
      errors: 0,
    };

    const files = await this.getXmlFiles(dirPath);
    progress.totalFiles = files.length;

    this.logger.log(`Found ${files.length} XML files to process`);
    options.onProgress?.(progress);

    const concurrency = options.concurrency || 2;
    const batchSize = options.batchSize || 5000;

    const cache: CacheData = { journals: new Map(), authors: new Map() };
    await this.preloadCache(cache);

    for (let i = 0; i < files.length; i += concurrency) {
      const chunk = files.slice(i, i + concurrency);
      const results = await Promise.all(
        chunk.map(async (file) => {
          try {
            return await this.processFile(file, batchSize, cache);
          } catch (error) {
            this.logger.error(`Error processing file ${file}:`, error);
            return { articles: 0, errors: 1 };
          }
        })
      );

      for (const result of results) {
        progress.processedFiles++;
        progress.totalArticles += result.articles;
        progress.processedArticles += result.articles;
        progress.errors += result.errors;
      }

      options.onProgress?.(progress);
    }

    this.logger.log(
      `Sync complete: ${progress.processedFiles}/${progress.totalFiles} files, ` +
      `${progress.processedArticles}/${progress.totalArticles} articles, ` +
      `${progress.errors} errors`,
    );

    return progress;
  }

  private async preloadCache(cache: CacheData): Promise<void> {
    this.logger.log('Preloading cache...');

    const journals = await this.prisma.journal.findMany({
      select: { id: true, issn: true, issnElectronic: true, isoAbbreviation: true },
    });
    for (const j of journals) {
      if (j.issn) cache.journals.set(j.issn, j.id);
      if (j.issnElectronic) cache.journals.set(j.issnElectronic, j.id);
      if (j.isoAbbreviation) cache.journals.set(j.isoAbbreviation, j.id);
    }
    this.logger.log(`Preloaded ${cache.journals.size} journals`);

    const authors = await this.prisma.author.findMany({
      where: { lastName: { not: null } },
      select: { id: true, lastName: true, foreName: true },
    });
    for (const a of authors) {
      if (a.lastName) {
        cache.authors.set(`${a.lastName}|${a.foreName || ''}`, a.id);
      }
    }
    this.logger.log(`Preloaded ${cache.authors.size} authors`);
  }

  private async processFile(
    filePath: string,
    batchSize: number,
    cache: CacheData
  ): Promise<{ articles: number; errors: number }> {
    const articleBatch: ParsedArticle[] = [];
    let totalArticles = 0;

    for await (const article of this.parser.parseFile(filePath)) {
      articleBatch.push(article);
      totalArticles++;

      if (articleBatch.length >= batchSize) {
        await this.syncBatch(articleBatch, cache);
        articleBatch.length = 0;
      }
    }

    if (articleBatch.length > 0) {
      await this.syncBatch(articleBatch, cache);
    }

    return { articles: totalArticles, errors: 0 };
  }

  private async syncBatch(articles: ParsedArticle[], cache: CacheData): Promise<void> {
    this.logger.log(`Processing batch of ${articles.length} articles...`);
    const chunkSize = 200;
    for (let i = 0; i < articles.length; i += chunkSize) {
      const chunk = articles.slice(i, i + chunkSize);
      this.logger.log(`Processing chunk ${i}-${i + chunkSize}...`);
      await this.syncChunk(chunk, cache);
      this.logger.log(`Chunk ${i}-${i + chunkSize} complete`);
    }
    this.logger.log(`Batch complete`);
  }

  private async syncChunk(articles: ParsedArticle[], cache: CacheData): Promise<void> {
    this.logger.log(`Collecting journals/authors for ${articles.length} articles...`);
    const newJournals = new Map<string, any>();
    const newAuthors = new Map<string, any>();

    for (const article of articles) {
      if (article.journal) {
        const j = article.journal;
        const key = j.isoAbbreviation || j.issn || '';
        if (key && !cache.journals.has(key) && !newJournals.has(key)) {
          newJournals.set(key, {
            issn: j.issn,
            issnElectronic: j.issnElectronic,
            volume: j.volume,
            issue: j.issue,
            pubDate: j.pubDate,
            pubYear: j.pubYear,
            title: j.title,
            isoAbbreviation: j.isoAbbreviation,
          });
        }
      }

      for (const author of article.authors) {
        if (!author.lastName) continue;
        const key = `${author.lastName}|${author.foreName || ''}`;
        if (!cache.authors.has(key) && !newAuthors.has(key)) {
          newAuthors.set(key, {
            lastName: author.lastName,
            foreName: author.foreName,
            initials: author.initials,
          });
        }
      }
    }

    if (newJournals.size > 0) {
      this.logger.log(`Creating ${newJournals.size} journals...`);
      const journalData = Array.from(newJournals.values());
      await this.prisma.journal.createMany({
        data: journalData,
        skipDuplicates: true,
      });

      const keys = Array.from(newJournals.keys());
      const created = await this.prisma.journal.findMany({
        where: { isoAbbreviation: { in: keys } },
        select: { id: true, isoAbbreviation: true },
      });
      for (const j of created) {
        if (j.isoAbbreviation) cache.journals.set(j.isoAbbreviation, j.id);
      }
      this.logger.log(`Journals created`);
    }

    if (newAuthors.size > 0) {
      this.logger.log(`Creating ${newAuthors.size} authors...`);
      const authorData = Array.from(newAuthors.values());
      await this.prisma.author.createMany({
        data: authorData,
        skipDuplicates: true,
      });

      const created = await this.prisma.author.findMany({
        where: { lastName: { in: authorData.map(a => a.lastName) } },
        select: { id: true, lastName: true, foreName: true },
      });
      for (const a of created) {
        if (a.lastName) {
          cache.authors.set(`${a.lastName}|${a.foreName || ''}`, a.id);
        }
      }
      this.logger.log(`Authors created`);
    }

    this.logger.log(`Starting transaction for ${articles.length} articles...`);

    await this.prisma.$transaction(async (tx) => {
      for (const article of articles) {
        try {
          let journalId: string | null = null;
          if (article.journal) {
            const j = article.journal;
            if (j.isoAbbreviation && cache.journals.has(j.isoAbbreviation)) {
              journalId = cache.journals.get(j.isoAbbreviation)!;
            } else if (j.issn && cache.journals.has(j.issn)) {
              journalId = cache.journals.get(j.issn)!;
            }
          }

          const dbArticle = await tx.article.upsert({
            where: { pmid: article.pmid },
            create: {
              pmid: article.pmid,
              articleTitle: article.articleTitle,
              language: article.language,
              publicationType: article.publicationType,
              dateCompleted: article.dateCompleted,
              dateRevised: article.dateRevised,
              publicationStatus: article.publicationStatus,
              journalId,
            },
            update: {
              articleTitle: article.articleTitle,
              language: article.language,
              publicationType: article.publicationType,
              dateCompleted: article.dateCompleted,
              dateRevised: article.dateRevised,
              publicationStatus: article.publicationStatus,
              journalId,
            },
          });

          const authorLinks = [];
          for (const author of article.authors) {
            if (!author.lastName) continue;
            const key = `${author.lastName}|${author.foreName || ''}`;
            const authorId = cache.authors.get(key);
            if (authorId) {
              authorLinks.push({ authorId, articleId: dbArticle.id });
            }
          }

          if (authorLinks.length > 0) {
            await tx.authorArticle.createMany({
              data: authorLinks,
              skipDuplicates: true,
            });
          }

          if (article.meshHeadings.length > 0) {
            const meshData = article.meshHeadings.map(m => ({
              descriptorName: m.descriptorName || null,
              qualifierName: m.qualifierName ? String(m.qualifierName) : null,
              ui: m.ui || null,
              majorTopicYN: m.majorTopicYN || false,
              articleId: dbArticle.id,
            }));
            await tx.meshHeading.createMany({
              data: meshData,
              skipDuplicates: true,
            });
          }

          if (article.chemicals.length > 0) {
            const chemData = article.chemicals.map(c => ({
              registryNumber: c.registryNumber?.toString() || null,
              nameOfSubstance: c.nameOfSubstance || null,
              articleId: dbArticle.id,
            }));
            await tx.chemical.createMany({
              data: chemData,
              skipDuplicates: true,
            });
          }

          if (article.grants.length > 0) {
            const grantData = article.grants.map(g => ({
              grantId: g.grantId?.toString() || null,
              agency: g.agency || null,
              country: g.country || null,
              articleId: dbArticle.id,
            }));
            await tx.grant.createMany({
              data: grantData,
              skipDuplicates: true,
            });
          }

          if (article.articleIds.length > 0) {
            const articleIdData = article.articleIds.map(ai => ({
              pubmed: ai.pubmed ? ai.pubmed.toString() : null,
              doi: ai.doi != null ? String(ai.doi) : null,
              pii: ai.pii != null ? String(ai.pii) : null,
              pmc: ai.pmc != null ? String(ai.pmc) : null,
              otherId: ai.otherId != null ? String(ai.otherId) : null,
              otherIdType: ai.otherIdType != null ? String(ai.otherIdType) : null,
              articleId: dbArticle.id,
            }));
            await tx.articleId.createMany({
              data: articleIdData,
              skipDuplicates: true,
            });
          }
        } catch (error) {
          // Log but don't fail the whole batch
        }
      }
    }, { timeout: 120000 });
  }

  async syncFile(filePath: string, options: SyncOptions = {}): Promise<SyncProgress> {
    const progress: SyncProgress = {
      totalFiles: 1,
      processedFiles: 0,
      totalArticles: 0,
      processedArticles: 0,
      errors: 0,
    };

    const cache: CacheData = { journals: new Map(), authors: new Map() };
    await this.preloadCache(cache);

    const batchSize = options.batchSize || 5000;
    const articleBatch: ParsedArticle[] = [];

    try {
      for await (const article of this.parser.parseFile(filePath)) {
        articleBatch.push(article);
        progress.totalArticles++;

        if (articleBatch.length >= batchSize) {
          await this.syncBatch(articleBatch, cache);
          progress.processedArticles += articleBatch.length;
          articleBatch.length = 0;
          options.onProgress?.(progress);
        }
      }

      if (articleBatch.length > 0) {
        await this.syncBatch(articleBatch, cache);
        progress.processedArticles += articleBatch.length;
      }

      progress.processedFiles++;
    } catch (error) {
      this.logger.error(`Error processing file ${filePath}:`, error);
      progress.errors++;
    }

    options.onProgress?.(progress);
    return progress;
  }

  private async getXmlFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await this.getXmlFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && (entry.name.endsWith('.xml.gz') || entry.name.endsWith('.xml'))) {
        files.push(fullPath);
      }
    }

    return files.sort();
  }
}
