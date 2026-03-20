import { PrismaService } from '../prisma/prisma.service.js';
import { Logger } from '../utils/logger.js';
import type { ArticleProfile } from 'bibliography-search';

export interface ArticleSearchData {
  taskId: string;
  searchTerm: string;
  totalResults: number | null;
  filters: string[];
  sort: string;
  dateRange: string;
  iteration: number;
  final: boolean;
  articleProfiles: ArticleProfile[];
}

export class SearchResultService {
  private readonly logger = new Logger(SearchResultService.name);

  constructor(private prisma: PrismaService) {}

  async saveSearchResult(data: ArticleSearchData) {
    this.logger.log(
      `Saving search result: ${data.totalResults} articles, iteration ${data.iteration}`,
    );

    const searchId = crypto.randomUUID();
    const createdAt = new Date();

    const articleResults = data.articleProfiles.map((profile) => ({
      id: crypto.randomUUID(),
      searchId,
      pmid: profile.pmid,
      title: profile.title,
      authors: profile.authors,
      journalCitation: profile.journalCitation,
      snippet: profile.snippet,
      doi: profile.doi,
      position: profile.position,
      createdAt,
    }));

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "ArticleSearch" (id, "taskId", "searchTerm", "totalResults", "filters", "sort", "dateRange", "iteration", "final", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
      searchId,
      data.taskId,
      data.searchTerm,
      data.totalResults,
      JSON.stringify(data.filters),
      data.sort,
      data.dateRange,
      data.iteration,
      data.final,
    );

    if (articleResults.length > 0) {
      for (let i = 0; i < articleResults.length; i++) {
        const article = articleResults[i];
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO "ArticleSearchResult" (id, "searchId", pmid, title, authors, "journalCitation", snippet, doi, position, "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          article.id,
          article.searchId,
          article.pmid,
          article.title,
          article.authors,
          article.journalCitation,
          article.snippet,
          article.doi,
          article.position,
        );
      }
    }

    this.logger.log(
      `Saved search ${searchId} with ${articleResults.length} articles`,
    );
    return {
      id: searchId,
      articleResults,
    };
  }

  async getSearchResults(taskId: string) {
    const searches = await this.prisma.$queryRaw`
      SELECT * FROM "ArticleSearch"
      WHERE "taskId" = ${taskId}
      ORDER BY "iteration" ASC
    `;

    for (const search of searches) {
      search.articleResults = await this.prisma.$queryRaw`
        SELECT asr.*,
               JSON_BUILD_OBJECT(
                 'id', ae.id,
                 'provider', ae.provider,
                 'model', ae.model,
                 'dimension', ae.dimension,
                 'isActive', ae."isActive"
               ) as embedding
        FROM "ArticleSearchResult" asr
        LEFT JOIN "ArticleEmbedding" ae ON ae."resultId" = asr.id
        WHERE asr."searchId" = ${search.id}
        ORDER BY asr.position ASC
      `;
    }

    return searches;
  }

  async getFinalSearchResult(taskId: string) {
    const search = await this.prisma.$queryRaw`
      SELECT * FROM "ArticleSearch"
      WHERE "taskId" = ${taskId} AND "final" = true
      LIMIT 1
    `;

    if (!search || search.length === 0) {
      return null;
    }

    const searchId = search[0].id;
    search[0].articleResults = await this.prisma.$queryRaw`
      SELECT asr.*,
             JSON_BUILD_OBJECT(
               'id', ae.id,
               'provider', ae.provider,
               'model', ae.model,
               'dimension', ae.dimension,
               'isActive', ae."isActive"
             ) as embedding
      FROM "ArticleSearchResult" asr
      LEFT JOIN "ArticleEmbedding" ae ON ae."resultId" = asr.id
      WHERE asr."searchId" = ${searchId}
      ORDER BY asr.position ASC
    `;

    return search[0];
  }

  async getAllArticles(taskId: string) {
    const articles = await this.prisma.$queryRaw`
      SELECT DISTINCT asr.*,
             ARRAY_AGG(DISTINCT asr."searchId") as searches,
             JSON_BUILD_OBJECT(
               'id', ae.id,
               'provider', ae.provider,
               'model', ae.model,
               'dimension', ae.dimension,
               'isActive', ae."isActive"
             ) as embedding
      FROM "ArticleSearchResult" asr
      JOIN "ArticleSearch" s ON s.id = asr."searchId"
      LEFT JOIN "ArticleEmbedding" ae ON ae."resultId" = asr.id
      WHERE s."taskId" = ${taskId}
      GROUP BY asr.id, ae.id
    `;

    return articles;
  }

  async deleteSearchResults(taskId: string) {
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "ArticleSearch" WHERE "taskId" = $1`,
      taskId,
    );
  }

  async getArticleWithoutEmbeddings(limit: number = 100) {
    return this.prisma.$queryRaw`
      SELECT asr.id, asr.pmid, asr.title, asr.snippet
      FROM "ArticleSearchResult" asr
      LEFT JOIN "ArticleEmbedding" ae ON ae."resultId" = asr.id
      WHERE ae.id IS NULL
      LIMIT ${limit}
    `;
  }
}
