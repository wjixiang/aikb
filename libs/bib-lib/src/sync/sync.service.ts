import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service.js';
import { PubmedParser } from './parsers/pubmed.parser.js';
import type { ParsedArticle, SyncProgress, SyncOptions } from './parsers/types.js';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly parser = new PubmedParser();

  constructor(@Inject(forwardRef(() => PrismaService)) private prisma: PrismaService) {}

  /**
   * Sync all PubMed XML files from a directory
   */
  async syncFromDirectory(dirPath: string, options: SyncOptions = {}): Promise<SyncProgress> {
    const progress: SyncProgress = {
      totalFiles: 0,
      processedFiles: 0,
      totalArticles: 0,
      processedArticles: 0,
      errors: 0,
    };

    // Get all XML gz files
    const files = await this.getXmlFiles(dirPath);
    progress.totalFiles = files.length;

    this.logger.log(`Found ${files.length} XML files to process`);

    options.onProgress?.(progress);

    const batchSize = options.batchSize || 100;
    const articleBatch: ParsedArticle[] = [];

    for (const file of files) {
      try {
        this.logger.log(`Processing: ${file}`);

        for await (const article of this.parser.parseFile(file)) {
          articleBatch.push(article);
          progress.totalArticles++;

          if (articleBatch.length >= batchSize) {
            await this.syncBatch(articleBatch);
            progress.processedArticles += articleBatch.length;
            articleBatch.length = 0;
            options.onProgress?.(progress);
          }
        }

        // Process remaining articles
        if (articleBatch.length > 0) {
          await this.syncBatch(articleBatch);
          progress.processedArticles += articleBatch.length;
          articleBatch.length = 0;
        }

        progress.processedFiles++;
        options.onProgress?.(progress);
      } catch (error) {
        this.logger.error(`Error processing file ${file}:`, error);
        progress.errors++;
      }
    }

    this.logger.log(
      `Sync complete: ${progress.processedFiles}/${progress.totalFiles} files, ` +
      `${progress.processedArticles}/${progress.totalArticles} articles, ` +
      `${progress.errors} errors`,
    );

    return progress;
  }

  /**
   * Sync a single PubMed XML file
   */
  async syncFile(filePath: string, options: SyncOptions = {}): Promise<SyncProgress> {
    const progress: SyncProgress = {
      totalFiles: 1,
      processedFiles: 0,
      totalArticles: 0,
      processedArticles: 0,
      errors: 0,
    };

    const batchSize = options.batchSize || 100;
    const articleBatch: ParsedArticle[] = [];

    try {
      for await (const article of this.parser.parseFile(filePath)) {
        articleBatch.push(article);
        progress.totalArticles++;

        if (articleBatch.length >= batchSize) {
          await this.syncBatch(articleBatch);
          progress.processedArticles += articleBatch.length;
          articleBatch.length = 0;
          options.onProgress?.(progress);
        }
      }

      // Process remaining articles
      if (articleBatch.length > 0) {
        await this.syncBatch(articleBatch);
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

  /**
   * Sync a batch of articles using upsert
   */
  private async syncBatch(articles: ParsedArticle[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const article of articles) {
        try {
          // Upsert Journal
          let journalId: string | undefined;
          if (article.journal) {
            const j = article.journal;
            const existingJournal = await this.findJournalByIssn(tx, j.issn || j.isoAbbreviation);

            if (existingJournal) {
              journalId = existingJournal;
              await tx.journal.update({
                where: { id: existingJournal },
                data: {
                  issn: j.issn,
                  issnElectronic: j.issnElectronic,
                  volume: j.volume,
                  issue: j.issue,
                  pubDate: j.pubDate,
                  pubYear: j.pubYear,
                  title: j.title,
                  isoAbbreviation: j.isoAbbreviation,
                },
              });
            } else {
              const newJournal = await tx.journal.create({
                data: {
                  issn: j.issn,
                  issnElectronic: j.issnElectronic,
                  volume: j.volume,
                  issue: j.issue,
                  pubDate: j.pubDate,
                  pubYear: j.pubYear,
                  title: j.title,
                  isoAbbreviation: j.isoAbbreviation,
                },
              });
              journalId = newJournal.id;
            }
          }

          // Upsert Article
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

          // Upsert Authors
          for (const author of article.authors) {
            const existingAuthor = await this.findAuthor(tx, author.lastName, author.foreName);

            let dbAuthor;
            if (existingAuthor) {
              dbAuthor = await tx.author.update({
                where: { id: existingAuthor },
                data: {
                  lastName: author.lastName,
                  foreName: author.foreName,
                  initials: author.initials,
                },
              });
            } else {
              dbAuthor = await tx.author.create({
                data: {
                  lastName: author.lastName,
                  foreName: author.foreName,
                  initials: author.initials,
                },
              });
            }

            await tx.authorArticle.upsert({
              where: {
                authorId_articleId: {
                  authorId: dbAuthor.id,
                  articleId: dbArticle.id,
                },
              },
              create: {
                authorId: dbAuthor.id,
                articleId: dbArticle.id,
              },
              update: {},
            });
          }

          // Upsert MeSH Headings
          for (const mesh of article.meshHeadings) {
            await tx.meshHeading.create({
              data: {
                descriptorName: mesh.descriptorName,
                qualifierName: mesh.qualifierName,
                ui: mesh.ui,
                majorTopicYN: mesh.majorTopicYN,
                articleId: dbArticle.id,
              },
            }).catch(() => {
              // Ignore duplicates
            });
          }

          // Upsert Chemicals
          for (const chem of article.chemicals) {
            await tx.chemical.create({
              data: {
                registryNumber: chem.registryNumber,
                nameOfSubstance: chem.nameOfSubstance,
                articleId: dbArticle.id,
              },
            }).catch(() => {
              // Ignore duplicates
            });
          }

          // Upsert Grants
          for (const grant of article.grants) {
            await tx.grant.create({
              data: {
                grantId: grant.grantId,
                agency: grant.agency,
                country: grant.country,
                articleId: dbArticle.id,
              },
            }).catch(() => {
              // Ignore duplicates
            });
          }

          // Upsert Article IDs
          for (const articleId of article.articleIds) {
            await tx.articleId.create({
              data: {
                pubmed: articleId.pubmed,
                doi: articleId.doi,
                pii: articleId.pii,
                pmc: articleId.pmc,
                otherId: articleId.otherId,
                otherIdType: articleId.otherIdType,
                articleId: dbArticle.id,
              },
            }).catch(() => {
              // Ignore duplicates
            });
          }
        } catch (error) {
          this.logger.error(`Error syncing article ${article.pmid}:`, error);
        }
      }
    });
  }

  private async findJournalByIssn(tx: any, issn: string | undefined): Promise<string | null> {
    if (!issn) return null;
    const journal = await tx.journal.findFirst({
      where: { OR: [{ issn }, { issnElectronic: issn }] },
    });
    return journal?.id || null;
  }

  private async findAuthor(tx: any, lastName: string | undefined, foreName: string | undefined): Promise<string | null> {
    if (!lastName) return null;
    const author = await tx.author.findFirst({
      where: { lastName, foreName },
    });
    return author?.id || null;
  }

  /**
   * Get all XML gz files from a directory recursively
   */
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
