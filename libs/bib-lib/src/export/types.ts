// Export types for bibliography data

import type { SearchResult } from '../search/types.js';

export type ExportFormat = 'json' | 'csv' | 'bibtex' | 'markdown';

export interface ExportOptions {
  format: ExportFormat;
  includeAbstract?: boolean;
  includeMesh?: boolean;
  includeAuthors?: boolean;
  includeJournal?: boolean;
}

export interface ExportResult {
  content: string;
  filename: string;
  mimeType: string;
}
