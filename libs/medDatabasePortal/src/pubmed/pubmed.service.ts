import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as z from 'zod';

export type FieldConstraint =
    | "All Fields"
    | "Affiliation"
    | "Author"
    | "Author - Corporate"
    | "Author - First"
    | "Author - Identifier"
    | "Author - Last"
    | "Book"
    | "Conflict of Interest Statements"
    | "Date - Completion"
    | "Date - Create"
    | "Date - Entry"
    | "Date - MeSH"
    | "Date - Modification"
    | "Date - Publication"
    | "EC/RN Number"
    | "Editor"
    | "Filter"
    | "Grants and Funding"
    | "ISBN"
    | "Investigator"
    | "Issue"
    | "Journal"
    | "Language"
    | "Location ID"
    | "MeSH Major Topic"
    | "MeSH Subheading"
    | "MeSH Terms"
    | "Other Term"
    | "Pagination"
    | "Pharmacological Action"
    | "Publication Type"
    | "Publisher"
    | "Secondary Source ID"
    | "Subject - Personal Name"
    | "Supplementary Concept"
    | "Text Word"
    | "Title"
    | "Title/Abstract"
    | "Transliterated Title"
    | "Volume"

export interface RetrivalStrategy {
    term: string;
    field: FieldConstraint[]; // OR relation
    AND: RetrivalStrategy[] | null;
    OR: RetrivalStrategy[] | null;
    NOT: RetrivalStrategy[] | null;
}

export function renderRetrivalStrategy(strategy: RetrivalStrategy): string {
    const parts: string[] = [];

    // Handle field constraints with OR relation
    if (strategy.field && strategy.field.length > 0) {
        const fieldParts = strategy.field.map(field => {
            if (field === "All Fields") {
                return strategy.term;
            }
            return `${field}[${strategy.term}]`;
        });

        if (fieldParts.length === 1) {
            parts.push(fieldParts[0]);
        } else {
            parts.push(`(${fieldParts.join(' OR ')})`);
        }
    }

    // Handle AND operators
    if (strategy.AND && strategy.AND.length > 0) {
        const andParts = strategy.AND.map(s => renderRetrivalStrategy(s));
        if (andParts.length > 0) {
            const andStr = andParts.join(' AND ');
            parts.push(andStr.length > 1 ? `(${andStr})` : andStr);
        }
    }

    // Handle OR operators
    if (strategy.OR && strategy.OR.length > 0) {
        const orParts = strategy.OR.map(s => renderRetrivalStrategy(s));
        if (orParts.length > 0) {
            const orStr = orParts.join(' OR ');
            parts.push(orStr.length > 1 ? `(${orStr})` : orStr);
        }
    }

    // Handle NOT operators
    if (strategy.NOT && strategy.NOT.length > 0) {
        const notParts = strategy.NOT.map(s => renderRetrivalStrategy(s));
        if (notParts.length > 0) {
            const notStr = notParts.join(' NOT ');
            parts.push(notStr.length > 1 ? `(${notStr})` : notStr);
        }
    }

    // Combine all parts with AND between top-level components
    if (parts.length === 0) {
        return strategy.term || '';
    }

    return parts.join(' AND ');
}

export interface PubmedSearchParams {
    term: string;
    sort: 'match' | 'date' | 'pubdate' | 'fauth' | 'jour';
    sortOrder: 'asc' | 'dsc';
    filter: string[];
    page: number | null;
}

export interface ArticleProfile {
    doi: string | null;
    pmid: string;
    title: string;
    authors: string;
    journalCitation: string;
    snippet: string;
    position?: number;
}

export interface Affiliation {
    institution?: string;
    city?: string;
    country?: string;
    email?: string;
}

export interface Author {
    name: string;
    position?: number;
    affiliations: Affiliation[];
}

export interface Keyword {
    text: string;
    isMeSH?: boolean;
}

export interface Reference {
    pmid?: string;
    citation: string;
}

export interface SimilarArticle {
    pmid: string;
    title: string;
}

export interface FullTextSource {
    name: string;
    url: string;
    type?: string;
}

export interface ArticleDetail {
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
export class PubmedService {
    axiosClient = axios.create({
        baseURL: `https://pubmed.ncbi.nlm.nih.gov/`
    })

