import { IsString, IsOptional, IsInt, IsEnum, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export enum SortOrder {
  MATCH = 'match',
  DATE = 'date',
  PUBDATE = 'pubdate',
  FAUTH = 'fauth',
  JOUR = 'jour',
}

export class SearchQueryDto {
  @IsString()
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @IsOptional()
  @IsEnum(SortOrder)
  sort?: SortOrder;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  filter?: string[];
}

export class ArticleProfileDto {
  doi!: string | null;
  pmid!: string;
  title!: string;
  authors!: string;
  journalCitation!: string;
  snippet!: string;
  position?: number;
}

export class ArticleSearchResultDto {
  totalResults!: number | null;
  totalPages!: number | null;
  articleProfiles!: ArticleProfileDto[];
}

export class AffiliationDto {
  institution?: string;
  city?: string;
  country?: string;
  email?: string;
}

export class AuthorDto {
  name!: string;
  position?: number;
  affiliations!: AffiliationDto[];
}

export class KeywordDto {
  text!: string;
  isMeSH?: boolean;
}

export class ReferenceDto {
  pmid?: string;
  citation!: string;
}

export class SimilarArticleDto {
  pmid!: string;
  title!: string;
}

export class FullTextSourceDto {
  name!: string;
  url!: string;
  type?: string;
}

export class JournalInfoDto {
  title?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  pubDate?: string;
}

export class ArticleDetailDto {
  doi!: string;
  pmid!: string;
  title!: string;
  authors!: AuthorDto[];
  affiliations!: AffiliationDto[];
  abstract!: string;
  keywords!: KeywordDto[];
  conflictOfInterestStatement!: string;
  similarArticles!: SimilarArticleDto[];
  references!: ReferenceDto[];
  publicationTypes!: string[];
  meshTerms!: KeywordDto[];
  relatedInformation!: Record<string, string[]>;
  fullTextSources!: FullTextSourceDto[];
  journalInfo!: JournalInfoDto;
}

export class SearchResponseDto {
  success!: boolean;
  data?: ArticleSearchResultDto;
  error?: string;
}

export class ArticleDetailResponseDto {
  success!: boolean;
  data?: ArticleDetailDto;
  error?: string;
}
