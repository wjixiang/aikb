import { note } from '@/types/noteData.types';
import milvusCollectionOperator from '../milvus/milvusCollectionOperator';
import { connectToDatabase } from './mongodb';
import { Neo4jManager } from './neo4jManager';
import { embeddings } from '../langchain/provider';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Status codes for database synchronization operations
 */
export enum SyncStatus {
  /** All databases synchronized successfully */
  FULL_SYNC = 0,
  /** Note already existed in MongoDB but was missing in some databases */
  PARTIAL_SYNC = 1,
  /** Note already existed in all databases */
  ALREADY_EXISTS = 2,
  /** Failed to sync to one or more databases */
  SYNC_FAILED = 3,
  /** New note created successfully */
  CREATED = 4,
}

/**
 * Result object returned by sync operations
 */
export interface SyncResult {
  /** Sync status code */
  status: SyncStatus;
  /** Detailed status message */
  message: string;
  /** MongoDB insert result (if applicable) */
  mongoResult?: any;
  /** IDs of created records */
  recordIds?: {
    mongoId?: string;
    milvusId?: string;
    neo4jId?: string;
    oid?: string;
  };
}

/**
 * 管理知识数据库，将MongoDB、Milvus 和 Neo4j抽象为一个统一的数据库以为GraphRAG提供基础数据支持
 * 实现 MongoDB、Milvus 和 Neo4j 之间的耦合,管理所有对mongoDB/milvus/Neo4j进行的增加/删除/修改操作,以实现多数据库间的实时同步
 */
export default class KDBManager {
  mongodbNoteCollectionName: string;
  milvusNoteCollectionName: string;
  milvusCollectionOperator: milvusCollectionOperator;
  neo4jManager: Neo4jManager;

  constructor() {
    if (
      !process.env.NEO4J_URI ||
      !process.env.NEO4J_USERNAME ||
      !process.env.NEO4J_PASSWORD
    ) {
      throw new Error('Missing Neo4j environment variables');
    }

    this.mongodbNoteCollectionName = 'note';
    this.milvusNoteCollectionName = 'note';

    // Initialize Milvus operator with full embedding instance
    this.milvusCollectionOperator = new milvusCollectionOperator(
      this.milvusNoteCollectionName,
    );

    // Initialize Neo4j manager
    this.neo4jManager = new Neo4jManager(
      process.env.NEO4J_URI,
      process.env.NEO4J_USERNAME,
      process.env.NEO4J_PASSWORD,
    );
  }

  /**
   * 初始化所有属性，建立所有需要的数据库连接
   */
  async init() {
    // Initialize MongoDB collection
  }

