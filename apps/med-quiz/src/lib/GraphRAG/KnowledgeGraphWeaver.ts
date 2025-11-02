import { v4 as uuidv4 } from "uuid";

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { connectToDatabase } from "../db/mongodb";
import LLMNer, { entity, relation } from "./LLMNer";
import { JanusGraphClient, JanusGraphConfig } from "./janusGraphClient";
import { entity_types } from "./prompt/prompt";
import milvusCollectionOperator, {
  MilvusDocument,
} from "../milvus/milvusCollectionOperator";
import {
  embeddingInstance,
  embeddings,
  getEmbeddings,
} from "../langchain/provider";

export interface KnowledgeGraphWeaverConfig {
  chunkThreshold: number;
  chunkOverlap: number;
  debug?: boolean;
  janusGraphConfig: JanusGraphConfig;
  extract_llm_modal_name: string;
  embeddingInstance: embeddingInstance;
  language: string;
  tuple_delimiter: string;
  record_delimiter: string;
  completion_delimiter: string;
  parallelLimit: number;
  milvusCollectionName: string;
  milvusBatchSize?: number;
  milvusMaxLength?: number;
}

export const defaultKnowledgeGraphWeaverConfig: KnowledgeGraphWeaverConfig = {
  chunkThreshold: 1000, // Example value
  chunkOverlap: 200, // Example value
  debug: true,
  janusGraphConfig: {
    host: "localhost", // Example host
    port: 8182, // Example port - assuming default JanusGraph port
    // Add other JanusGraph config properties as needed
    // Add other JanusGraph config properties as needed
  },
  extract_llm_modal_name: "glm-4-flash", // Example value
  language: "Chinese", // Example value
  tuple_delimiter: "|", // Example value
  record_delimiter: "---", // Example value
  completion_delimiter: "DONE", // Example value
  parallelLimit: 5,
  embeddingInstance: getEmbeddings()("text-embedding-3-large"), // Example value
  milvusCollectionName: "knowledge_graph_chunks", // Example value
};

export interface ReferenceDocument {
  id: string;
  title: string;
  content: string;
  add_date: Date;
}

export interface ReferenceChunk {
  id: string;
  referenceId: string; // Add referenceId here
  content: string;
  add_date: Date;
}

/**
 * KnowledgeGraphWeaver class for:
 * 1. generating knowledge graphs from reference documents.
 * 2. handle graph query to retrieve data.
 */
export default class KnowledgeGraphWeaver {
  private config: KnowledgeGraphWeaverConfig;
  private debug: boolean;
  private janusGraphClient: JanusGraphClient;
  private milvusOperator: milvusCollectionOperator;

  constructor(config: KnowledgeGraphWeaverConfig) {
    this.config = config;
    this.debug = config.debug || false;
    this.janusGraphClient = new JanusGraphClient(config.janusGraphConfig);
    this.milvusOperator = new milvusCollectionOperator(
      this.config.milvusCollectionName,
    );
    // Note: LLMNer instance is created within extract_entities_and_relations
    // to ensure it uses the latest config including parallelLimit.
  }

  private log = (message: string, ...args: any[]) => {
    if (this.debug) {
      console.log(`[KnowledgeGraphWeaver] ${message}`, ...args);
    }
  };

  generate_knowledge_graph = async (doc: Omit<ReferenceDocument, "id">) => {
    const id = uuidv4();
    const newDoc: ReferenceDocument = { ...doc, id };
    this.log("Generating knowledge graph from reference document:", newDoc.id);
    try {
      await this.save_reference_document_to_mongodb(newDoc);
      const chunks = await this.chunk_spliter(newDoc.content, newDoc.id); // Pass doc.id
      await this.chunk_embedding(chunks);
      const extractedResults =
        await this.extract_entities_and_relations(chunks);
      const allEntities = extractedResults.flatMap((result) => result.entities);
      await this.preliminaryEntityCleaning();
      await this.synchronizeToJanusGraph();
      this.log(
        "Knowledge graph generation completed successfully for document:",
        newDoc.id,
      );
    } catch (error) {
      this.log(
        "Error generating knowledge graph for document:",
        newDoc.id,
        error,
      );
      // TODO: Implement cleanup or retry logic if necessary
      throw error; // Re-throw the error after logging
    }
  };