    async searchByPattern(params: PubmedSearchParams) {
        const url = this.buildUrl(params);
        console.debug(url)

        const response = await this.axiosClient.get(url)
        const $ = cheerio.load(response.data)

        // Get total results
        const totalResult = $('div.results-amount').find('h3').find('span.value').text().replace(',', '');
        let convertedResult = null;
        try {
            convertedResult = z.coerce.number().parse(totalResult);
            // Handle NaN case - when parsing fails or returns NaN, set to null
            if (Number.isNaN(convertedResult)) {
                convertedResult = null;
            }
        } catch (error) {
            // Silently handle parsing errors - set to null
            convertedResult = null;
        }

        // Get total pages
        let convertedTotalPagesResult = this.getTotalPages($)
        // console.log('convertedTotalPagesResult', convertedTotalPagesResult)

        // Get article profile list
        const articleProfiles = this.getArticleProfileList($);

        return {
            totalResults: convertedResult,
            totalPages: convertedTotalPagesResult,
            articleProfiles,
            html: response.data
        };

    }

    buildUrl(params: PubmedSearchParams) {
        let urlParams = new URLSearchParams();
        urlParams.append('term', params.term);
        if (params.sort) {
            if (params.sort === 'match') {

            } else {
                urlParams.append('sort', params.sort)
            }

        }
        if (params.page) {
            urlParams.append('page', String(params.page))
        }
        if (params.filter && params.filter.length > 0) {
            params.filter.forEach(e => urlParams.append('filter', e))
        }
        return `?${urlParams.toString()}`
    }

    getTotalPages($: cheerio.CheerioAPI) {
        const totalPagesResult = $('label.of-total-pages').first().text().replace('of ', '').replace(',', '')
        let convertedTotalPagesResult = null;
        try {
            convertedTotalPagesResult = z.coerce.number().parse(totalPagesResult);
            // Handle NaN case - when parsing fails or returns NaN, set to null
            if (Number.isNaN(convertedTotalPagesResult)) {
                convertedTotalPagesResult = null;
            }
        } catch (error) {
            // Silently handle parsing errors - set to null
            convertedTotalPagesResult = null;
        }
        return convertedTotalPagesResult
    }

