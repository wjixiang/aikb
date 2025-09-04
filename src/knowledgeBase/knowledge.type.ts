
export interface EntityData {
  name: string[];
  tags: string[];
  definition: string;
}

export interface EntityDataWithId extends EntityData {
  id: string;
}

export interface PropertyData {
  name: string[];
  content: string;
}

export interface PropertyDataWithId extends PropertyData {
  id: string;
}

export interface KnowledgeData {
  scopePath: {
    entities: string[];
    scopes: string[][];
  };
  scopePathString?: string;
  content: string;
  metadata: {
    tags: string[];
    createDate: Date;
  }
}

export interface KnowledgeDataWithId extends KnowledgeData {
  id: string;
}

// Elasticsearch specific types
export interface ElasticsearchKnowledgeDocument extends KnowledgeData {
  knowledgeId: string;
  scopePathString: string;
  createdAt: string;
}

export interface ElasticsearchKnowledgeResponse {
  _index: string;
  _id: string;
  _version: number;
  _seq_no: number;
  _primary_term: number;
  found: boolean;
  _source: ElasticsearchKnowledgeDocument;
}

export interface ElasticsearchEntityDocument extends EntityData {
  nameString: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ElasticsearchEntityResponse {
  _index: string;
  _id: string;
  _version: number;
  _seq_no: number;
  _primary_term: number;
  found: boolean;
  _source: ElasticsearchEntityDocument;
}
