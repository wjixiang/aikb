import { PubmedService } from 'bibliography-search';
import {
  SortOrder,
  ArticleSearchResultDto,
  ArticleDetailDto,
  ArticleProfileDto,
  AuthorDto,
  AffiliationDto,
  KeywordDto,
  ReferenceDto,
  SimilarArticleDto,
  FullTextSourceDto,
  JournalInfoDto,
} from './dto/search.dto.js';
import { Logger } from '../utils/logger.js';

export interface PubmedSearchParams {
  term: string;
  sort: SortOrder;
  filter: string[];
  page: number | null;
}

export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly pubmedService = new PubmedService();

  private toSortValue(sort: SortOrder): 'match' | 'date' | 'pubdate' | 'fauth' | 'jour' {
    switch (sort) {
      case SortOrder.DATE:
      case SortOrder.PUBDATE:
        return 'pubdate';
      case SortOrder.FAUTH:
        return 'fauth';
      case SortOrder.JOUR:
        return 'jour';
      case SortOrder.MATCH:
      default:
        return 'match';
    }
  }

  async searchPubMed(params: PubmedSearchParams): Promise<ArticleSearchResultDto> {
    const filters = Array.isArray(params.filter) ? params.filter : params.filter ? [params.filter] : [];
    const result = await this.pubmedService.searchByPattern({
      term: params.term,
      sort: this.toSortValue(params.sort),
      sortOrder: 'dsc',
      filter: filters,
      page: params.page ?? null,
    });

    const articleProfiles: ArticleProfileDto[] = result.articleProfiles.map((p) => ({
      pmid: p.pmid,
      title: p.title,
      authors: p.authors,
      journalCitation: p.journalCitation,
      snippet: p.snippet,
      doi: p.doi,
      position: p.position,
    }));

    return {
      totalResults: result.totalResults,
      totalPages: result.totalPages,
      articleProfiles,
    };
  }

  async getArticleDetail(pmid: string): Promise<ArticleDetailDto> {
    const article = await this.pubmedService.getArticleDetail(pmid);

    return {
      pmid: article.pmid,
      doi: article.doi,
      title: article.title,
      authors: article.authors as AuthorDto[],
      affiliations: article.affiliations as AffiliationDto[],
      abstract: article.abstract,
      keywords: article.keywords as KeywordDto[],
      meshTerms: article.meshTerms as KeywordDto[],
      publicationTypes: article.publicationTypes,
      references: article.references as ReferenceDto[],
      similarArticles: article.similarArticles as SimilarArticleDto[],
      fullTextSources: article.fullTextSources as FullTextSourceDto[],
      conflictOfInterestStatement: article.conflictOfInterestStatement,
      relatedInformation: article.relatedInformation,
      journalInfo: article.journalInfo as JournalInfoDto,
    };
  }
}
