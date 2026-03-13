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

    const allFiles = await this.getXmlFiles(dirPath);

    // Apply sharding: filter files based on shard index
    const shardIndex = options.shardIndex ?? 0;
    const shardCount = options.shardCount ?? 1;
    const files = allFiles.filter((_, idx) => this.shouldProcessFile(idx, allFiles.length, shardIndex, shardCount));

    progress.totalFiles = files.length;

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
      `Done: ${progress.processedFiles} files, ${progress.processedArticles} articles, ${progress.errors} errors`,
    );

    return progress;
  }

  private async preloadCache(cache: CacheData): Promise<void> {
    const journals = await this.prisma.journal.findMany({
      select: { id: true, issn: true, issnElectronic: true, isoAbbreviation: true },
    });
    for (const j of journals) {
      if (j.issn) cache.journals.set(j.issn, j.id);
      if (j.issnElectronic) cache.journals.set(j.issnElectronic, j.id);
      if (j.isoAbbreviation) cache.journals.set(j.isoAbbreviation, j.id);
    }

    const authors = await this.prisma.author.findMany({
      where: { lastName: { not: null } },
      select: { id: true, lastName: true, foreName: true },
    });
    for (const a of authors) {
      if (a.lastName) {
        cache.authors.set(`${a.lastName}|${a.foreName || ''}`, a.id);
      }
    }
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
    const chunkSize = 200;
    for (let i = 0; i < articles.length; i += chunkSize) {
      const chunk = articles.slice(i, i + chunkSize);
      await this.syncChunk(chunk, cache);
    }
  }

  private async syncChunk(articles: ParsedArticle[], cache: CacheData): Promise<void> {
    const newJournals = new Map<string, any>();
    const newAuthors = new Map<string, any>();

    // Collect journals and authors
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

    // Batch create journals
    if (newJournals.size > 0) {
      await this.prisma.journal.createMany({
        data: Array.from(newJournals.values()),
        skipDuplicates: true,
      });
      // Update cache
      const created = await this.prisma.journal.findMany({
        where: { isoAbbreviation: { in: Array.from(newJournals.keys()) } },
        select: { id: true, isoAbbreviation: true },
      });
      for (const j of created) {
        if (j.isoAbbreviation) cache.journals.set(j.isoAbbreviation, j.id);
      }
    }

    // Batch create authors
    if (newAuthors.size > 0) {
      await this.prisma.author.createMany({
        data: Array.from(newAuthors.values()),
        skipDuplicates: true,
      });
      // Update cache
      const authorData = Array.from(newAuthors.values());
      const created = await this.prisma.author.findMany({
        where: { lastName: { in: authorData.map(a => a.lastName) } },
        select: { id: true, lastName: true, foreName: true },
      });
      for (const a of created) {
        if (a.lastName) cache.authors.set(`${a.lastName}|${a.foreName || ''}`, a.id);
      }
    }

    // Build article data
    const articleData = articles.map(article => {
      let journalId: string | null = null;
      if (article.journal) {
        const j = article.journal;
        if (j.isoAbbreviation && cache.journals.has(j.isoAbbreviation)) {
          journalId = cache.journals.get(j.isoAbbreviation)!;
        } else if (j.issn && cache.journals.has(j.issn)) {
          journalId = cache.journals.get(j.issn)!;
        }
      }
      return {
        id: crypto.randomUUID(),
        pmid: article.pmid,
        articleTitle: article.articleTitle,
        language: article.language,
        publicationType: article.publicationType,
        dateCompleted: article.dateCompleted,
        dateRevised: article.dateRevised,
        publicationStatus: article.publicationStatus,
        journalId,
      };
    });

    // Batch upsert using raw SQL (INSERT ... ON CONFLICT DO UPDATE)
    if (articleData.length > 0) {
      const placeholders = articleData.map((_, i) => {
        const offset = i * 9;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`;
      }).join(', ');
      const params = articleData.flatMap(a => [a.id, a.pmid, a.articleTitle, a.language, a.publicationType, a.dateCompleted, a.dateRevised, a.publicationStatus, a.journalId]);

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "Article" (id, pmid, "articleTitle", language, "publicationType", "dateCompleted", "dateRevised", "publicationStatus", "journalId")
         VALUES ${placeholders}
         ON CONFLICT (pmid) DO UPDATE SET
           "articleTitle" = EXCLUDED."articleTitle",
           language = EXCLUDED.language,
           "publicationType" = EXCLUDED."publicationType",
           "dateCompleted" = EXCLUDED."dateCompleted",
           "dateRevised" = EXCLUDED."dateRevised",
           "publicationStatus" = EXCLUDED."publicationStatus",
           "journalId" = EXCLUDED."journalId"`,
        ...params,
      );
    }

    // Query back article IDs
    const pmids = articles.map(a => a.pmid);
    const dbArticles = await this.prisma.article.findMany({
      where: { pmid: { in: pmids } },
      select: { id: true, pmid: true },
    });
    const pmidToId = new Map(dbArticles.map(a => [a.pmid, a.id]));

    // Batch collect related data
    const authorLinks: { authorId: string; articleId: string }[] = [];
    const meshData: any[] = [];
    const chemData: any[] = [];
    const grantData: any[] = [];
    const articleIdData: any[] = [];

    for (const article of articles) {
      const articleId = pmidToId.get(article.pmid);
      if (!articleId) continue;

      for (const author of article.authors) {
        if (!author.lastName) continue;
        const authorId = cache.authors.get(`${author.lastName}|${author.foreName || ''}`);
        if (authorId) authorLinks.push({ authorId, articleId });
      }

      for (const m of article.meshHeadings) {
        meshData.push({
          descriptorName: m.descriptorName || null,
          qualifierName: m.qualifierName ? String(m.qualifierName) : null,
          ui: m.ui || null,
          majorTopicYN: m.majorTopicYN || false,
          articleId,
        });
      }

      for (const c of article.chemicals) {
        chemData.push({
          registryNumber: c.registryNumber?.toString() || null,
          nameOfSubstance: c.nameOfSubstance || null,
          articleId,
        });
      }

      for (const g of article.grants) {
        grantData.push({
          grantId: g.grantId?.toString() || null,
          agency: g.agency || null,
          country: g.country || null,
          articleId,
        });
      }

      for (const ai of article.articleIds) {
        articleIdData.push({
          pubmed: ai.pubmed ? ai.pubmed.toString() : null,
          doi: ai.doi != null ? String(ai.doi) : null,
          pii: ai.pii != null ? String(ai.pii) : null,
          pmc: ai.pmc != null ? String(ai.pmc) : null,
          otherId: ai.otherId != null ? String(ai.otherId) : null,
          otherIdType: ai.otherIdType != null ? String(ai.otherIdType) : null,
          articleId,
        });
      }
    }

    // Batch insert related data in single transaction
    const relatedPromises = [];
    if (authorLinks.length > 0) relatedPromises.push(this.prisma.authorArticle.createMany({ data: authorLinks, skipDuplicates: true }));
    if (meshData.length > 0) relatedPromises.push(this.prisma.meshHeading.createMany({ data: meshData, skipDuplicates: true }));
    if (chemData.length > 0) relatedPromises.push(this.prisma.chemical.createMany({ data: chemData, skipDuplicates: true }));
    if (grantData.length > 0) relatedPromises.push(this.prisma.grant.createMany({ data: grantData, skipDuplicates: true }));
    if (articleIdData.length > 0) relatedPromises.push(this.prisma.articleId.createMany({ data: articleIdData, skipDuplicates: true }));

    if (relatedPromises.length > 0) {
      await this.prisma.$transaction(relatedPromises);
    }
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

  /**
   * Determine if a file should be processed by this shard.
   * Uses consistent hashing based on file path to ensure even distribution.
   */
  private shouldProcessFile(fileIdx: number, totalFiles: number, shardIndex: number, shardCount: number): boolean {
    // Use file index for consistent distribution across shards
    // This ensures each shard processes a consistent portion of files
    return (fileIdx % shardCount) === shardIndex;
  }

  /**
   * Get the hash of a file path for sharding
   */
  private getFileHash(filePath: string): number {
    let hash = 0;
    for (let i = 0; i < filePath.length; i++) {
      const char = filePath.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
