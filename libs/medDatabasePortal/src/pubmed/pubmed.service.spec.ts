import { Test, TestingModule } from '@nestjs/testing';
import { PubmedService, PubmedSearchParams } from './pubmed.service.js';
import * as cheerio from 'cheerio';
import { readFileSync } from 'fs';
import path from 'path';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('PubmedService', () => {
  let service: PubmedService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PubmedService],
    }).compile();

    service = module.get<PubmedService>(PubmedService);
  });

  it.skip('should be defined', async () => {
    // expect(service).toBeDefined();
    await service.searchByPattern({
      term: '(hypertension[Title]) AND (food[Text Word])',
      sort: 'match',
      sortOrder: 'asc',
      filter: [],
      page: null
    })
  });

  it('should build search params correctly', () => {
    const testPattern: PubmedSearchParams = {
      term: '(hypertension[Title]) AND (food[Text Word])',
      sort: 'match',
      sortOrder: 'asc',
      filter: [],
      page: null
    }

    const result = service.buildUrl(testPattern)
    expect(result).toBe('?term=%28hypertension%5BTitle%5D%29+AND+%28food%5BText+Word%5D%29')
  })

  it('should build search params with books and documents filter', () => {
    const testPattern: PubmedSearchParams = {
      term: 'hypertension',
      sort: 'match',
      sortOrder: 'asc',
      filter: ['books and documents'],
      page: null
    }

    const result = service.buildUrl(testPattern)
    expect(result).toContain('term=hypertension')
    expect(result).toContain('filter=pubt.booksdocs')
  })

  it('should build search params with clinical trial filter', () => {
    const testPattern: PubmedSearchParams = {
      term: 'diabetes',
      sort: 'match',
      sortOrder: 'asc',
      filter: ['clinical trial'],
      page: null
    }

    const result = service.buildUrl(testPattern)
    expect(result).toContain('term=diabetes')
    expect(result).toContain('filter=pubt.clinicaltrial')
  })

  it('should build search params with meta-analysis filter', () => {
    const testPattern: PubmedSearchParams = {
      term: 'cancer',
      sort: 'match',
      sortOrder: 'asc',
      filter: ['meta-analysis'],
      page: null
    }

    const result = service.buildUrl(testPattern)
    expect(result).toContain('term=cancer')
    expect(result).toContain('filter=pubt.meta-analysis')
  })

  it('should build search params with randomized controlled trial filter', () => {
    const testPattern: PubmedSearchParams = {
      term: 'hypertension',
      sort: 'match',
      sortOrder: 'asc',
      filter: ['randomized controlled trial'],
      page: null
    }

    const result = service.buildUrl(testPattern)
    expect(result).toContain('term=hypertension')
    expect(result).toContain('filter=pubt.randomizedcontrolledtrial')
  })

  it('should build search params with review filter', () => {
    const testPattern: PubmedSearchParams = {
      term: 'obesity',
      sort: 'match',
      sortOrder: 'asc',
      filter: ['review'],
      page: null
    }

    const result = service.buildUrl(testPattern)
    expect(result).toContain('term=obesity')
    expect(result).toContain('filter=pubt.review')
  })

  it('should build search params with systematic review filter', () => {
    const testPattern: PubmedSearchParams = {
      term: 'diabetes',
      sort: 'match',
      sortOrder: 'asc',
      filter: ['systematic review'],
      page: null
    }

    const result = service.buildUrl(testPattern)
    expect(result).toContain('term=diabetes')
    expect(result).toContain('filter=pubt.systematicreview')
  })

  it('should build search params with multiple filters', () => {
    const testPattern: PubmedSearchParams = {
      term: 'cancer',
      sort: 'match',
      sortOrder: 'asc',
      filter: ['clinical trial', 'systematic review'],
      page: null
    }

    const result = service.buildUrl(testPattern)
    expect(result).toContain('term=cancer')
    expect(result).toContain('filter=pubt.clinicaltrial')
    expect(result).toContain('filter=pubt.systematicreview')
  })

  it('should throw error for unsupported filter', () => {
    const testPattern: PubmedSearchParams = {
      term: 'test',
      sort: 'match',
      sortOrder: 'asc',
      filter: ['unsupported filter'],
      page: null
    }

    expect(() => service.buildUrl(testPattern)).toThrow('Parse Pubmed search filter failed: unsupported filter "unsupported filter"')
  })

  // ============ Date Range Filter Tests ============
  describe('Date Range Filter', () => {
    it('should build search params with single date range filter (YYYY:YYYY format)', () => {
      const testPattern: PubmedSearchParams = {
        term: 'cancer',
        sort: 'match',
        sortOrder: 'asc',
        filter: ['2020:2024'],
        page: null
      }

      const result = service.buildUrl(testPattern)
      const decodedResult = decodeURIComponent(result)
      console.log('Date range filter result:', decodedResult)

      // Input format YYYY:YYYY is converted to PubMed standard YYYY/YYYY[dp]
      expect(decodedResult).toContain('2020/2024[dp]')
    })

    it('should build search params with date range and publication type filter combined', () => {
      const testPattern: PubmedSearchParams = {
        term: 'diabetes',
        sort: 'match',
        sortOrder: 'asc',
        filter: ['2020:2024', 'clinical trial'],
        page: null
      }

      const result = service.buildUrl(testPattern)
      const decodedResult = decodeURIComponent(result)
      console.log('Combined filter result:', decodedResult)

      // Should have both date range (converted to slash) and clinical trial filter
      expect(decodedResult).toContain('2020/2024[dp]')
      expect(result).toContain('filter=pubt.clinicaltrial')
    })

    it('should handle multiple date range filters', () => {
      const testPattern: PubmedSearchParams = {
        term: 'hypertension',
        sort: 'match',
        sortOrder: 'asc',
        filter: ['2010:2015', '2020:2024'],
        page: null
      }

      const result = service.buildUrl(testPattern)
      const decodedResult = decodeURIComponent(result)
      console.log('Multiple date range result:', decodedResult)

      // Multiple date ranges are joined with AND, converted to slash format
      expect(decodedResult).toContain('2010/2015[dp]')
      expect(decodedResult).toContain('2020/2024[dp]')
      expect(decodedResult).toContain('AND')
    })

    it('should handle date range with single year', () => {
      const testPattern: PubmedSearchParams = {
        term: 'obesity',
        sort: 'match',
        sortOrder: 'asc',
        filter: ['2023:2023'],
        page: null
      }

      const result = service.buildUrl(testPattern)
      const decodedResult = decodeURIComponent(result)
      console.log('Single year date range result:', decodedResult)

      expect(decodedResult).toContain('2023/2023[dp]')
    })

    it('should NOT match invalid date range formats', () => {
      const testPattern: PubmedSearchParams = {
        term: 'test',
        sort: 'match',
        sortOrder: 'asc',
        filter: ['2020-2024', '2020/2024', '20:24'], // Invalid formats (hyphen, slash, short year)
        page: null
      }

      // These should throw error as they don't match YYYY:YYYY pattern
      // and are not recognized as valid filters
      expect(() => service.buildUrl(testPattern)).toThrow()
    })

    it('should generate correct PubMed query syntax for date range', () => {
      const testPattern: PubmedSearchParams = {
        term: 'cancer treatment',
        sort: 'match',
        sortOrder: 'asc',
        filter: ['2020:2024'],
        page: null
      }

      const result = service.buildUrl(testPattern)
      const decodedResult = decodeURIComponent(result)

      // Should generate PubMed standard format: 2020/2024[dp]
      expect(decodedResult).toContain('term=cancer+treatment+AND+')
      expect(decodedResult).toContain('2020/2024[dp]')
    })

    it('should convert colon to slash for PubMed standard format', () => {
      // Verify that the input format YYYY:YYYY is converted to YYYY/YYYY[dp]
      const testPattern: PubmedSearchParams = {
        term: 'cancer',
        sort: 'match',
        sortOrder: 'asc',
        filter: ['2020:2024'],
        page: null
      }

      const result = service.buildUrl(testPattern)
      const decodedResult = decodeURIComponent(result)

      // Should use slash (PubMed standard), not colon
      expect(decodedResult).toContain('2020/2024[dp]')
      expect(decodedResult).not.toContain('2020:2024[dp]')
    })
  })

  it('should get articles from search result page', async () => {
    const $ = cheerio.load(testPubmedWebStr)
    const articles = service.getArticleProfileList($)
    console.log(articles)

    expect(articles).toBeDefined()
    expect(articles.length).toBeGreaterThan(0)
    expect(articles[0]).toHaveProperty('pmid')
    expect(articles[0]).toHaveProperty('title')
    expect(articles[0]).toHaveProperty('authors')
    expect(articles[0]).toHaveProperty('journalCitation')
    expect(articles[0]).toHaveProperty('snippet')

    // Verify first article data
    expect(articles[0].pmid).toBe('34601963')
    expect(articles[0].title).toContain('Circadian')
    expect(articles[0].title).toContain('Hypertension')
    expect(articles[0].authors).toContain('Gumz ML')
    expect(articles[0].journalCitation).toContain('10.1161/HYPERTENSIONAHA.121.14519.')
    expect(articles[0].snippet).toContain('Circadian rhythms')
    expect(articles[0].doi).toBe('10.1161/HYPERTENSIONAHA.121.14519')

  })

  it('load article detail page, scrape basic information', async () => {
    const spy = vi.spyOn(service, 'loadArticle').mockResolvedValue(cheerio.load(testDetailPageStr))
    const res = await service.getArticleDetail('37882686')
    expect(spy).toBeCalled()
    console.log(res)
    expect(res.doi).toBe('10.1097/CRD.0000000000000623')


  })

  it('should get total pages', async () => {
    const $ = cheerio.load(testPubmedWebStr)
    const totalPages = service.getTotalPages($)

    console.log(totalPages)
    expect(totalPages).toBe(184)
  })
});

const testPubmedWebStr = readFileSync(path.join(__dirname, 'pubmedSearchResultPage.test.html'))
const testDetailPageStr = readFileSync(path.join(__dirname, 'pubmedArticleDetailPage.test.html'))