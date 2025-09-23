import Entity from './Entity';

export interface EntityData {
  name: string[];
  tags: string[];
  definition: string;
}

export interface EntityDataWithId extends EntityData {
  id: string;
}

export interface KnowledgeData {
  scope: string;
  content: string;
  childKnowledgeId: string[];
}

export interface KnowledgeDataWithId extends KnowledgeData {
  id: string;
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