  /**
   * 向知识库添加1个新笔记
   * 工作流程：传入笔记数据-->查验当前mongodb中是否存在-->向mongodb插入数据-->嵌入并同步数据至milvus-->同步并更新neo4j的节点及关系
   * @param note new note prepare to sync
   *
   */
  /**
   * Adds a new note to the knowledge database with full synchronization
   * @param note - The note to add
   * @returns Promise<SyncResult> - The synchronization result with status and details
   */
  async addNote(note: note): Promise<SyncResult> {
    const { db } = await connectToDatabase();
    const mongodbNoteCollection = db.collection<note>(
      this.mongodbNoteCollectionName,
    );
    const result: SyncResult = {
      status: SyncStatus.CREATED,
      message: '',
      recordIds: {},
    };

    // Check if note exists in MongoDB
    const existingNote = await mongodbNoteCollection.findOne({ oid: note.oid });
    if (existingNote) {
      result.status = SyncStatus.ALREADY_EXISTS;
      result.message = `Note with oid ${note.oid} already exists in MongoDB`;

      // Check Neo4j
      try {
        const neo4jNodes = await this.neo4jManager.findNodes('Note', {
          oid: note.oid,
        });
        if (neo4jNodes.length === 0) {
          await this.syncToNeo4j(note);
          result.status = SyncStatus.PARTIAL_SYNC;
          result.message += ' but was missing in Neo4j - now synced';
        }
      } catch (error) {
        result.status = SyncStatus.SYNC_FAILED;
        result.message += ` | Neo4j sync failed: ${error instanceof Error ? error.message : String(error)}`;
      }

      // Check Milvus
      try {
        const milvusDoc = await this.milvusCollectionOperator.getDocumentByOid(
          note.oid,
        );
        if (!milvusDoc) {
          await this.syncToMilvus(note);
          result.status =
            result.status === SyncStatus.ALREADY_EXISTS
              ? SyncStatus.PARTIAL_SYNC
              : result.status;
          result.message += result.message.includes('missing')
            ? ' and Milvus - now synced'
            : ' but was missing in Milvus - now synced';
        }
      } catch (error) {
        result.status = SyncStatus.SYNC_FAILED;
        result.message += ` | Milvus sync failed: ${error}`;
      }

      return result;
    }

    // Insert to MongoDB
    const insertResult = await mongodbNoteCollection.insertOne(note);
    if (!insertResult.acknowledged) {
      throw new Error('Failed to insert note to MongoDB');
    }
    result.recordIds!.mongoId = insertResult.insertedId.toString();

    try {
      // Sync to Milvus
      await this.syncToMilvus(note);

      // Sync to Neo4j
      const neo4jId = await this.syncToNeo4j(note);
      result.recordIds!.neo4jId = neo4jId;

      result.status = SyncStatus.FULL_SYNC;
      result.message = 'Successfully synced to all databases';
      return result;
    } catch (error) {
      // Rollback MongoDB insertion if other operations fail
      await mongodbNoteCollection.deleteOne({ _id: insertResult.insertedId });
      result.status = SyncStatus.SYNC_FAILED;
      result.message = `Failed to sync: ${error}`;
      throw result;
    }
  }

  /**
   * Synchronizes a note to Milvus vector database
   * @param note - The note to sync
   * @private
   */
  private async syncToMilvus(note: note): Promise<void> {
    const milvusDoc = {
      oid: note.oid,
      title: note.fileName,
      content: note.content[0]?.fileContent || '',
      partition_key: null,
    };
    await this.milvusCollectionOperator.insertDocuments([milvusDoc]);
  }

  /**
   * Synchronizes a note to Neo4j graph database
   * @param note - The note to sync
   * @returns Promise<string> - The created node ID
   * @private
   */
  private async syncToNeo4j(note: note): Promise<string> {
    return await this.neo4jManager.createNode('Note', {
      oid: note.oid,
      fileName: note.fileName,
      content: note.content[0]?.fileContent || '',
      metaData: note.metaData || {},
    });
  }

