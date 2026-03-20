export enum SortOrder {
  MATCH = 'match',
  DATE = 'date',
  PUBDATE = 'pubdate',
  FAUTH = 'fauth',
  JOUR = 'jour',
}

export interface ArticleProfileDto {
  doi: string | null;
  pmid: string;
  title: string;
  authors: string;
  journalCitation: string;
  snippet: string;
  position?: number;
}

export interface ArticleSearchResultDto {
  totalResults: number | null;
  totalPages: number | null;
  articleProfiles: ArticleProfileDto[];
}

export interface AffiliationDto {
  institution?: string;
  city?: string;
  country?: string;
  email?: string;
}

export interface AuthorDto {
  name: string;
  position?: number;
  affiliations: AffiliationDto[];
}

export interface KeywordDto {
  text: string;
  isMeSH?: boolean;
  majorTopic?: boolean;
}

export interface ReferenceDto {
  pmid?: string;
  citation: string;
}

export interface SimilarArticleDto {
  pmid: string;
  title: string;
}

export interface FullTextSourceDto {
  name: string;
  url: string;
  type?: string;
}

export interface JournalInfoDto {
  title?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  pubDate?: string;
}

export interface ArticleDetailDto {
  doi: string;
  pmid: string;
  title: string;
  authors: AuthorDto[];
  affiliations: AffiliationDto[];
  abstract: string;
  keywords: KeywordDto[];
  conflictOfInterestStatement: string;
  similarArticles: SimilarArticleDto[];
  references: ReferenceDto[];
  publicationTypes: string[];
  meshTerms: KeywordDto[];
  relatedInformation: Record<string, string[]>;
  fullTextSources: FullTextSourceDto[];
  journalInfo: JournalInfoDto;
}

export interface SearchResponseDto {
  success: boolean;
  data?: ArticleSearchResultDto;
  error?: string;
}

export interface ArticleDetailResponseDto {
  success: boolean;
  data?: ArticleDetailDto;
  error?: string;
}
