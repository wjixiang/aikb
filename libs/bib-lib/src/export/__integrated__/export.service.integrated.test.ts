/**
 * Integrated tests for ExportService
 * Uses real database connection
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service.js';
import { KeywordSearchService } from '../../search/keyword/keyword-search.service.js';
import { ExportService } from '../export.service.js';
import type { SearchResult } from '../../search/types.js';

describe('ExportService Integrated Tests', () => {
  let prisma: PrismaService;
  let exportService: ExportService;
  let keywordSearch: KeywordSearchService;

  beforeAll(async () => {
    prisma = new PrismaService();
    keywordSearch = new KeywordSearchService(prisma);
    exportService = new ExportService();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Export to various formats', () => {
    it('should export to JSON format', async () => {
      const searchResult = await keywordSearch.search({ query: '', limit: 5 });
      const results = searchResult.results as SearchResult[];

      if (results.length === 0) {
        console.log('Skipping JSON export test - no articles in database');
        return;
      }

      const result = exportService.export(results, { format: 'json' });
      expect(result.filename).toBe('export.json');
      expect(result.mimeType).toBe('application/json');

      const parsed = JSON.parse(result.content);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('should export to CSV format', async () => {
      const searchResult = await keywordSearch.search({ query: '', limit: 5 });
      const results = searchResult.results as SearchResult[];

      if (results.length === 0) {
        console.log('Skipping CSV export test - no articles in database');
        return;
      }

      const result = exportService.export(results, { format: 'csv' });
      expect(result.filename).toBe('export.csv');
      expect(result.mimeType).toBe('text/csv');
      expect(result.content).toContain('PMID,Title,Journal,Year,Authors,DOI');
    });

    it('should export to BibTeX format', async () => {
      const searchResult = await keywordSearch.search({ query: '', limit: 5 });
      const results = searchResult.results as SearchResult[];

      if (results.length === 0) {
        console.log('Skipping BibTeX export test - no articles in database');
        return;
      }

      const result = exportService.export(results, { format: 'bibtex' });
      expect(result.filename).toBe('export.bib');
      expect(result.mimeType).toBe('application/x-bibtex');
      expect(result.content).toContain('@article{');
    });

    it('should export to Markdown format', async () => {
      const searchResult = await keywordSearch.search({ query: '', limit: 5 });
      const results = searchResult.results as SearchResult[];

      if (results.length === 0) {
        console.log('Skipping Markdown export test - no articles in database');
        return;
      }

      const result = exportService.export(results, { format: 'markdown' });
      expect(result.filename).toBe('export.md');
      expect(result.mimeType).toBe('text/markdown');
      expect(result.content).toContain('# Bibliography Export');
    });

    it('should handle export options', async () => {
      const searchResult = await keywordSearch.search({ query: '', limit: 5 });
      const results = searchResult.results as SearchResult[];

      if (results.length === 0) {
        console.log('Skipping options test - no articles in database');
        return;
      }

      const result = exportService.export(results, {
        format: 'json',
        includeJournal: false,
        includeAuthors: false,
      });
      expect(result).toHaveProperty('content');
    });
  });
});
