/**
 * Article import DTO for single record import via API
 */

export interface ImportAuthorDto {
  lastName?: string;
  foreName?: string;
  initials?: string;
}

export interface ImportJournalDto {
  title?: string;
  isoAbbreviation?: string;
  issn?: string;
  volume?: string;
  issue?: string;
  pubDate?: string;
  pubYear?: number;
}

export interface ImportMeshHeadingDto {
  descriptorName?: string;
  qualifierName?: string;
  majorTopicYN?: boolean;
}

export interface ImportArticleDto {
  title: string;
  abstract?: string;
  doi?: string;
  pmid?: string;
  pmc?: string;
  pii?: string;
  authors?: ImportAuthorDto[];
  journal?: ImportJournalDto;
  publicationDate?: string;
  keywords?: string[];
  meshHeadings?: ImportMeshHeadingDto[];
  language?: string;
  publicationType?: string;
}

export interface ImportArticleOptions {
  embed?: boolean;           // Whether to generate embedding (default: true)
  embeddingProvider?: string; // Embedding provider (e.g., 'openai', 'alibaba')
  embeddingModel?: string;    // Embedding model name
  textField?: 'title' | 'titleAndAbstract' | 'titleAndMesh'; // Text field to embed
}

export interface ImportArticleResult {
  success: boolean;
  articleId: string;
  pmid?: bigint;
  doi?: string;
  embedded: boolean;
  error?: string;
}
