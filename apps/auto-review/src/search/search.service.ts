import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as z from 'zod';
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

export interface PubmedSearchParams {
  term: string;
  sort: SortOrder;
  filter: string[];
  page: number | null;
}

interface ArticleProfile {
  doi: string | null;
  pmid: string;
  title: string;
  authors: string;
  journalCitation: string;
  snippet: string;
  position?: number;
}

interface Affiliation {
  institution?: string;
  city?: string;
  country?: string;
  email?: string;
}

interface Author {
  name: string;
  position?: number;
  affiliations: Affiliation[];
}

interface Keyword {
  text: string;
  isMeSH?: boolean;
}

interface Reference {
  pmid?: string;
  citation: string;
}

interface SimilarArticle {
  pmid: string;
  title: string;
}

interface FullTextSource {
  name: string;
  url: string;
  type?: string;
}

interface ArticleDetail {
  doi: string;
  pmid: string;
  title: string;
  authors: Author[];
  affiliations: Affiliation[];
  abstract: string;
  keywords: Keyword[];
  conflictOfInterestStatement: string;
  similarArticles: SimilarArticle[];
  references: Reference[];
  publicationTypes: string[];
  meshTerms: Keyword[];
  relatedInformation: Record<string, string[]>;
  fullTextSources: FullTextSource[];
  journalInfo: {
    title?: string;
    volume?: string;
    issue?: string;
    pages?: string;
    pubDate?: string;
  };
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly axiosClient = axios.create({
    baseURL: 'https://pubmed.ncbi.nlm.nih.gov/',
  });

  async searchPubMed(params: PubmedSearchParams): Promise<ArticleSearchResultDto> {
    const url = this.buildUrl(params);
    this.logger.debug(`Searching PubMed: ${url}`);

    const response = await this.axiosClient.get(url);
    const $ = cheerio.load(response.data);

    const totalResult = $('div.results-amount').find('h3').find('span.value').text().replace(',', '');
    let convertedResult: number | null = null;
    try {
      convertedResult = z.coerce.number().parse(totalResult);
      if (Number.isNaN(convertedResult)) {
        convertedResult = null;
      }
    } catch {
      convertedResult = null;
    }

    const totalPages = this.getTotalPages($);
    const articleProfiles = this.getArticleProfileList($);

    return {
      totalResults: convertedResult,
      totalPages,
      articleProfiles,
    };
  }

  async getArticleDetail(pmid: string): Promise<ArticleDetailDto> {
    this.logger.debug(`Fetching article detail for PMID: ${pmid}`);
    const $article = await this.loadArticle(pmid);

    return {
      doi: this.extractDOI($article, pmid),
      pmid,
      title: this.extractTitle($article),
      authors: this.extractAuthors($article),
      affiliations: this.extractAffiliations($article),
      abstract: this.extractAbstract($article),
      keywords: this.extractKeywords($article),
      conflictOfInterestStatement: this.extractConflictOfInterestStatement($article),
      similarArticles: this.extractSimilarArticles($article),
      references: this.extractReferences($article),
      publicationTypes: this.extractPublicationTypes($article),
      meshTerms: this.extractMeshTerms($article),
      relatedInformation: this.extractRelatedInformation($article),
      fullTextSources: this.extractFullTextSources($article),
      journalInfo: this.extractJournalInfo($article),
    };
  }

  private buildUrl(params: PubmedSearchParams): string {
    const urlParams = new URLSearchParams();
    urlParams.append('term', params.term);
    if (params.sort && params.sort !== SortOrder.MATCH) {
      urlParams.append('sort', params.sort);
    }
    if (params.page) {
      urlParams.append('page', String(params.page));
    }
    if (params.filter && params.filter.length > 0) {
      for (const filter of params.filter) {
        switch (filter.toLowerCase()) {
          case 'books and documents':
            urlParams.append('filter', 'pubt.booksdocs');
            break;
          case 'clinical trial':
            urlParams.append('filter', 'pubt.clinicaltrial');
            break;
          case 'meta-analysis':
            urlParams.append('filter', 'pubt.meta-analysis');
            break;
          case 'randomized controlled trial':
            urlParams.append('filter', 'pubt.randomizedcontrolledtrial');
            break;
          case 'review':
            urlParams.append('filter', 'pubt.review');
            break;
          case 'systematic review':
            urlParams.append('filter', 'pubt.systematicreview');
            break;
          default:
            throw new Error(`Unsupported filter: "${filter}"`);
        }
      }
    }
    return `?${urlParams.toString()}`;
  }

  private getTotalPages($: ReturnType<typeof cheerio.load>): number | null {
    const totalPagesResult = $('label.of-total-pages').first().text().replace('of ', '').replace(',', '');
    let convertedTotalPagesResult: number | null = null;
    try {
      convertedTotalPagesResult = z.coerce.number().parse(totalPagesResult);
      if (Number.isNaN(convertedTotalPagesResult)) {
        convertedTotalPagesResult = null;
      }
    } catch {
      convertedTotalPagesResult = null;
    }
    return convertedTotalPagesResult;
  }