  save_reference_document_to_mongodb = async (doc: ReferenceDocument) => {
    this.log("Saving reference document to MongoDB:", doc.id);
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection("reference_documents");
      await collection.insertOne(doc);
      this.log("Reference document saved:", doc.id);
    } catch (error) {
      this.log("Error saving reference document to MongoDB:", doc.id, error);
      throw error;
    }
  };

  save_reference_chunk_to_mongodb = async (chunks: ReferenceChunk[]) => {
    this.log(`Saving ${chunks.length} reference chunks to MongoDB`);
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection("reference_chunks");
      await collection.insertMany(chunks);
      this.log(`${chunks.length} reference chunks saved.`);
    } catch (error) {
      this.log("Error saving reference chunks to MongoDB:", error);
      throw error;
    }
  };

  chunk_spliter = async (
    rawText: string,
    documentId: string,
  ): Promise<ReferenceChunk[]> => {
    this.log("Starting chunk splitting process.");
    try {
      this.log("Raw text length:", rawText.length);
      this.log("Chunk threshold:", this.config.chunkThreshold);

      if (rawText.length > this.config.chunkThreshold) {
        this.log("Text length exceeds threshold, splitting into chunks.");
        const splitter = new RecursiveCharacterTextSplitter({
          chunkSize: this.config.chunkThreshold,
          chunkOverlap: this.config.chunkOverlap,
          separators: ["\n\n", "\n", "。", "！", "？", "，", "、", ""], // Add Chinese separators
        });
        const chunks = await splitter.splitText(rawText);
        this.log(`Split into ${chunks.length} chunks.`);
        const referenceChunks: ReferenceChunk[] = chunks.map(
          (chunk, index) => ({
            id: `${documentId}-${index}`, // Simple ID generation using documentId
            referenceId: documentId, // Add referenceId
            content: chunk,
            add_date: new Date(),
          }),
        );
        await this.save_reference_chunk_to_mongodb(referenceChunks);
        this.log("Finished chunk splitting and saving.");
        return referenceChunks;
      } else {
        this.log("Text length within threshold, saving as a single chunk.");
        const referenceChunks: ReferenceChunk[] = [
          {
            id: `${documentId}-0`, // Simple ID generation using documentId
            referenceId: documentId, // Add referenceId
            content: rawText,
            add_date: new Date(),
          },
        ];
        await this.save_reference_chunk_to_mongodb(referenceChunks);
        this.log("Finished saving single chunk.");
        return referenceChunks;
      }
    } catch (error) {
      this.log("Error during chunk splitting:", error);
      throw error;
    }
  };

  extract_entities_and_relations = async (chunks: ReferenceChunk[]) => {
    this.log(
      `Extracting entities and relations from ${chunks.length} chunks with parallel limit ${this.config.parallelLimit}.`,
    );
    const ner = new LLMNer({
      JanusGraphConfig: this.config.janusGraphConfig,
      extract_llm_modal_name: this.config.extract_llm_modal_name,
      language: this.config.language,
      tuple_delimiter: this.config.tuple_delimiter,
      record_delimiter: this.config.record_delimiter,
      completion_delimiter: this.config.completion_delimiter,
      debug: false,
    });

    // Use a helper function for concurrency control
    const processChunk = async (chunk: ReferenceChunk) => {
      this.log(`Processing chunk: ${chunk.id}`);
      try {
        const result = await ner.extract_entities(chunk, entity_types); // Pass the entire chunk object
        this.log(`Finished processing chunk: ${chunk.id}`);
        return result;
      } catch (error) {
        this.log(`Error processing chunk ${chunk.id}:`, error);
        // Depending on requirements, you might want to re-throw or return an error indicator
        return { entities: [], relationships: [], keywords: [], error: error };
      }
    };

    // Process chunks with concurrency limit
    const results = await this.runWithConcurrencyLimit(
      chunks,
      processChunk,
      this.config.parallelLimit,
    );

    this.log("Finished extracting entities and relations from all chunks.");
    // You might want to aggregate results here if needed, but LLMNer already caches to MongoDB
    return results;
  };

  // Helper function to run promises with a concurrency limit
  private runWithConcurrencyLimit = async <T, U>(
    items: T[],
    fn: (item: T) => Promise<U>,
    limit: number,
  ): Promise<U[]> => {
    const results: Promise<U>[] = [];
    const executing: Promise<void>[] = [];

    for (const item of items) {
      const p = Promise.resolve().then(() => fn(item));
      results.push(p); // Store the promise

      const e = p.then(() => {
        executing.splice(executing.indexOf(e), 1);
      });
      executing.push(e);

      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }

    return Promise.all(results);
  };

  preliminaryEntityCleaning = async (): Promise<void> => {
    this.log("Starting preliminary entity cleaning and database update.");
    try {
      const { db } = await connectToDatabase();
      const entitiesCollection = db.collection<entity>("Entities");

      // Read all entities from the collection
      const entities = await entitiesCollection.find({}).toArray();
      this.log(`Read ${entities.length} entities from database.`);

      const mergedEntitiesMap: { [name: string]: entity & { _id?: any } } = {};
      const entitiesToDelete: any[] = [];

      for (const entity of entities) {
        this.log(`Processing entity: ${entity.name} (ID: ${entity._id})`);
        if (mergedEntitiesMap[entity.name]) {
          this.log(
            `Merging entity "${entity.name}" (ID: ${entity._id}) into existing entity (ID: ${mergedEntitiesMap[entity.name]._id}).`,
          );
          // Merge properties into the existing entity in the map
          const existingEntity = mergedEntitiesMap[entity.name];
          const initialReferenceIds = [...existingEntity.referenceId];
          const initialAliases = [...existingEntity.alias];

          existingEntity.referenceId = [
            ...new Set([...existingEntity.referenceId, ...entity.referenceId]),
          ];
          existingEntity.alias = [
            ...new Set([...existingEntity.alias, ...entity.alias]),
          ];

          // Prioritize non-empty type and description from the current entity
          if (entity.type && !existingEntity.type) {
            this.log(
              `Updating type for "${entity.name}" from "${existingEntity.type}" to "${entity.type}".`,
            );
            existingEntity.type = entity.type;
          }
          if (entity.description && !existingEntity.description) {
            this.log(
              `Updating description for "${entity.name}" from "${existingEntity.description}" to "${entity.description}".`,
            );
            existingEntity.description = entity.description;
          }

          this.log(
            `Merged "${entity.name}": referenceId updated from [${initialReferenceIds.join(", ")}] to [${existingEntity.referenceId.join(", ")}], alias updated from [${initialAliases.join(", ")}] to [${existingEntity.alias.join(", ")}].`,
          );

          // Add the current entity's _id to the list for deletion
          if (entity._id) {
            entitiesToDelete.push(entity._id);
            this.log(
              `Marking entity "${entity.name}" (ID: ${entity._id}) for deletion.`,
            );
          }
        } else {
          // Add new entity to map, including its _id
          this.log(
            `Adding new entity to map: "${entity.name}" (ID: ${entity._id}).`,
          );
          mergedEntitiesMap[entity.name] = { ...entity };
        }
      }

      const mergedEntities = Object.values(mergedEntitiesMap);

      // Perform bulk updates for merged entities
      const bulkOperations = mergedEntities.map((entity) => ({
        updateOne: {
          filter: { _id: entity._id },
          update: {
            $set: {
              referenceId: entity.referenceId,
              alias: entity.alias,
              type: entity.type,
              description: entity.description,
            },
          },
        },
      }));

      if (bulkOperations.length > 0) {
        this.log(
          `Performing bulk update for ${bulkOperations.length} merged entities.`,
        );
        await entitiesCollection.bulkWrite(bulkOperations);
        this.log("Bulk update completed.");
      } else {
        this.log("No entities to update.");
      }

      // Perform bulk delete for entities that were merged
      if (entitiesToDelete.length > 0) {
        this.log(`Deleting ${entitiesToDelete.length} merged entities.`);
        await entitiesCollection.deleteMany({ _id: { $in: entitiesToDelete } });
        this.log("Bulk deletion completed.");
      } else {
        this.log("No entities to delete.");
      }

      this.log(
        `Finished preliminary entity cleaning and database update. Merged ${entities.length} entities into ${mergedEntities.length}.`,
      );
    } catch (error) {
      this.log("Error during preliminary entity cleaning:", error);
      throw error;
    }
  };

  /**
   * Synchronizes entities and relationships from MongoDB to JanusGraph.
   */
  synchronizeToJanusGraph = async (): Promise<void> => {
    this.log("Starting synchronization to JanusGraph.");
    try {
      const { db } = await connectToDatabase();
      const entitiesCollection = db.collection<entity>("Entities");
      const relationshipsCollection = db.collection<relation>("Relationships"); // Assuming a 'Relationships' collection

      // Fetch entities and relationships from MongoDB
      const entities = await entitiesCollection.find({}).toArray();
      const relationships = await relationshipsCollection.find({}).toArray(); // Fetch relationships

      this.log(
        `Fetched ${entities.length} entities and ${relationships.length} relationships from MongoDB.`,
      );
      // Log first few relationships to inspect structure
      if (relationships.length > 0) {
        this.log(
          "First few relationships fetched:",
          JSON.stringify(relationships.slice(0, 3), null, 2),
        );
      }

      // Synchronize entities (vertices) to JanusGraph
      // Map to store JanusGraph vertex IDs keyed by entity name for efficient edge creation
      const entityNameToVertexIdMap: Map<string, string | number> = new Map();

      for (const entity of entities) {
        try {
          // Attempt to find the vertex by name
          // Ensure the name property is properly escaped for the Gremlin query
          const escapedName = entity.name.replace(/'/g, "\\'");
          const foundVertices = await this.janusGraphClient.execute(
            `g.V().has('name', '${escapedName}')`,
          );
          let vertex: any = null; // Use 'any' for now, refine if vertex structure is known

          if (foundVertices && foundVertices.length > 0) {
            vertex = foundVertices[0]; // Get the actual vertex object
            if (vertex && vertex.id) {
              this.log(
                `Found existing vertex for entity "${entity.name}" (ID: ${vertex.id}).`,
              );
              entityNameToVertexIdMap.set(entity.name, vertex.id);
              // Optionally update existing vertex properties here if needed
              // await this.janusGraphClient.updateVertex(vertex.id, { ... });
            } else {
              this.log(
                `Found vertex for entity "${entity.name}" but it lacks an ID. Result:`,
                vertex,
              );
            }
          } else {
            // Create a new vertex if not found
            const vertexProperties: Record<string, any> = {
              name: entity.name, // Use original name for property
            };
            if (entity.description) {
              vertexProperties.description = entity.description;
            }
            // Serialize arrays to JSON strings if they exist and are not empty
            if (
              entity.alias &&
              Array.isArray(entity.alias) &&
              entity.alias.length > 0
            ) {
              vertexProperties.alias = JSON.stringify(entity.alias);
            }
            if (
              entity.referenceId &&
              Array.isArray(entity.referenceId) &&
              entity.referenceId.length > 0
            ) {
              vertexProperties.referenceId = JSON.stringify(entity.referenceId);
            }

            const newVertex = await this.janusGraphClient.createVertex(
              entity.type || "entity",
              vertexProperties,
            );
            if (newVertex && newVertex.id) {
              this.log(
                `Created new vertex for entity "${entity.name}" (ID: ${newVertex.id}).`,
              );
              entityNameToVertexIdMap.set(entity.name, newVertex.id);
            } else {
              this.log(
                `Attempted to create vertex for "${entity.name}" but failed or did not receive ID. Result:`,
                newVertex,
              );
            }
          }
        } catch (error) {
          this.log(
            `Error synchronizing entity "${entity.name}" to JanusGraph:`,
            error,
          );
        }
      }

      this.log(
        `Finished processing entities. ${entityNameToVertexIdMap.size} vertices mapped.`,
      );

      // Synchronize relationships (edges) to JanusGraph
      for (const relationship of relationships) {
        try {
          // Log the relationship object being processed
          this.log(`Processing relationship: ${JSON.stringify(relationship)}`);

          // Use entity1 and entity2 from the MongoDB relationship object
          const sourceName = relationship.entity1;
          const targetName = relationship.entity2;

          // Log names being used for lookup
          this.log(
            `Looking up IDs for source: "${sourceName}", target: "${targetName}", type: "${relationship.type.join(",")}"`,
          );

          const sourceVertexId = entityNameToVertexIdMap.get(sourceName);
          const targetVertexId = entityNameToVertexIdMap.get(targetName);

          // Log lookup results
          this.log(
            `Found IDs - Source: ${sourceVertexId}, Target: ${targetVertexId}`,
          );

          if (sourceVertexId && targetVertexId) {
            // Ensure IDs are treated correctly (might be numbers)
            // const sourceIdQueryParam = typeof sourceVertexId === 'string' ? `'${sourceVertexId}'` : sourceVertexId;
            // const targetIdQueryParam = typeof targetVertexId === 'string' ? `'${targetVertexId}'` : targetVertexId;

            const edgeProperties: Record<string, any> = {};
            if (relationship.description) {
              edgeProperties.description = relationship.description;
            }
            // Serialize arrays to JSON strings if they exist and are not empty
            if (
              relationship.referenceId &&
              Array.isArray(relationship.referenceId) &&
              relationship.referenceId.length > 0
            ) {
              edgeProperties.referenceId = JSON.stringify(
                relationship.referenceId,
              );
            }

            const newEdge = await this.janusGraphClient.createEdge(
              sourceName,
              targetName,
              relationship.type.join(","), // Use variable
              edgeProperties,
            );
            if (newEdge && newEdge.id) {
              this.log(
                `Synchronized relationship "${sourceName}" -> "${targetName}" (${relationship.type.join(",")}) (Edge ID: ${newEdge.id}) to JanusGraph.`,
              );
            } else {
              this.log(
                `Attempted to create edge "${sourceName}" -> "${targetName}" but failed or did not receive ID. Result:`,
                newEdge,
              );
            }
          } else {
            // Use variables in log message
            this.log(
              `Skipping relationship synchronization due to missing mapped vertex IDs: "${sourceName}" (ID: ${sourceVertexId}) -> "${targetName}" (ID: ${targetVertexId}) (${relationship.type.join(",")}).`,
            );
          }
        } catch (error) {
          // Use variables in log message
          this.log(
            `Error synchronizing relationship "${relationship.entity1}" -> "${relationship.entity2}" (${relationship.type}) to JanusGraph:`,
            error,
          ); // Keep original fields here for error context
        }
      }

      this.log("Finished synchronization to JanusGraph.");

      // Clear processed entities and relationships from MongoDB
      this.log("Clearing processed entities and relationships from MongoDB.");
      await entitiesCollection.deleteMany({});
      await relationshipsCollection.deleteMany({});
      this.log("Successfully cleared processed entities and relationships.");
    } catch (error) {
      this.log("Error during synchronization to JanusGraph:", error);
      throw error;
    }
  };

  /**
   * Embeds chunks of data into Milvus.
   * @param chunks data chunks to be embedded
   */
  chunk_embedding = async (chunks: ReferenceChunk[]) => {
    this.log("Starting chunk embedding process.");
    this.log("Number of chunks to embed:", chunks.length);

    const milvusDocuments: MilvusDocument[] = chunks.map((chunk) => ({
      oid: chunk.id, // Use chunk id as oid
      title: chunk.id, // Use chunk id as title
      content: chunk.content,
      partition_key: chunk.referenceId, // Use referenceId as partition key
      // Add other fields if necessary, e.g., tags, alias
    }));

    try {
      await this.milvusOperator.batchInsertDocuments(milvusDocuments, {
        batchSize: this.config.milvusBatchSize,
        maxLength: this.config.milvusMaxLength,
      });
      this.log("Finished chunk embedding process and inserted into Milvus.");
    } catch (error) {
      this.log("Error during chunk embedding and insertion:", error);
      throw error; // Re-throw the error to be handled by the caller
    }
  };
}
