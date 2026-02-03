import { Test, TestingModule } from '@nestjs/testing';
import { PubmedService, PubmedSearchParams } from './pubmed.service';
import * as cheerio from 'cheerio';
import { readFileSync } from 'fs';
import path from 'path';
import { vi } from 'vitest';

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

  it.only('should get articles from search result page', async () => {
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