  /**
   * Adds multiple notes to the knowledge database with configurable concurrency
   * @param notes - Array of notes to add
   * @param options - Configuration options
   * @param options.concurrency - Maximum concurrent operations (default: 5)
   * @param options.onProgress - Callback for progress updates
   * @returns Promise<SyncResult[]> - Array of sync results for each note
   */
  async bulkAddNote(
    notes: note[],
    options: {
      batchSize?: number;
      onProgress?: (progress: { completed: number; total: number }) => void;
    } = {},
  ): Promise<SyncResult[]> {
    const { batchSize = 100, onProgress } = options;
    const results: SyncResult[] = Array(notes.length).fill({
      status: SyncStatus.SYNC_FAILED,
      message: 'Not processed yet',
      recordIds: {},
    });

    const { db } = await connectToDatabase();
    const mongodbNoteCollection = db.collection<note>(
      this.mongodbNoteCollectionName,
    );

    // Process in batches
    for (let i = 0; i < notes.length; i += batchSize) {
      const batch = notes.slice(i, i + batchSize);
      const batchResults: SyncResult[] = Array(batch.length);

      try {
        const batchOids = batch.map((n) => n.oid);

        // 1. Check existing notes in MongoDB
        const existingMongoDocs = await mongodbNoteCollection
          .find({ oid: { $in: batchOids } }, { projection: { oid: 1 } })
          .toArray();
        const existingMongoOidSet = new Set(
          existingMongoDocs.map((doc) => doc.oid),
        );

        // 2. Filter notes for MongoDB insertion
        const notesToInsertMongo = batch.filter(
          (n) => !existingMongoOidSet.has(n.oid),
        );

        // 3. Bulk insert new notes to MongoDB
        let mongoInsertResult:
          | { acknowledged: boolean; insertedIds: Record<number, any> }
          | undefined;
        if (notesToInsertMongo.length > 0) {
          mongoInsertResult =
            await mongodbNoteCollection.insertMany(notesToInsertMongo);
          if (!mongoInsertResult.acknowledged) {
            throw new Error('Failed to bulk insert notes to MongoDB');
          }
        }
        // 4. Check existing notes in Milvus and Neo4j using available methods
        let existingMilvusOidSet = new Set<string>();
        let existingNeo4jOidSet = new Set<string>();

        if (batchOids.length > 0) {
          // Milvus check using query
          const milvusFilter = `oid in ["${batchOids.join('", "')}"]`;
          const milvusResult =
            await this.milvusCollectionOperator.milvusClient.query({
              collection_name: this.milvusNoteCollectionName,
              filter: milvusFilter,
              output_fields: ['oid'], // Only need oid to check existence
            });
          if (
            milvusResult.status.error_code === 'Success' &&
            milvusResult.data
          ) {
            existingMilvusOidSet = new Set(
              milvusResult.data.map((doc) => (doc as { oid: string }).oid),
            );
          } else {
            console.warn(
              'Milvus query for existing OIDs failed or returned no data:',
              milvusResult.status.reason,
            );
            // Decide how to handle failure - potentially skip Milvus inserts for this batch or throw error
          }

          // Neo4j check using executeQuery
          const neo4jQuery = `MATCH (n:Note) WHERE n.oid IN ["${batchOids.join('", "')}"] RETURN n.oid AS oid`;
          try {
            const neo4jResult =
              await this.neo4jManager.executeQuery(neo4jQuery);
            existingNeo4jOidSet = new Set(
              neo4jResult.records.map((record: any) => record.get('oid')),
            );
          } catch (error) {
            console.warn('Neo4j query for existing OIDs failed:', error);
            // Decide how to handle failure - potentially skip Neo4j inserts for this batch or throw error
          }
        }

        // 5. Filter notes for Milvus insertion
        const notesToInsertMilvus = batch.filter(
          (n) => !existingMilvusOidSet.has(n.oid),
        );
        const milvusDocsToInsert = notesToInsertMilvus.map((note) => ({
          oid: note.oid,
          title: note.fileName,
          content: note.content[0]?.fileContent || '',
          partition_key: null, // Assuming partition_key is handled or null
        }));

        // 6. Filter notes for Neo4j creation
        const notesToCreateNeo4j = batch.filter(
          (n) => !existingNeo4jOidSet.has(n.oid),
        );
        const neo4jNodesToCreate = notesToCreateNeo4j.map((note) => ({
          oid: note.oid,
          fileName: note.fileName,
          content: note.content[0]?.fileContent || '',
          metaData: note.metaData || {},
        }));

        // 7. Parallel sync to Milvus and Neo4j (with filtered data)
        // Note: Neo4j bulkCreateNodes for 'Note' uses processMarkdownFiles which handles MERGE internally.
        // We still filter the input array `neo4jNodesToCreate` to avoid unnecessary processing.
        // Milvus insertDocuments needs the filtered list `milvusDocsToInsert`.
        const [milvusInsertResult, neo4jCreateResult] = await Promise.all([
          milvusDocsToInsert.length > 0
            ? this.milvusCollectionOperator.insertDocuments(milvusDocsToInsert)
            : Promise.resolve({
                status: {
                  error_code: 'Success',
                } /* mock success for empty insert */,
              }),
          neo4jNodesToCreate.length > 0
            ? this.neo4jManager.bulkCreateNodes('Note', neo4jNodesToCreate)
            : Promise.resolve(undefined), // Avoid empty create
        ]);

        // 8. Update results for this batch
        batch.forEach((note, index) => {
          const wasNewInMongo = !existingMongoOidSet.has(note.oid);
          const attemptedMilvusInsert = !existingMilvusOidSet.has(note.oid);
          const attemptedNeo4jCreate = !existingNeo4jOidSet.has(note.oid);

          let mongoId: string | undefined = undefined;
          let neo4jId: string | undefined = undefined;
          const messageParts: string[] = [];
          let status: SyncStatus;

          // MongoDB status
          if (wasNewInMongo) {
            const mongoInsertIndex = notesToInsertMongo.findIndex(
              (n) => n.oid === note.oid,
            );
            if (mongoInsertIndex !== -1) {
              mongoId =
                mongoInsertResult?.insertedIds?.[mongoInsertIndex]?.toString();
            }
            messageParts.push('MongoDB: Inserted');
          } else {
            messageParts.push('MongoDB: Existed');
          }

          // Milvus status
          if (attemptedMilvusInsert) {
            // Check actual insert result if available, otherwise assume success if no error thrown
            if (milvusInsertResult?.status?.error_code === 'Success') {
              messageParts.push('Milvus: Inserted');
            } else {
              messageParts.push(
                `Milvus: Insert Failed (${milvusInsertResult?.status?.reason || 'Unknown'})`,
              );
              // Potentially adjust overall status if insert failed
            }
          } else {
            messageParts.push('Milvus: Skipped (Exists)');
          }

          // Neo4j status
          if (attemptedNeo4jCreate) {
            // bulkCreateNodes for 'Note' returns oids used in MERGE. Check if the oid is in the result.
            if (
              neo4jCreateResult &&
              Array.isArray(neo4jCreateResult) &&
              neo4jCreateResult.includes(note.oid)
            ) {
              neo4jId = note.oid; // Use oid as the identifier for merged nodes
              messageParts.push('Neo4j: Created/Merged');
            } else {
              messageParts.push('Neo4j: Create/Merge Failed');
              // Potentially adjust overall status if create failed
            }
          } else {
            messageParts.push('Neo4j: Skipped (Exists)');
          }

          // Determine final status
          if (
            !wasNewInMongo &&
            !attemptedMilvusInsert &&
            !attemptedNeo4jCreate
          ) {
            status = SyncStatus.ALREADY_EXISTS; // Existed everywhere checked
            messageParts.length = 0; // Clear parts for a concise message
            messageParts.push(
              'Note already existed in MongoDB, Milvus, and Neo4j',
            );
          } else if (
            wasNewInMongo &&
            attemptedMilvusInsert &&
            attemptedNeo4jCreate
          ) {
            status = SyncStatus.FULL_SYNC; // Fully synced a new note
            messageParts.length = 0; // Clear parts for a concise message
            messageParts.push('Successfully synced new note to all databases');
          } else {
            status = SyncStatus.PARTIAL_SYNC; // Covers all other cases (new but skipped, existed but synced missing parts)
          }

          batchResults[index] = {
            status: status,
            message: messageParts.join(' | '),
            recordIds: {
              oid: note.oid,
              mongoId,
              neo4jId,
              // milvusId is often not returned or needed per-document on bulk insert
            },
          };
        });

        // Update main results array
        batchResults.forEach((result, index) => {
          results[i + index] = result;
        });
      } catch (error) {
        // Mark failed notes in this batch
        batch.forEach((note, index) => {
          results[i + index] = {
            status: SyncStatus.SYNC_FAILED,
            message: error instanceof Error ? error.message : 'Unknown error',
            recordIds: { oid: note.oid },
          };
        });
      }

      // Report progress
      onProgress?.({
        completed: Math.min(i + batchSize, notes.length),
        total: notes.length,
      });
    }

    return results;
  }
}
