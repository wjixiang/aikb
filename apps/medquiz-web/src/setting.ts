import { KnowledgeGraphRetrieverConfig } from './kgrag/core/KnowledgeGraphRetriever';

// export const KnowledgeGraphWeaver_config:KnowledgeGraphWeaverConfig = {
//     chunkTableName: 'test_chunks',
//     embeddingConcurrencyLimit: 10,
//     relation_table_name: 'relation',
//     reference_table_name: 'references',
//     entity_table_name: "nodes",
//     SemanticChunkingConfig: {
//         similarityThreshold: 0.35,
//         maxTokenSize: 300,

//     },
//     property_table_name: "property", // Added property_table_name
//     semantic_search_threshold: 0.33 // Added semantic_search_threshold
// };

export const KnowledgeGraphRetriever_Config: KnowledgeGraphRetrieverConfig = {
  chunkTableName: 'test_chunks',
  property_table_name: 'property',
  entity_table_name: 'nodes',
  semantic_search_threshold: 0.33,
  language: 'zh',
};
