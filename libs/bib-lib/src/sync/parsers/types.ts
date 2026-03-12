// PubMed XML parsing types

export interface ParsedArticle {
  pmid: bigint;
  articleTitle: string;
  language?: string;
  publicationType?: string;
  dateCompleted?: Date;
  dateRevised?: Date;
  publicationStatus?: string;

  // Journal
  journal?: ParsedJournal;

  // Authors
  authors: ParsedAuthor[];

  // Related data
  meshHeadings: ParsedMeshHeading[];
  chemicals: ParsedChemical[];
  grants: ParsedGrant[];
  articleIds: ParsedArticleId[];
}

export interface ParsedJournal {
  issn?: string;
  issnElectronic?: string;
  volume?: string;
  issue?: string;
  pubDate?: string;
  pubYear?: number;
  title?: string;
  isoAbbreviation?: string;
}

export interface ParsedAuthor {
  lastName?: string;
  foreName?: string;
  initials?: string;
}

export interface ParsedMeshHeading {
  descriptorName?: string;
  qualifierName?: string;
  ui?: string;
  majorTopicYN?: boolean;
}

export interface ParsedChemical {
  registryNumber?: string;
  nameOfSubstance?: string;
}

export interface ParsedGrant {
  grantId?: string;
  agency?: string;
  country?: string;
}

export interface ParsedArticleId {
  pubmed?: bigint;
  doi?: string;
  pii?: string;
  pmc?: string;
  otherId?: string;
  otherIdType?: string;
}

export interface SyncProgress {
  totalFiles: number;
  processedFiles: number;
  totalArticles: number;
  processedArticles: number;
  errors: number;
}

export interface SyncOptions {
  batchSize?: number;
  onProgress?: (progress: SyncProgress) => void;
}
