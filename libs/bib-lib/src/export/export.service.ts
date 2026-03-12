import { Injectable } from '@nestjs/common';
import type { SearchResult } from '../search/types.js';
import type { ExportOptions, ExportResult, ExportFormat } from './types.js';

@Injectable()
export class ExportService {
  /**
   * Export search results to specified format
   */
  export(results: SearchResult[], options: ExportOptions): ExportResult {
    switch (options.format) {
      case 'json':
        return this.toJson(results, options);
      case 'csv':
        return this.toCsv(results, options);
      case 'bibtex':
        return this.toBibtex(results, options);
      case 'markdown':
        return this.toMarkdown(results, options);
      default:
        const _exhaustive: never = options.format;
        throw new Error(`Unsupported export format: ${_exhaustive}`);
    }
  }

  /**
   * Export to JSON format
   */
  private toJson(results: SearchResult[], options: ExportOptions): ExportResult {
    const data = results.map((r) => this.flattenResult(r, options));
    return {
      content: JSON.stringify(data, null, 2),
      filename: 'export.json',
      mimeType: 'application/json',
    };
  }

  /**
   * Export to CSV format
   */
  private toCsv(results: SearchResult[], options: ExportOptions): ExportResult {
    const headers = ['PMID', 'Title', 'Journal', 'Year', 'Authors', 'DOI'];

    const rows = results.map((r) => {
      const doi = r.articleIds?.find((id) => id.doi)?.doi || '';
      const year = r.journal?.pubYear?.toString() || '';
      const authors = r.authors?.map((a) => `${a.foreName} ${a.lastName}`).join('; ') || '';
      const journal = r.journal?.isoAbbreviation || r.journal?.title || '';

      return [r.pmid.toString(), this.escapeCsv(r.articleTitle), this.escapeCsv(journal), year, this.escapeCsv(authors), doi].join(',');
    });

    const content = [headers.join(','), ...rows].join('\n');
    return {
      content,
      filename: 'export.csv',
      mimeType: 'text/csv',
    };
  }

  /**
   * Export to BibTeX format
   */
  private toBibtex(results: SearchResult[], _options: ExportOptions): ExportResult {
    const entries = results.map((r, index) => {
      const key = this.generateBibtexKey(r, index);
      const authors = r.authors?.map((a) => a.lastName).join(' and ') || '';
      const year = r.journal?.pubYear?.toString() || '????';
      const title = r.articleTitle;
      const journal = r.journal?.isoAbbreviation || r.journal?.title || '';
      const volume = r.journal?.volume || '';
      const issue = r.journal?.issue ?? '';
      const pages = '';
      const doi = r.articleIds?.find((id) => id.doi)?.doi || '';

      const fields: string[] = [];
      if (title) fields.push(`  title = {${title}}`);
      if (authors) fields.push(`  author = {${authors}}`);
      if (year && year !== '????') fields.push(`  year = {${year}}`);
      if (journal) fields.push(`  journal = {${journal}}`);
      if (volume) fields.push(`  volume = {${volume}}`);
      if (issue) fields.push(`  number = {${issue}}`);
      if (pages) fields.push(`  pages = {${pages}}`);
      if (doi) fields.push(`  doi = {${doi}}`);

      return `@article{${key},\n${fields.join(',\n')}\n}`;
    });

    return {
      content: entries.join('\n\n'),
      filename: 'export.bib',
      mimeType: 'application/x-bibtex',
    };
  }

  /**
   * Export to Markdown format
   */
  private toMarkdown(results: SearchResult[], _options: ExportOptions): ExportResult {
    const entries = results.map((r, index) => {
      const authors = r.authors?.map((a) => `${a.foreName} ${a.lastName}`).join(', ') || 'Unknown';
      const year = r.journal?.pubYear?.toString() || '????';
      const journal = r.journal?.isoAbbreviation || r.journal?.title || '';
      const volume = r.journal?.volume ? `(${r.journal.volume})` : '';
      const issue = r.journal?.issue ? `:${r.journal.issue}` : '';
      const doi = r.articleIds?.find((id) => id.doi)?.doi;

      let citation = `**${authors}** (${year}). ${r.articleTitle}. *${journal}* ${volume}${issue}.`;
      if (doi) {
        citation += ` [DOI](https://doi.org/${doi})`;
      }

      return `${index + 1}. ${citation}`;
    });

    const content = `# Bibliography Export\n\n${entries.join('\n\n')}`;
    return {
      content,
      filename: 'export.md',
      mimeType: 'text/markdown',
    };
  }

  /**
   * Flatten search result for JSON export
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private flattenResult(result: SearchResult, options: ExportOptions): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flat: Record<string, any> = {
      id: result.id,
      pmid: result.pmid.toString(),
      title: result.articleTitle,
      language: result.language,
      publicationType: result.publicationType,
    };

    if (options.includeJournal !== false && result.journal) {
      flat.journal = {
        name: result.journal.title,
        abbreviation: result.journal.isoAbbreviation,
        year: result.journal.pubYear,
        volume: result.journal.volume,
        issue: result.journal.issue,
      };
    }

    if (options.includeAuthors !== false && result.authors) {
      flat.authors = result.authors.map((a) => ({
        name: `${a.foreName} ${a.lastName}`,
        initials: a.initials,
      }));
    }

    if (options.includeMesh !== false && result.meshHeadings) {
      flat.meshHeadings = result.meshHeadings;
    }

    if (result.articleIds) {
      flat.ids = {
        doi: result.articleIds.find((id) => id.doi)?.doi,
        pii: result.articleIds.find((id) => id.pii)?.pii,
        pmc: result.articleIds.find((id) => id.pmc)?.pmc,
      };
    }

    return flat;
  }

  /**
   * Generate BibTeX key from article
   */
  private generateBibtexKey(result: SearchResult, index: number): string {
    const firstAuthor = result.authors?.[0]?.lastName?.toLowerCase() || 'unknown';
    const year = result.journal?.pubYear?.toString() || 'year';
    const titleWord = result.articleTitle.split(' ')[0]?.toLowerCase() || 'article';
    return `${firstAuthor}${year}${titleWord}${index}`.replace(/[^a-z0-9]/gi, '');
  }

  /**
   * Escape CSV value
   */
  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
