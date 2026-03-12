// Search types for the bibliometric search system

export interface SearchQuery {
  // Query text
  query: string;

  // Pagination
  limit?: number;
  offset?: number;
  cursor?: string;

  // Filters
  filters?: SearchFilters;

  // Sorting
  sort?: SearchSort;

  // Search options
  options?: SearchOptions;
}

export interface SearchFilters {
  // Author filter
  authors?: string[];

  // Journal filter
  journals?: string[];

  // Publication year range
  yearFrom?: number;
  yearTo?: number;

  // Date range
  dateFrom?: Date;
  dateTo?: Date;

  // Language
  languages?: string[];

  // Publication type
  publicationTypes?: string[];

  // MeSH terms
  meshTerms?: string[];

  // Has abstract
  hasAbstract?: boolean;

  // Has full text
  hasFullText?: boolean;
}

export type SearchSortField = 'relevance' | 'date' | 'cited' | 'title';
export type SortOrder = 'asc' | 'desc';

export interface SearchSort {
  field: SearchSortField;
  order?: SortOrder;
}

export interface SearchOptions {
  // Search mode
  mode?: 'keyword' | 'semantic' | 'hybrid';

  // Hybrid search weights
  keywordWeight?: number;
  semanticWeight?: number;

  // Semantic search parameters
  similarityThreshold?: number;

  // Provider for embeddings (semantic search)
  embeddingProvider?: string;
  embeddingModel?: string;

  // Include related data
  includeAuthors?: boolean;
  includeJournal?: boolean;
  includeMeshHeadings?: boolean;
  includeChemicals?: boolean;
  includeGrants?: boolean;
  includeArticleIds?: boolean;
}

export interface SearchResult {
  // Article data
  id: string;
  pmid: bigint;
  articleTitle: string;
  language?: string;
  publicationType?: string;
  dateCompleted?: Date;
  dateRevised?: Date;
  publicationStatus?: string;

  // Related data
  journal?: JournalInfo;
  authors?: AuthorInfo[];
  meshHeadings?: string[];
  chemicals?: string[];
  grants?: GrantInfo[];
  articleIds?: ArticleIdInfo[];

  // Search metadata
  score?: number;
  highlights?: string[];
}

export interface JournalInfo {
  id: string;
  issn?: string;
  title?: string;
  isoAbbreviation?: string;
  volume?: string;
  issue?: string;
  pubYear?: number;
}

export interface AuthorInfo {
  id: string;
  lastName?: string;
  foreName?: string;
  initials?: string;
}

export interface GrantInfo {
  id: string;
  grantId?: string;
  agency?: string;
  country?: string;
}

export interface ArticleIdInfo {
  id: string;
  doi?: string;
  pii?: string;
  pmc?: string;
}

export interface SearchResponse {
  // Results
  results: SearchResult[];

  // Pagination
  total: number;
  limit: number;
  offset: number;
  nextCursor?: string;
  hasMore: boolean;

  // Facets
  facets?: SearchFacets;

  // Metadata
  query: string;
  searchTime: number;
}

export interface SearchFacets {
  years?: FacetItem[];
  journals?: FacetItem[];
  authors?: FacetItem[];
  meshTerms?: FacetItem[];
  languages?: FacetItem[];
  publicationTypes?: FacetItem[];
}

export interface FacetItem {
  value: string;
  count: number;
}

// Keyword search specific
export interface KeywordSearchOptions extends SearchOptions {
  // Full-text search fields
  fields?: ('title' | 'abstract' | 'mesh' | 'chemical')[];

  // Boolean operators
  useBooleanOperators?: boolean;

  // Fuzzy matching
  fuzzy?: boolean;
  fuzzyDistance?: number;
}

// Semantic search specific
export interface SemanticSearchOptions extends SearchOptions {
  // Embedding configuration
  embeddingProvider: string;
  embeddingModel: string;
  dimension: number;

  // Similarity search type
  similarityType?: 'cosine' | 'euclidean' | 'dot';

  // Top N most similar
  topN?: number;
}

// Hybrid search specific
export interface HybridSearchOptions extends SearchOptions {
  keywordWeight: number;
  semanticWeight: number;

  // Reranking
  rerank?: boolean;
  rerankTopN?: number;
}

// Embedding text builder options
export interface EmbeddingTextOptions {
  includeTitle?: boolean;
  includeAbstract?: boolean;
  includeMeshHeadings?: boolean;
  includeChemicals?: boolean;

  maxLength?: number;
}