  private getArticleProfileList($: ReturnType<typeof cheerio.load>): ArticleProfileDto[] {
    const articleProfiles: ArticleProfileDto[] = [];

    const articleElements = $('article.full-docsum');
    articleElements.each((_, element) => {
      const $article = cheerio.load(element);

      const checkbox = $article('input.search-result-selector');
      const pmidFromCheckbox = checkbox.attr('value');
      const pmidFromSpan = $article('.docsum-pmid').text().trim();
      const pmid = pmidFromCheckbox || pmidFromSpan || '';

      const title = $article('.docsum-title').text().trim();

      const fullAuthors = $article('.docsum-authors.full-authors').text().trim();
      const shortAuthors = $article('.docsum-authors.short-authors').text().trim();
      const authors = fullAuthors || shortAuthors || '';

      const fullJournal = $article('.docsum-journal-citation.full-journal-citation').text().trim();
      const shortJournal = $article('.docsum-journal-citation.short-journal-citation').text().trim();
      const journalCitation = fullJournal || shortJournal || '';

      const doiMatch = journalCitation.match(/10\.\d{4}\/[^\s]+(?<![.,;:!?)(\]\'])/);
      const doi = doiMatch ? doiMatch[0] : null;

      const fullSnippet = $article('.full-view-snippet').text().trim();
      const shortSnippet = $article('.short-view-snippet').text().trim();
      const snippet = fullSnippet || shortSnippet || '';

      const positionText = $article('.position-number').text().trim();
      const position = positionText ? parseInt(positionText, 10) : undefined;

      articleProfiles.push({
        doi,
        pmid,
        title,
        authors,
        journalCitation,
        snippet,
        position,
      });
    });

    return articleProfiles;
  }

  private async loadArticle(pmid: string): Promise<ReturnType<typeof cheerio.load>> {
    const response = await this.axiosClient.get(`/${pmid}`);
    return cheerio.load(response.data);
  }

  private extractTitle($: ReturnType<typeof cheerio.load>): string {
    const title = $('h1.article-title').first().text().trim() ||
      $('h1.heading-title').first().text().trim();
    if (!title) {
      throw new Error('Failed to extract article title');
    }
    return title;
  }

  private extractAuthors($: ReturnType<typeof cheerio.load>): AuthorDto[] {
    const authors: AuthorDto[] = [];
    const seenNames = new Set<string>();

    $('div.authors-list').find('span.authors-list-item').each((_, element) => {
      const $author = $(element);
      const name = $author.find('a[data-ga-action="author"]').text().trim() ||
        $author.text().trim();

      if (!name) return;

      const positionMatch = name.match(/(\d+)(?:\s*\n*\s*(\d+))?\s*,?\s*$/);
      let position: number | undefined;
      if (positionMatch) {
        position = parseInt(positionMatch[1], 10);
      }

      const cleanedName = name
        .replace(/\s+/g, ' ')
        .replace(/\s*\d+(?:\s*\n*\s*\d+)?\s*,?\s*$/g, '')
        .replace(/,\s*$/, '')
        .trim();

      if (!cleanedName || seenNames.has(cleanedName)) return;
      seenNames.add(cleanedName);

      const affiliations: AffiliationDto[] = [];
      $author.find('.affiliations').find('li').each((__, affElement) => {
        const $aff = $(affElement);
        affiliations.push({
          institution: $aff.find('.institution').text().trim(),
          city: $aff.find('.city').text().trim(),
          country: $aff.find('.country').text().trim(),
          email: $aff.find('.email').text().trim(),
        });
      });

      authors.push({ name: cleanedName, position, affiliations });
    });

    return authors;
  }

  private extractAffiliations($: ReturnType<typeof cheerio.load>): AffiliationDto[] {
    const affiliations: AffiliationDto[] = [];
    $('.affiliations').find('li').each((_, element) => {
      const $aff = $(element);
      const text = $aff.text().trim();
      affiliations.push({
        institution: $aff.find('.institution').text().trim() || text,
        city: $aff.find('.city').text().trim(),
        country: $aff.find('.country').text().trim(),
        email: $aff.find('.email').text().trim(),
      });
    });
    return affiliations;
  }

  private extractAbstract($: ReturnType<typeof cheerio.load>): string {
    const abstract = $('#abstract').find('.abstract-content').text().trim() ||
      $('.abstract').text().trim() ||
      $('div.abstract-content').text().trim();
    if (!abstract) {
      throw new Error('Failed to extract article abstract');
    }
    return abstract;
  }

  private extractKeywords($: ReturnType<typeof cheerio.load>): KeywordDto[] {
    const keywords: KeywordDto[] = [];

    const $keywordsSection = $('#keywords');
    if ($keywordsSection.length > 0) {
      $keywordsSection.find('.keywords-list').find('.keyword-link').each((_, element) => {
        const $keyword = $(element);
        const text = $keyword.text().trim();
        if (text) {
          keywords.push({ text, isMeSH: $keyword.hasClass('major') });
        }
      });
    }

    if (keywords.length === 0) {
      $('#mesh-terms').find('.keywords-list').find('.keyword-link').not('.major').each((_, element) => {
        const $keyword = $(element);
        const text = $keyword.text().trim();
        if (text) {
          keywords.push({ text, isMeSH: false });
        }
      });
    }

    return keywords;
  }

  private extractConflictOfInterestStatement($: ReturnType<typeof cheerio.load>): string {
    return $('.conflict-of-interest').find('.statement').text().trim() ||
      $('.conflict-of-interest-statement').text().trim() ||
      $('div[data-section="conflict-of-interest"]').text().trim();
  }

  private extractSimilarArticles($: ReturnType<typeof cheerio.load>): SimilarArticleDto[] {
    const similarArticles: SimilarArticleDto[] = [];
    $('#similar').find('.articles-list').find('li.full-docsum').each((_, element) => {
      const $article = $(element);
      const pmid = $article.find('a.docsum-title').attr('href')?.match(/\/(\d+)/)?.[1] || '';
      const title = $article.find('.docsum-title').text().trim();
      if (pmid && title) {
        similarArticles.push({ pmid, title });
      }
    });
    return similarArticles;
  }

  private extractReferences($: ReturnType<typeof cheerio.load>): ReferenceDto[] {
    const references: ReferenceDto[] = [];
    $('#references').find('li').each((_, element) => {
      const $ref = $(element);
      const pmid = $ref.find('a').attr('href')?.match(/\/(\d+)/)?.[1];
      const citation = $ref.text().trim();
      if (citation) {
        references.push({ pmid, citation });
      }
    });
    return references;
  }

  private extractPublicationTypes($: ReturnType<typeof cheerio.load>): string[] {
    const types: string[] = [];
    $('.publication-types').find('li').each((_, element) => {
      const type = $(element).text().trim();
      if (type) {
        types.push(type);
      }
    });
    return types;
  }

  private extractMeshTerms($: ReturnType<typeof cheerio.load>): KeywordDto[] {
    const meshTerms: KeywordDto[] = [];
    $('#mesh-terms').find('.keywords-list').find('.keyword-link').each((_, element) => {
      const $term = $(element);
      const text = $term.text().trim();
      if (text) {
        meshTerms.push({ text, isMeSH: true });
      }
    });
    return meshTerms;
  }

  private extractRelatedInformation($: ReturnType<typeof cheerio.load>): Record<string, string[]> {
    const relatedInfo: Record<string, string[]> = {};
    $('#related-links').find('.related-links-list').find('li').each((_, element) => {
      const $section = $(element);
      const link = $section.find('a');
      const href = link.attr('href');
      const text = link.text().trim();
      if (href && text) {
        const sectionTitle = 'Related information';
        if (!relatedInfo[sectionTitle]) {
          relatedInfo[sectionTitle] = [];
        }
        relatedInfo[sectionTitle].push(`${text}: ${href}`);
      }
    });
    return relatedInfo;
  }

  private extractFullTextSources($: ReturnType<typeof cheerio.load>): FullTextSourceDto[] {
    const sources: FullTextSourceDto[] = [];
    $('.full-text-links').find('a').each((_, element) => {
      const $link = $(element);
      const url = $link.attr('href') || '';
      const name = $link.text().trim();
      const type = $link.attr('data-ga-label') || $link.attr('data-source-type');
      if (url && name) {
        sources.push({ name, url, type });
      }
    });
    return sources;
  }

  private extractJournalInfo($: ReturnType<typeof cheerio.load>): JournalInfoDto {
    let title = $('meta[name="citation_journal_title"]').attr('content') || '';
    let volume = $('meta[name="citation_volume"]').attr('content') || '';
    let issue = $('meta[name="citation_issue"]').attr('content') || '';

    if (!title) {
      title = $('.journal-title').text().trim();
    }
    if (!volume) {
      volume = $('.volume').text().trim();
    }
    if (!issue) {
      issue = $('.issue').text().trim();
    }
    const pages = $('.pages').text().trim();
    const pubDate = $('.pub-date').text().trim();

    return {
      title: title || undefined,
      volume: volume || undefined,
      issue: issue || undefined,
      pages: pages || undefined,
      pubDate: pubDate || undefined,
    };
  }

  private extractDOI($: ReturnType<typeof cheerio.load>, pmid: string): string {
    return $('span.identifier.doi > a.id-link').first().text().trim();
  }
}
