// Simple DTOs without class-validator dependency

export enum SearchMode {
  KEYWORD = 'keyword',
  SEMANTIC = 'semantic',
  HYBRID = 'hybrid',
}

export enum SimilarityType {
  COSINE = 'cosine',
  EUCLIDEAN = 'euclidean',
  DOT = 'dot',
}

export interface SearchQueryParams {
  query: string;
  limit?: number;
  offset?: number;
  mode?: SearchMode;
  authors?: string[];
  journals?: string[];
  yearFrom?: number;
  yearTo?: number;
  dateFrom?: string;
  dateTo?: string;
  languages?: string[];
  publicationTypes?: string[];
  meshTerms?: string[];
  similarityType?: SimilarityType;
  embeddingProvider?: string;
  embeddingModel?: string;
  keywordWeight?: number;
  semanticWeight?: number;
  rerank?: boolean;
}

export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
  BIBTEX = 'bibtex',
  MARKDOWN = 'markdown',
}

export interface ExportQueryParams {
  format: ExportFormat;
  query?: string;
  limit?: number;
  includeAbstract?: boolean;
  includeMesh?: boolean;
  includeAuthors?: boolean;
  includeJournal?: boolean;
}
