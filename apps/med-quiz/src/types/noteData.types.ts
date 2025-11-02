export interface note {
  oid: string;
  fileName: string;
  metaData: Record<string, any>;
  content: {
    timeStamp: Date;
    fileContent: string;
  }[];
  embeddings?: {
    Embeddings: number[];
    EmbeddingModal: string;
  };
}

/**
 * @deprecated
 */
export interface EmbeddedNote {
  oid: string;
  embedding: number[];
}

export interface SearchResult {
  id: string;
  title: string;
  excerpt: string;
  tags?: string[];
  lastUpdated?: Date | string | null;
}
