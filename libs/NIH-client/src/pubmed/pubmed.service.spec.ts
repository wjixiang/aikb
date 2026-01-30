import { Test, TestingModule } from '@nestjs/testing';
import { PubmedService } from '../pubmed.service';
import * as cheerio from 'cheerio';
import { fstat, readFileSync } from 'fs';
import path from 'path';

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
      sort: '',
      filter: [],
      page: null
    })
  });

  it('should build search params correctly', () => {
    const testPattern = {
      term: '(hypertension[Title]) AND (food[Text Word])',
      sort: '',
      filter: [],
      page: null
    }

    const result = service.buildUrl(testPattern)
    expect(result).toBe('?term=%28hypertension%5BTitle%5D%29+AND+%28food%5BText+Word%5D%29')
  })

  it('should get articles', async () => {
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
    expect(articles[0].pmid).toBe('35910428')
    expect(articles[0].title).toContain('Food')
    expect(articles[0].title).toContain('Hypertension')
    expect(articles[0].authors).toContain('Rusmevichientong')
    expect(articles[0].journalCitation).toContain('Int J Public')
    expect(articles[0].snippet).toContain('food choices')
  })

  it.only('load article detail page, scrape basic information', async () => {
    const spy = vi.spyOn(service, 'loadArticle').mockResolvedValue(cheerio.load(testDetailPageStr))
    const res = await service.getArticleDetail('37882686')
    expect(spy).toBeCalled()
    console.log(res)
    expect(res.doi).toBe('10.1097/CRD.0000000000000623')


  })

  it.todo('load article detail page', async () => {

  })
});

const testPubmedWebStr = readFileSync(path.join(__dirname, 'pubmedSearchResultPage.test.html'))
const testDetailPageStr = readFileSync(path.join(__dirname, 'pubmedArticleDetailPage.test.html'))