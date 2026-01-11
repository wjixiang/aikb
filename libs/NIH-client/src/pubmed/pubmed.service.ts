import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as z from 'zod';

interface PubmedSearchParams {
    term: string;
    sort: string;
    filter: string[];
    page: number | null;
}

export interface ArticleProfile {
    pmid: string;
    title: string;
    authors: string;
    journalCitation: string;
    snippet: string;
    docsumLink: string;
    position?: number;
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
            console.log(convertedResult)
        } catch (error) {
            console.log(error instanceof Error ? error.message : String(error))
        }

        // Get total pages
        const totalPagesResult = $('div.page-number-wrapper').find('label.of-total-pages').text().replace('of ', '')
        let convertedTotalPagesResult = null;
        try {
            convertedTotalPagesResult = z.coerce.number().parse(totalPagesResult);
        } catch (error) {
            console.log(error instanceof Error ? error.message : String(error))
        }
        return response.data

        // Get article profile list

    }

    buildUrl(params: PubmedSearchParams) {
        let urlParams = new URLSearchParams();
        urlParams.append('term', params.term);
        if (params.sort) {
            urlParams.append('sort', params.sort)
        }
        if (params.page) {
            urlParams.append('page', String(params.page))
        }
        params.filter.map(e => urlParams.append('filter', e))
        return `?${urlParams.toString()}`
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

                // Extract snippet (prefer full view, fallback to short view)
                const fullSnippet = $article('.full-view-snippet').text().trim();
                const shortSnippet = $article('.short-view-snippet').text().trim();
                const snippet = fullSnippet || shortSnippet || '';

                // Extract docsum link
                const docsumLinkElement = $article('a.docsum-title');
                const docsumLink = docsumLinkElement.attr('href') || '';

                // Extract position number
                const positionText = $article('.position-number').text().trim();
                const position = positionText ? parseInt(positionText, 10) : undefined;

                articleProfiles.push({
                    pmid,
                    title,
                    authors,
                    journalCitation,
                    snippet,
                    docsumLink,
                    position
                });
            });
        } catch (error) {
            console.error('Error parsing article profiles:', error instanceof Error ? error.message : String(error));
        }

        return articleProfiles;
    }
}