    getArticleProfileList($: cheerio.CheerioAPI): ArticleProfile[] {
        const articleProfiles: ArticleProfile[] = [];

        try {
            const articleElements = $('article.full-docsum');

            articleElements.each((index, element) => {
                const $article = cheerio.load(element);


                // Extract PMID from checkbox value or docsum-pmid
                const checkbox = $article('input.search-result-selector');
                const pmidFromCheckbox = checkbox.attr('value');
                const pmidFromSpan = $article('.docsum-pmid').text().trim();
                const pmid = pmidFromCheckbox || pmidFromSpan || '';

                // Extract title
                const title = $article('.docsum-title').text().trim();

                // Extract authors (prefer full authors, fallback to short authors)
                const fullAuthors = $article('.docsum-authors.full-authors').text().trim();
                const shortAuthors = $article('.docsum-authors.short-authors').text().trim();
                const authors = fullAuthors || shortAuthors || '';

                // Extract journal citation (prefer full citation, fallback to short citation)
                const fullJournal = $article('.docsum-journal-citation.full-journal-citation').text().trim();
                const shortJournal = $article('.docsum-journal-citation.short-journal-citation').text().trim();
                const journalCitation = fullJournal || shortJournal || '';

                const doiMatch = journalCitation.match(/10\.\d{4}\/[^\s]+(?<![.,;:!?)(\]\'])/)
                let doi;
                if (!doiMatch) {
                    doi = null
                    // throw new Error('parse search result failed: cannot extract doi from full Journal from: ' + journalCitation)
                } else {
                    doi = doiMatch[0]
                }

                // Extract snippet (prefer full view, fallback to short view)
                const fullSnippet = $article('.full-view-snippet').text().trim();
                const shortSnippet = $article('.short-view-snippet').text().trim();
                const snippet = fullSnippet || shortSnippet || '';

                // Extract position number
                const positionText = $article('.position-number').text().trim();
                const position = positionText ? parseInt(positionText, 10) : undefined;

                articleProfiles.push({
                    doi,
                    pmid,
                    title,
                    authors,
                    journalCitation,
                    snippet,
                    position
                });
            });
        } catch (error) {
            const errorMessage = `Error parsing article profiles: ${error instanceof Error ? error.message : String(error)}`
            // console.error(errorMessage);
            throw new Error(errorMessage)
        }

        return articleProfiles;
    }

    async loadArticle(pmid: string): Promise<cheerio.CheerioAPI> {
        try {
            const response = await this.axiosClient.get(`/${pmid}`)
            // console.log(response.data)
            const $ = cheerio.load(response.data)
            return $
        } catch (error) {
            throw new Error(`Load article detail page request failed: ${error instanceof Error ? error.message : JSON.stringify(error)}`)
        }
    }

    private extractTitle($: cheerio.CheerioAPI): string {
        const title = $('h1.article-title').first().text().trim() ||
            $('h1.heading-title').first().text().trim();
        if (!title) {
            throw new Error('Failed to extract article title');
        }
        return title;
    }

    private extractAuthors($: cheerio.CheerioAPI): Author[] {
        const authors: Author[] = [];
        const seenNames = new Set<string>();

        $('div.authors-list').find('span.authors-list-item').each((index, element) => {
            const $author = $(element);
            const name = $author.find('a[data-ga-action="author"]').text().trim() ||
                $author.text().trim();

            if (!name) return;

            // Extract position numbers from the name (e.g., "1", "5\n\n6")
            const positionMatch = name.match(/(\d+)(?:\s*\n*\s*(\d+))?\s*,?\s*$/);
            let position: number | undefined;
            if (positionMatch) {
                // If there are two numbers (like "5\n\n6"), use the first one as primary position
                position = parseInt(positionMatch[1], 10);
            }

            // Clean the name: remove extra whitespace, newlines, numeric suffixes, and trailing commas
            const cleanedName = name
                .replace(/\s+/g, ' ')           // Replace multiple whitespace with single space
                .replace(/\s*\d+(?:\s*\n*\s*\d+)?\s*,?\s*$/g, '') // Remove numeric suffixes (e.g., "1", " 5\n\n6") at the end
                .replace(/,\s*$/, '')           // Remove trailing comma
                .trim();

            // Skip if name is empty after cleaning or already seen
            if (!cleanedName || seenNames.has(cleanedName)) return;
            seenNames.add(cleanedName);

            const affiliations: Affiliation[] = [];
            $author.find('.affiliations').find('li').each((_, affElement) => {
                const $aff = $(affElement);
                const institution = $aff.find('.institution').text().trim();
                const city = $aff.find('.city').text().trim();
                const country = $aff.find('.country').text().trim();
                const email = $aff.find('.email').text().trim();

                if (institution || city || country || email) {
                    affiliations.push({ institution, city, country, email });
                }
            });

            authors.push({ name: cleanedName, position, affiliations });
        });

        if (authors.length === 0) {
            throw new Error('Failed to extract article authors');
        }

        return authors;
    }

    private extractAffiliations($: cheerio.CheerioAPI): Affiliation[] {
        const affiliations: Affiliation[] = [];
        $('.affiliations').find('li').each((_, element) => {
            const $aff = $(element);
            const text = $aff.text().trim();
            const institution = $aff.find('.institution').text().trim() || text;
            const city = $aff.find('.city').text().trim();
            const country = $aff.find('.country').text().trim();
            const email = $aff.find('.email').text().trim();

            if (institution || city || country || email) {
                affiliations.push({ institution, city, country, email });
            }
        });

        if (affiliations.length === 0) {
            throw new Error('Failed to extract affiliations');
        }

        return affiliations;
    }

    private extractAbstract($: cheerio.CheerioAPI): string {
        const abstract = $('#abstract').find('.abstract-content').text().trim() ||
            $('.abstract').text().trim() ||
            $('div.abstract-content').text().trim();

        if (!abstract) {
            throw new Error('Failed to extract article abstract');
        }

        return abstract;
    }

    private extractKeywords($: cheerio.CheerioAPI): Keyword[] {
        const keywords: Keyword[] = [];

        // Try to extract from keywords section first
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

        // If no keywords section, try extracting from mesh-terms section (excluding major MeSH terms)
        if (keywords.length === 0) {
            $('#mesh-terms').find('.keywords-list').find('.keyword-link').not('.major').each((_, element) => {
                const $keyword = $(element);
                const text = $keyword.text().trim();
                if (text) {
                    keywords.push({ text, isMeSH: false });
                }
            });
        }

        if (keywords.length === 0) {
            throw new Error('Failed to extract article keywords');
        }

        return keywords;
    }

    private extractConflictOfInterestStatement($: cheerio.CheerioAPI): string {
        const statement = $('.conflict-of-interest').find('.statement').text().trim() ||
            $('.conflict-of-interest-statement').text().trim() ||
            $('div[data-section="conflict-of-interest"]').text().trim();

        if (!statement) {
            throw new Error('Failed to extract conflict of interest statement');
        }

        return statement;
    }

    private extractSimilarArticles($: cheerio.CheerioAPI): SimilarArticle[] {
        const similarArticles: SimilarArticle[] = [];
        $('#similar').find('.articles-list').find('li.full-docsum').each((_, element) => {
            const $article = $(element);
            const pmid = $article.find('a.docsum-title').attr('href')?.match(/\/(\d+)/)?.[1] || '';
            const title = $article.find('.docsum-title').text().trim();
            if (pmid && title) {
                similarArticles.push({ pmid, title });
            }
        });

        if (similarArticles.length === 0) {
            throw new Error('Failed to extract similar articles');
        }

        return similarArticles;
    }

    private extractReferences($: cheerio.CheerioAPI): Reference[] {
        const references: Reference[] = [];
        $('#references').find('li').each((_, element) => {
            const $ref = $(element);
            const pmid = $ref.find('a').attr('href')?.match(/\/(\d+)/)?.[1];
            const citation = $ref.text().trim();
            if (citation) {
                references.push({ pmid, citation });
            }
        });

        if (references.length === 0) {
            throw new Error('Failed to extract article references');
        }

        return references;
    }

    private extractPublicationTypes($: cheerio.CheerioAPI): string[] {
        const types: string[] = [];
        $('.publication-types').find('li').each((_, element) => {
            const type = $(element).text().trim();
            if (type) {
                types.push(type);
            }
        });

        if (types.length === 0) {
            throw new Error('Failed to extract publication types');
        }

        return types;
    }

    private extractMeshTerms($: cheerio.CheerioAPI): Keyword[] {
        const meshTerms: Keyword[] = [];
        $('#mesh-terms').find('.keywords-list').find('.keyword-link').each((_, element) => {
            const $term = $(element);
            const text = $term.text().trim();
            if (text) {
                meshTerms.push({ text, isMeSH: true });
            }
        });

        if (meshTerms.length === 0) {
            throw new Error('Failed to extract MeSH terms');
        }

        return meshTerms;
    }

    private extractRelatedInformation($: cheerio.CheerioAPI): Record<string, string[]> {
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

        if (Object.keys(relatedInfo).length === 0) {
            throw new Error('Failed to extract related information');
        }

        return relatedInfo;
    }

    private extractFullTextSources($: cheerio.CheerioAPI): FullTextSource[] {
        const sources: FullTextSource[] = [];
        $('.full-text-links').find('a').each((_, element) => {
            const $link = $(element);
            const url = $link.attr('href') || '';
            const name = $link.text().trim();
            const type = $link.attr('data-ga-label') || $link.attr('data-source-type');
            if (url && name) {
                sources.push({ name, url, type });
            }
        });

        if (sources.length === 0) {
            throw new Error('Failed to extract full text sources');
        }

        return sources;
    }

    private extractJournalInfo($: cheerio.CheerioAPI): {
        title?: string;
        volume?: string;
        issue?: string;
        pages?: string;
        pubDate?: string;
    } {
        // Try extracting from meta tags first
        let title = $('meta[name="citation_journal_title"]').attr('content') || '';
        let volume = $('meta[name="citation_volume"]').attr('content') || '';
        let issue = $('meta[name="citation_issue"]').attr('content') || '';

        // If not found in meta tags, try extracting from classes
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

        if (!title && !volume && !issue && !pages && !pubDate) {
            throw new Error('Failed to extract journal information');
        }

        return {
            title,
            volume,
            issue,
            pages,
            pubDate
        };
    }

    private extractDOI($: cheerio.CheerioAPI, pmid: string): string {
        const DOI = $('span.identifier.doi > a.id-link').first().text().trim()
        if (DOI.length < 1) throw new Error(`Get article detail failed: failed to find DOI of pmid ${pmid}`)
        console.log(DOI)
        return DOI
    }

    async getArticleDetail(pmid: string): Promise<ArticleDetail> {
        const $article = await this.loadArticle(pmid)
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
            journalInfo: this.extractJournalInfo($article)
        }
    }
}
