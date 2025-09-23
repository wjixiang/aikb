import Entity from "./Entity";

export interface EntityData {
  name: string[];
  tags: string[];
  definition: string;
}

export interface EntityDataWithId extends EntityData {
  id: string;
}

export interface KnowledgeData {
  // Add properties for KnowledgeData as needed
}

export interface KnowledgeDataWithId extends KnowledgeData {
  id: string;
}

export interface PropertyData {
  // Add properties for PropertyData as needed
}


/**
 * Organize format of knowledge
 */
export interface KnowledgeTree {
  root: Entity[];
  branch: KnowledgeBranch[]
}

interface KnowledgeBranch {
  scope: string;
  subScope: KnowledgeBranch[] | null;
  leaf: KnowledgeLeaf | null
}

interface KnowledgeLeaf {
  content: string;
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


