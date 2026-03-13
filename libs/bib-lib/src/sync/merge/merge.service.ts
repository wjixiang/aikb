import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';

export interface MergeResult {
  journals: number;
  authors: number;
  articles: number;
  errors: number;
}

@Injectable()
export class MergeService {
  private readonly logger = new Logger(MergeService.name);

  constructor(private prisma: PrismaService) {}

  async mergeFromShards(sourceDbUrls: string[]): Promise<MergeResult> {
    const result: MergeResult = {
      journals: 0,
      authors: 0,
      articles: 0,
      errors: 0,
    };

    // Create Prisma clients for each source database
    const sourceClients: PrismaService[] = [];

    for (const dbUrl of sourceDbUrls) {
      try {
        const client = new PrismaService({ datasources: { db: { url: dbUrl } } });
        sourceClients.push(client);
      } catch (error) {
        this.logger.error(`Failed to connect to source database: ${dbUrl}`, error);
        result.errors++;
      }
    }

    if (sourceClients.length === 0) {
      throw new Error('No valid source databases available');
    }

    // Merge journals
    this.logger.log('Merging journals...');
    const journalIds = new Set<string>();
    for (const client of sourceClients) {
      const journals = await client.journal.findMany({ select: { id: true } });
      for (const j of journals) {
        journalIds.add(j.id);
      }
    }

    // Get all journals from first source (they should be similar)
    const firstClient = sourceClients[0];
    const allJournals = await firstClient.journal.findMany();

    if (allJournals.length > 0) {
      await this.prisma.journal.createMany({
        data: allJournals.map(j => ({
          id: j.id,
          issn: j.issn,
          issnElectronic: j.issnElectronic,
          volume: j.volume,
          issue: j.issue,
          pubDate: j.pubDate,
          pubYear: j.pubYear,
          title: j.title,
          isoAbbreviation: j.isoAbbreviation,
        })),
        skipDuplicates: true,
      });
      result.journals = allJournals.length;
    }

    // Merge authors
    this.logger.log('Merging authors...');
    const authorMap = new Map<string, { lastName?: string; foreName?: string; initials?: string }>();

    for (const client of sourceClients) {
      const authors = await client.author.findMany();
      for (const a of authors) {
        const key = `${a.lastName}|${a.foreName || ''}`;
        if (!authorMap.has(key)) {
          authorMap.set(key, { lastName: a.lastName, foreName: a.foreName, initials: a.initials });
        }
      }
    }

    if (authorMap.size > 0) {
      const authorData = Array.from(authorMap.values());
      await this.prisma.author.createMany({
        data: authorData.map((a, idx) => ({
          id: crypto.randomUUID(),
          lastName: a.lastName,
          foreName: a.foreName,
          initials: a.initials,
        })),
        skipDuplicates: true,
      });
      result.authors = authorData.length;
    }

    // Merge articles with relations
    this.logger.log('Merging articles...');
    const pmidSet = new Set<bigint>();

    for (const client of sourceClients) {
      const articles = await client.article.findMany({
        include: {
          journal: true,
          authors: { include: { author: true } },
          meshHeadings: true,
          chemicals: true,
          grants: true,
          articleIds: true,
        },
      });

      for (const article of articles) {
        if (pmidSet.has(article.pmid)) continue;
        pmidSet.add(article.pmid);

        try {
          // Find journal ID in target DB
          let journalId: string | null = null;
          if (article.journal?.isoAbbreviation) {
            const targetJournal = await this.prisma.journal.findFirst({
              where: { isoAbbreviation: article.journal.isoAbbreviation },
              select: { id: true },
            });
            journalId = targetJournal?.id ?? null;
          }

          // Upsert article
          await this.prisma.article.upsert({
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

          // Get the article ID after upsert
          const dbArticle = await this.prisma.article.findUnique({
            where: { pmid: article.pmid },
            select: { id: true },
          });

          if (!dbArticle) continue;

          // Merge author links
          const authorLinks: { authorId: string; articleId: string }[] = [];
          for (const link of article.authors) {
            // Find author in target DB
            const targetAuthor = await this.prisma.author.findFirst({
              where: { lastName: link.author.lastName ?? undefined },
              select: { id: true },
            });
            if (targetAuthor) {
              authorLinks.push({ authorId: targetAuthor.id, articleId: dbArticle.id });
            }
          }

          if (authorLinks.length > 0) {
            await this.prisma.authorArticle.createMany({
              data: authorLinks,
              skipDuplicates: true,
            });
          }

          // Merge mesh headings
          if (article.meshHeadings.length > 0) {
            await this.prisma.meshHeading.createMany({
              data: article.meshHeadings.map(m => ({
                descriptorName: m.descriptorName,
                qualifierName: m.qualifierName,
                ui: m.ui,
                majorTopicYN: m.majorTopicYN,
                articleId: dbArticle.id,
              })),
              skipDuplicates: true,
            });
          }

          // Merge chemicals
          if (article.chemicals.length > 0) {
            await this.prisma.chemical.createMany({
              data: article.chemicals.map(c => ({
                registryNumber: c.registryNumber,
                nameOfSubstance: c.nameOfSubstance,
                articleId: dbArticle.id,
              })),
              skipDuplicates: true,
            });
          }

          // Merge grants
          if (article.grants.length > 0) {
            await this.prisma.grant.createMany({
              data: article.grants.map(g => ({
                grantId: g.grantId,
                agency: g.agency,
                country: g.country,
                articleId: dbArticle.id,
              })),
              skipDuplicates: true,
            });
          }

          // Merge article IDs
          if (article.articleIds.length > 0) {
            await this.prisma.articleId.createMany({
              data: article.articleIds.map(ai => ({
                pubmed: ai.pubmed,
                doi: ai.doi,
                pii: ai.pii,
                pmc: ai.pmc,
                otherId: ai.otherId,
                otherIdType: ai.otherIdType,
                articleId: dbArticle.id,
              })),
              skipDuplicates: true,
            });
          }

          result.articles++;
        } catch (error) {
          this.logger.error(`Failed to merge article ${article.pmid}:`, error);
          result.errors++;
        }
      }
    }

    // Close source connections
    for (const client of sourceClients) {
      await client.$disconnect();
    }

    this.logger.log(`Merge complete: ${result.journals} journals, ${result.authors} authors, ${result.articles} articles`);

    return result;
  }
}
