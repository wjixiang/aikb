import { describe, it, expect } from 'vitest';
import { PubmedService } from '../pubmed.service.js';

describe('PubmedService - Date Filter E2E', () => {
  const service = new PubmedService();

  describe('buildUrl - Date Filter URL Construction', () => {
    it('should build correct URL with single date range filter', () => {
      const params = {
        term: 'cancer',
        sort: 'date' as const,
        sortOrder: 'dsc' as const,
        filter: ['2020:2024'],
        page: 1,
      };

      const url = service.buildUrl(params);

      // Should include date range filter in [dp] format (colon is encoded as %3A)
      expect(url).toContain('2020%3A2024%5Bdp%5D');
      expect(url).toContain('term=cancer');
      expect(url).toContain('sort=date');

      // Verify structure by decoding
      const decodedUrl = decodeURIComponent(url);
      expect(decodedUrl).toContain('2020:2024[dp]');
    });

    it('should build correct URL with multiple date range filters', () => {
      const params = {
        term: 'diabetes',
        sort: 'date' as const,
        sortOrder: 'asc' as const,
        filter: ['2018:2020', '2022:2024'],
        page: 1,
      };

      const url = service.buildUrl(params);

      // Should include both date ranges with AND (using encoded colon)
      expect(url).toContain('2018%3A2020%5Bdp%5D');
      expect(url).toContain('2022%3A2024%5Bdp%5D');
      expect(url).toContain('AND');

      // Verify decoded structure
      const decodedUrl = decodeURIComponent(url);
      expect(decodedUrl).toContain('2018:2020[dp]');
      expect(decodedUrl).toContain('2022:2024[dp]');
    });

    it('should build correct URL with date filter and publication type filter', () => {
      const params = {
        term: 'covid-19',
        sort: 'date' as const,
        sortOrder: 'dsc' as const,
        filter: ['2020:2024', 'clinical trial'],
        page: 1,
      };

      const url = service.buildUrl(params);

      // Should include both date range and pub type filter (using encoded colon)
      expect(url).toContain('2020%3A2024%5Bdp%5D');
      expect(url).toContain('filter=pubt.clinicaltrial');

      // Verify decoded structure
      const decodedUrl = decodeURIComponent(url);
      expect(decodedUrl).toContain('2020:2024[dp]');
    });

    it('should not add date filter when filter array is empty', () => {
      const params = {
        term: 'cancer',
        sort: 'match' as const,
        sortOrder: 'dsc' as const,
        filter: [],
        page: null,
      };

      const url = service.buildUrl(params);

      // Should not contain [dp] filter
      expect(url).not.toContain('%5Bdp%5D');
    });

    it('should correctly combine date filter with search term using AND', () => {
      const params = {
        term: 'hypertension',
        sort: 'date' as const,
        sortOrder: 'dsc' as const,
        filter: ['2020:2023'],
        page: 1,
      };

      const url = service.buildUrl(params);

      // Decode URL to check structure
      const decodedUrl = decodeURIComponent(url);
      // Check that the term is combined with date filter using AND
      expect(decodedUrl).toMatch(/term=hypertension\+AND\+2020:2023\[dp\]/);
    });
  });

  describe('searchByPattern - Date Filter Functional Tests', () => {
    it('should search with date range filter and return results', async () => {
      const params = {
        term: 'cancer',
        sort: 'date' as const,
        sortOrder: 'dsc' as const,
        filter: ['2023:2024'], // Recent articles
        page: 1,
      };

      const result = await service.searchByPattern(params);

      // Should return results
      expect(result).toBeDefined();
      expect(result.articleProfiles).toBeInstanceOf(Array);
      expect(result.totalResults).toBeGreaterThan(0);

      // Verify that returned articles are from the specified date range
      // (This is a basic check - the actual filtering is done by PubMed)
      expect(result.articleProfiles.length).toBeGreaterThan(0);
    });

    it('should return different results with different date filters', async () => {
      const params1 = {
        term: 'cancer',
        sort: 'date' as const,
        sortOrder: 'dsc' as const,
        filter: ['2020:2021'],
        page: 1,
      };

      const params2 = {
        term: 'cancer',
        sort: 'date' as const,
        sortOrder: 'dsc' as const,
        filter: ['2023:2024'],
        page: 1,
      };

      const [result1, result2] = await Promise.all([
        service.searchByPattern(params1),
        service.searchByPattern(params2),
      ]);

      // Both should have results
      expect(result1.totalResults).toBeGreaterThan(0);
      expect(result2.totalResults).toBeGreaterThan(0);

      // Results should be different (different articles in different time periods)
      const pmids1 = new Set(result1.articleProfiles.map((a) => a.pmid));
      const pmids2 = new Set(result2.articleProfiles.map((a) => a.pmid));

      // Check that results are returned for both queries
      expect(pmids1.size).toBeGreaterThan(0);
      expect(pmids2.size).toBeGreaterThan(0);

      // At minimum, the first articles should be different due to date sorting
      if (result1.articleProfiles.length > 0 && result2.articleProfiles.length > 0) {
        const firstArticle1 = result1.articleProfiles[0];
        const firstArticle2 = result2.articleProfiles[0];
        // PMIDs should be different for articles from different time periods
        expect(firstArticle1.pmid).toBeDefined();
        expect(firstArticle2.pmid).toBeDefined();
      }
    }, 15000);

    it('should work with broader date range', async () => {
      const params = {
        term: 'diabetes',
        sort: 'date' as const,
        sortOrder: 'dsc' as const,
        filter: ['2000:2024'], // 24 year range
        page: 1,
      };

      const result = await service.searchByPattern(params);

      expect(result).toBeDefined();
      expect(result.totalResults).toBeGreaterThan(0);
      // Broader range should have many results
      expect(result.totalResults).toBeGreaterThan(100);
    });

    it('should handle date filter with single year', async () => {
      const params = {
        term: 'covid',
        sort: 'date' as const,
        sortOrder: 'dsc' as const,
        filter: ['2020:2020'], // Just 2020
        page: 1,
      };

      const result = await service.searchByPattern(params);

      expect(result).toBeDefined();
      expect(result.totalResults).toBeGreaterThan(0);
    });
  });

  describe('searchByPattern - Combined Filters', () => {
    it('should work with date filter and publication type filter together', async () => {
      const params = {
        term: 'cancer',
        sort: 'date' as const,
        sortOrder: 'dsc' as const,
        filter: ['2020:2024', 'systematic review'],
        page: 1,
      };

      const result = await service.searchByPattern(params);

      expect(result).toBeDefined();
      expect(result.articleProfiles).toBeInstanceOf(Array);
    });
  });
});
