import { describe, it, expect, beforeEach } from 'vitest';
import { ExportService } from '../export.service.js';
import type { SearchResult } from '../search/types.js';

describe('ExportService', () => {
  let exportService: ExportService;

  // Mock search results
  const mockSearchResults: SearchResult[] = [
    {
      id: 'article-1',
      pmid: BigInt(12345678),
      articleTitle: 'Test Article Title',
      language: 'eng',
      publicationType: 'Journal Article',
      journal: {
        id: 'journal-1',
        title: 'Journal of Medical Research',
        isoAbbreviation: 'J Med Res',
        pubYear: 2024,
        volume: '10',
        issue: '2',
      },
      authors: [
        { id: 'author-1', foreName: 'John', lastName: 'Smith', initials: 'JM' },
        { id: 'author-2', foreName: 'Jane', lastName: 'Doe', initials: 'JD' },
      ],
      meshHeadings: ['Neoplasms', 'Drug Therapy'],
      chemicals: ['Antineoplastic Agents'],
      grants: [{ id: 'grant-1', grantId: 'R01', agency: 'NIH', country: 'USA' }],
      articleIds: [{ id: 'id-1', doi: '10.1234/test.2024.001' }],
      score: 0.95,
    },
    {
      id: 'article-2',
      pmid: BigInt(87654321),
      articleTitle: 'Another Study on Cancer',
      language: 'eng',
      publicationType: 'Review',
      journal: {
        id: 'journal-2',
        title: 'Cancer Research',
        isoAbbreviation: 'Cancer Res',
        pubYear: 2023,
        volume: '5',
        issue: '3',
      },
      authors: [{ id: 'author-3', foreName: 'Bob', lastName: 'Johnson', initials: 'BJ' }],
      articleIds: [{ id: 'id-2', doi: '10.1234/test.2023.002', pmc: 'PMC1234567' }],
    },
  ];

  beforeEach(() => {
    exportService = new ExportService();
  });

  // ESvc-01: Export to JSON format
  describe('export - JSON format', () => {
    it('should export to JSON format', () => {
      const result = exportService.export(mockSearchResults, { format: 'json' });
      expect(result.filename).toBe('export.json');
      expect(result.mimeType).toBe('application/json');
      expect(() => JSON.parse(result.content)).not.toThrow();
    });
  });

  // ESvc-02: Export to CSV format
  describe('export - CSV format', () => {
    it('should export to CSV format', () => {
      const result = exportService.export(mockSearchResults, { format: 'csv' });
      expect(result.filename).toBe('export.csv');
      expect(result.mimeType).toBe('text/csv');
      expect(result.content).toContain('PMID,Title,Journal,Year,Authors,DOI');
    });
  });

  // ESvc-03: Export to BibTeX format
  describe('export - BibTeX format', () => {
    it('should export to BibTeX format', () => {
      const result = exportService.export(mockSearchResults, { format: 'bibtex' });
      expect(result.filename).toBe('export.bib');
      expect(result.mimeType).toBe('application/x-bibtex');
      expect(result.content).toContain('@article{');
    });
  });

  // ESvc-04: Export to Markdown format
  describe('export - Markdown format', () => {
    it('should export to Markdown format', () => {
      const result = exportService.export(mockSearchResults, { format: 'markdown' });
      expect(result.filename).toBe('export.md');
      expect(result.mimeType).toBe('text/markdown');
      expect(result.content).toContain('# Bibliography Export');
    });
  });

  // ESvc-05: Unsupported format
  describe('export - unsupported format', () => {
    it('should throw error for unsupported format', () => {
      expect(() =>
        exportService.export(mockSearchResults, { format: 'invalid' as any }),
      ).toThrow('Unsupported export format');
    });
  });

  // ESvc-09: CSV escaping - comma
  describe('toCsv - escape special chars', () => {
    it('should escape commas correctly', () => {
      const resultsWithComma: SearchResult[] = [
        {
          ...mockSearchResults[0],
          articleTitle: 'Test, Article Title',
        },
      ];
      const result = exportService.export(resultsWithComma, { format: 'csv' });
      expect(result.content).toContain('"Test, Article Title"');
    });
  });

  // ESvc-10: CSV header row
  describe('toCsv - header row', () => {
    it('should include correct headers', () => {
      const result = exportService.export(mockSearchResults, { format: 'csv' });
      const lines = result.content.split('\n');
      expect(lines[0]).toBe('PMID,Title,Journal,Year,Authors,DOI');
    });
  });

  // ESvc-11: BibTeX key generation
  describe('toBibtex - article key', () => {
    it('should generate valid BibTeX key', () => {
      const result = exportService.export(mockSearchResults, { format: 'bibtex' });
      expect(result.content).toContain('@article{smith2024test');
    });
  });

  // ESvc-12: BibTeX all fields
  describe('toBibtex - all fields', () => {
    it('should include all BibTeX fields', () => {
      const result = exportService.export(mockSearchResults, { format: 'bibtex' });
      expect(result.content).toContain('title = ');
      expect(result.content).toContain('author = ');
      expect(result.content).toContain('year = ');
      expect(result.content).toContain('journal = ');
    });
  });

  // ESvc-13: BibTeX missing fields
  describe('toBibtex - missing fields', () => {
    it('should handle missing optional fields', () => {
      const minimalResult: SearchResult[] = [
        {
          id: 'article-min',
          pmid: BigInt(11111111),
          articleTitle: 'Minimal Article',
        },
      ];
      const result = exportService.export(minimalResult, { format: 'bibtex' });
      expect(result.content).toContain('title = ');
      // When journal is missing, year is '????' and excluded, so year field won't be present
      expect(result.content).not.toContain('year = ');
    });
  });

  // ESvc-14: Markdown numbered list
  describe('toMarkdown - numbered list', () => {
    it('should create numbered list', () => {
      const result = exportService.export(mockSearchResults, { format: 'markdown' });
      expect(result.content).toContain('1. ');
      expect(result.content).toContain('2. ');
    });
  });

  // ESvc-15: Markdown DOI link
  describe('toMarkdown - DOI link', () => {
    it('should include DOI as link', () => {
      const result = exportService.export(mockSearchResults, { format: 'markdown' });
      expect(result.content).toContain('[DOI](https://doi.org/');
    });
  });

  // ESvc-19: CSV escaping - quote
  describe('escapeCsv - quote', () => {
    it('should escape quote correctly', () => {
      const resultsWithQuote: SearchResult[] = [
        {
          ...mockSearchResults[0],
          articleTitle: 'Test "Quote" Title',
        },
      ];
      const result = exportService.export(resultsWithQuote, { format: 'csv' });
      expect(result.content).toContain('"Test ""Quote"" Title"');
    });
  });

  // ESvc-20: CSV escaping - newline
  describe('escapeCsv - newline', () => {
    it('should escape newline correctly', () => {
      const resultsWithNewline: SearchResult[] = [
        {
          ...mockSearchResults[0],
          articleTitle: 'Test\nNewline Title',
        },
      ];
      const result = exportService.export(resultsWithNewline, { format: 'csv' });
      expect(result.content).toContain('"Test\nNewline Title"');
    });
  });

  // ESvc-22: BibTeX key with author
  describe('generateBibtexKey - with author', () => {
    it('should use author name in key', () => {
      const result = exportService.export(mockSearchResults, { format: 'bibtex' });
      // First article has author "Smith", year 2024, title "Test"
      // Key format: author + year + titleWord + index = smith2024test0
      expect(result.content).toMatch(/@article\{smith2024test/);
    });
  });

  // ESvc-23: BibTeX key no author
  describe('generateBibtexKey - no author', () => {
    it('should use index when no author', () => {
      const noAuthorResult: SearchResult[] = [
        {
          id: 'article-noauth',
          pmid: BigInt(99999999),
          articleTitle: 'No Author Article',
        },
      ];
      const result = exportService.export(noAuthorResult, { format: 'bibtex' });
      expect(result.content).toContain('@article{unknown');
    });
  });
});
