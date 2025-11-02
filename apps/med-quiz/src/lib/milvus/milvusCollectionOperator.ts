import { embedding } from "@/kgrag/lib/embedding";
import {
  MilvusClient,
  SearchReq,
  SearchSimpleReq,
  FunctionType,
} from "@zilliz/milvus2-sdk-node";
import { DataType } from "@zilliz/milvus2-sdk-node";

import dotenv from "dotenv";

dotenv.config();

if (!process.env.MILVUS_URI) {
  throw new Error("env empty: MILVUS_URI");
}

// 修改后的文档数据接口
export interface MilvusDocument {
  oid: string;

  /**
   * 文档标题，作为主键
   */
  title?: string;

  /**
   * 文档别名列表
   */
  alias?: string[];

  /**
   * 文档内容
   */
  content: string;

  /**
   * 文档标签
   */
  tags?: string[];

  /**
   * 文档向量嵌入
   * 注意：通常由系统自动生成，客户端可以不提供
   */
  embedding?: number[];

  /**
   * 索引签名，允许添加任意字符串键的属性
   * 这使得 MilvusDocument 兼容 RowData 类型
   */
  [key: string]: any;
  partition_key: string | null;
}

// 搜索选项接口
export interface SearchOptions {
  limit?: number;
  offset?: number;
  outputFields?: string[];
  partitionNames?: string[];
  expr?: string;
}

// 搜索结果接口
export interface SearchResult {
  documents: MilvusDocument[];
  distances: number[];
}

/**
 * 实现与milvus指定集合的全部基本操作
 */
export default class milvusCollectionOperator {
  /**
   * 当前实例所操作的collection
   */
  milvusCollectionName: string;

  milvusClient = new MilvusClient({
    address: process.env.MILVUS_URI as string,
    // timeout: parseInt(process.env.MILVUS_CLIENT_TIMEOUT || '30000'), // Use env variable with fallback
    // username: process.env.MILVUS_USERNAME,
    // password: process.env.MILVUS_PASSWORD,
    // token: process.env.TOKEN,
    // tls: {
    //     skipCertCheck: true, // Disable SSL certificate verification
    // }
  });

  constructor(milvusCollectionName: string) {
    this.milvusCollectionName = milvusCollectionName;

    // Debug mode output
    if (process.env.NODE_ENV === "development" || process.env.DEBUG_MILVUS) {
      console.debug(
        "[MilvusCollectionOperator] Initializing with connection info:",
        {
          collection: milvusCollectionName,
          uri: process.env.MILVUS_URI,
          timeout: process.env.MILVUS_CLIENT_TIMEOUT || "30000",
          username: process.env.MILVUS_USERNAME ? "*****" : "not set",
          password: process.env.MILVUS_PASSWORD ? "*****" : "not set",
          token: process.env.TOKEN ? "*****" : "not set",
        },
      );
    }
  }

  /**
   * 创建集合
   */
  async createCollection(): Promise<any> {
    const createRes = await this.milvusClient.createCollection({
      collection_name: this.milvusCollectionName,
      fields: [
        {
          name: "oid",
          data_type: DataType.VarChar,
          is_primary_key: true,
          type_params: {
            max_length: "100",
          },
        },
        {
          name: "title",
          data_type: DataType.VarChar,
          is_primary_key: false,
          type_params: {
            max_length: "100",
          },
        },
        {
          name: "alias",
          data_type: DataType.Array,
          element_type: DataType.VarChar,
          max_capacity: 100,
          max_length: 100,
        },
        {
          name: "content",
          data_type: DataType.VarChar,
          description: "text content of embedding",
          enable_analyzer: true,
          enable_match: true,
          type_params: {
            max_length: "10000",
          },
        },
        {
          name: "embedding",
          data_type: DataType.FloatVector,
          description: "",
          type_params: {
            dim: String(await this.checkEmbeddingDimension()),
          },
        },
        {
          name: "sparse_embedding",
          data_type: DataType.SparseFloatVector,
          description: "BM25 sparse embeddings for full-text search",
        },
        {
          name: "partition_key",
          data_type: DataType.VarChar,
          is_partition_key: true,
          type_params: {
            max_length: "100",
          },
        },
        {
          name: "pdf_uri",
          data_type: DataType.Array,
        },
      ],
      functions: [
        {
          name: "text_bm25_emb",
          description: "bm25 function",
          type: FunctionType.BM25,
          input_field_names: ["content"],
          output_field_names: ["sparse_embedding"],
          params: {},
        },
      ],
      index_params: [
        {
          field_name: "sparse_embedding",
          metric_type: "BM25",
          index_type: "AUTOINDEX",
          params: {
            inverted_index_algo: "DAAT_MAXSCORE",
            bm25_k1: 1.2,
            bm25_b: 0.75,
          },
        },
      ],
    });

    console.log(
      "--- Create collection ---",
      createRes,
      this.milvusCollectionName,
    );
    return createRes;
  }

  /**
   * 检查 embedding 向量长度
   * @returns 当前embedding实例的嵌入长度
   */
  async checkEmbeddingDimension() {
    const query = "请介绍一下 LangChain";
    const vector = await embedding(query);
    if (vector === null) {
      throw new Error("Failed to generate embedding for dimension check.");
    }
    console.log("生成的向量长度：", vector.length);
    return vector.length;
  }

  /**
   * 确认集合存在
   */
  async ensureCollectionExists(): Promise<boolean> {
    try {
      // 检查集合是否存在
      const hasCollectionRes = await this.milvusClient.hasCollection({
        collection_name: this.milvusCollectionName,
      });

      // 集合存在但可能未加载的情况处理
      if (hasCollectionRes.value === true) {
        await this.ensureIndexesExist();
        await this.ensureCollectionLoaded();
        return true;
      }

      // 如果集合存在，直接返回 true
      if (
        hasCollectionRes.status.error_code === "Success" &&
        hasCollectionRes.value === true
      ) {
        console.log(
          `Collection '${this.milvusCollectionName}' already exists.`,
        );
        return true;
      }

      // 如果集合不存在，创建集合
      console.log(
        `Collection '${this.milvusCollectionName}' does not exist. Creating...`,
      );
      const createRes = await this.createCollection();

      // 检查创建是否成功
      if (createRes.error_code === "Success") {
        console.log(
          `Successfully created collection '${this.milvusCollectionName}'.`,
        );

        // 创建所有索引
        await this.ensureIndexesExist();

        // 加载集合到内存
        await this.milvusClient.loadCollection({
          collection_name: this.milvusCollectionName,
        });

        return true;
      } else {
        console.error(`Failed to create collection: ${createRes.reason}`);
        return false;
      }
    } catch (error) {
      console.error(`Error ensuring collection exists: ${error}`);
      return false;
    }
  }

  async ensureIndexesExist(): Promise<void> {
    // 定义需要索引的字段及其配置
    const indexConfigs = [
      {
        field: "oid",
        indexType: "INVERTED",
        params: {},
      },
      {
        field: "title",
        indexType: "INVERTED",
        params: {},
      },
      {
        field: "alias",
        indexType: "INVERTED",
        params: {
          extra_params: [
            {
              key: "element_type",
              value: DataType.VarChar,
            },
          ],
        },
      },
      {
        field: "content",
        indexType: "INVERTED",
        params: {},
      },
      {
        field: "tags",
        indexType: "INVERTED",
        params: {
          extra_params: [
            {
              key: "element_type",
              value: DataType.VarChar,
            },
          ],
        },
      },
      {
        field: "embedding",
        indexType: "HNSW",
        params: {
          metric_type: "COSINE",
          params: {
            M: "8",
            efConstruction: "64",
          },
        },
      },
      {
        field: "partition_key",
        indexType: "INVERTED",
        params: {},
      },
    ];

    try {
      // 获取现有索引
      const existingIndexes = await this.milvusClient.listIndexes({
        collection_name: this.milvusCollectionName,
      });

      // 创建缺失的索引
      await Promise.all(
        indexConfigs.map(async (config) => {
          const exists = existingIndexes.indexes.some(
            (idx) => idx === config.field,
          );

          if (!exists) {
            console.log(
              `正在为字段 ${config.field} 创建 ${config.indexType} 索引...`,
            );
            await this.createSingleIndexWithRetry(config);
          }
        }),
      );
    } catch (error) {
      console.error("索引验证失败:", error);
      throw error;
    }
  }

  // 带重试的单个索引创建方法
  private async createSingleIndexWithRetry(
    config: {
      field: string;
      indexType: string;
      params: any;
    },
    retries = 3,
  ): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const indexParams = {
          collection_name: this.milvusCollectionName,
          field_name: config.field,
          index_type: config.indexType,
          ...config.params,
        };

        const res = await this.milvusClient.createIndex(indexParams);

        if (res.error_code === "Success") {
          console.log(
            `成功创建 ${config.indexType} 索引于字段 ${config.field}`,
          );
          return;
        }

        throw new Error(res.reason);
      } catch (error) {
        if (attempt === retries) {
          console.error(
            `为 ${config.field} 创建索引失败（最终尝试）: ${error}`,
          );
          throw error;
        }

        console.warn(
          `为 ${config.field} 创建索引失败（第 ${attempt} 次重试）: ${error}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  /**
   * 插入文档到集合中
   * @param documents 要插入的文档数组
   * @returns 插入操作的结果
   */
  async insertDocuments(documents: MilvusDocument[]): Promise<any> {
    return this.batchInsertDocuments(documents, {
      batchSize: documents.length,
    });
  }

  /**
   * 批量插入文档并生成嵌入，支持分批处理
   * @param documents 要插入的文档数组
   * @param options 配置选项
   * @param options.batchSize 每批处理的文档数量，默认100
   * @param options.onProgress 进度回调函数
   * @returns 插入操作的结果
   */
  async batchInsertDocuments(
    documents: MilvusDocument[],
    options: {
      batchSize?: number;
      maxLength?: number;
      onProgress?: (progress: { completed: number; total: number }) => void;
    },
  ): Promise<any> {
    try {
      const {
        batchSize = 100,
        onProgress,
        maxLength = parseInt(process.env.MILVUS_MAX_CHUNK_LENGTH || "5000"),
      } = options;

      // 确保集合存在
      const collectionExists = await this.ensureCollectionExists();
      if (!collectionExists) {
        throw new Error(
          `Collection '${this.milvusCollectionName}' does not exist and could not be created.`,
        );
      }

      // 预处理文档 - 过滤掉内容过长的文档
      const preprocessedDocs = documents
        .filter((doc) => {
          if (doc.content.length > maxLength) {
            console.warn(
              `Document ${doc.oid} skipped - content length ${doc.content.length} exceeds max length ${maxLength}`,
            );
            return false;
          }
          return true;
        })
        .map((doc) => ({
          ...doc,
          alias: doc.alias ?? [],
          tags: doc.tags ?? [],
          partition_key: doc.partition_key ?? "",
        }))
        .filter((doc) => doc.content.length > 0);

      // 获取所有文档的oid
      const allOids = preprocessedDocs.map((doc) => doc.oid);
      // 查询已存在的oid
      const existingOids = await this.getExistingOids(allOids);
      // 过滤掉已存在的文档
      const newDocuments = preprocessedDocs.filter(
        (doc) => !existingOids.has(doc.oid),
      );

      if (newDocuments.length === 0) {
        console.log("All documents already exist in the collection");
        return { status: { error_code: "Success" } };
      }

      console.log(
        `Starting embedding and insertion of ${newDocuments.length} new documents (skipping ${documents.length - newDocuments.length} existing ones) in batches of ${batchSize}`,
      );

      // 分批处理文档
      for (let i = 0; i < newDocuments.length; i += batchSize) {
        const batch = newDocuments.slice(i, i + batchSize);

        // 为当前批次的文档生成嵌入
        const processedBatch = await Promise.all(
          batch.map(async (doc) => {
            const docEmbedding = await embedding(doc.content);
            if (docEmbedding === null) {
              throw new Error(
                `Failed to generate embedding for document ${doc.oid}`,
              );
            }
            return {
              ...doc,
              embedding: docEmbedding,
            };
          }),
        );

        // 插入当前批次
        const insertResult = await this.milvusClient.insert({
          collection_name: this.milvusCollectionName,
          data: processedBatch,
        });

        if (insertResult.status.error_code !== "Success") {
          throw new Error(
            `Batch insert failed: ${JSON.stringify(insertResult)}\n\n content length: ${processedBatch.map((e) => e.content.length)} \n\ncurrent insert doucments: ${JSON.stringify(processedBatch.map((e) => e.title))}`,
          );
        }

        console.log(
          `Inserted batch ${i / batchSize + 1} (${Math.min(i + batchSize, newDocuments.length)}/${newDocuments.length})`,
        );

        // 报告进度
        onProgress?.({
          completed: Math.min(i + batchSize, newDocuments.length),
          total: newDocuments.length,
        });
      }

      console.log(
        `Successfully inserted all ${newDocuments.length} new documents`,
      );
      return { status: { error_code: "Success" } };
    } catch (error) {
      console.error(
        `Error in batch document insertion: \n---error---\n${error}\n`,
      );
      throw error;
    }
  }

  async getRecordCount(): Promise<number> {
    try {
      // 确保集合已加载
      await this.ensureCollectionLoaded();

      // 获取集合统计信息
      const stats = await this.milvusClient.count({
        collection_name: this.milvusCollectionName,
      });

      // 解析统计信息中的行数
      const rowCount = stats.data;

      return rowCount;
    } catch (error) {
      console.error("获取记录数量失败:", error);
      throw error;
    }
  }

  /**
   * 批量查询已存在的OID
   * @param oids 要查询的OID数组
   * @returns 已存在的OID集合
   */
  async getExistingOids(oids: string[]): Promise<Set<string>> {
    try {
      await this.ensureCollectionLoaded();

      if (oids.length === 0) {
        return new Set();
      }

      // Split into smaller batches if too many OIDs
      const batchSize = 1000;
      const resultSet = new Set<string>();

      for (let i = 0; i < oids.length; i += batchSize) {
        const batch = oids.slice(i, i + batchSize);
        const filter = batch.map((oid) => `oid == "${oid}"`).join(" || ");

        let retries = 3;
        while (retries > 0) {
          try {
            const queryResult = await this.milvusClient.query({
              collection_name: this.milvusCollectionName,
              filter,
              output_fields: ["oid"],
              timeout: 30000, // 30 second timeout
            });

            if (queryResult.status.error_code !== "Success") {
              throw new Error(`Query failed: ${queryResult.status.reason}`);
            }

            queryResult.data.forEach((doc: any) => resultSet.add(doc.oid));
            break;
          } catch (error) {
            retries--;
            if (retries === 0) {
              console.error(`Failed to query OIDs after retries: ${error}`);
              throw error;
            }
            console.warn(
              `Query failed, ${retries} retries remaining: ${error}`,
            );
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }

      return resultSet;
    } catch (error) {
      console.error(`Error querying existing oids: ${error}`);
      throw error;
    }
  }

  /**
   * 通过OID查询文档
   * @param oid 文档OID
   * @returns 查询到的文档或null
   */
  async getDocumentByOid(oid: string): Promise<MilvusDocument | null> {
    try {
      await this.ensureCollectionLoaded();

      const queryResult = await this.milvusClient.query({
        collection_name: this.milvusCollectionName,
        filter: `oid == "${oid}"`,
        output_fields: ["title", "alias", "content", "tags"],
      });

      if (queryResult.status.error_code !== "Success") {
        throw new Error(`Query failed: ${queryResult.status.reason}`);
      }

      if (queryResult.data.length === 0) {
        return null;
      }

      return queryResult.data[0] as MilvusDocument;
    } catch (error) {
      console.error(`Error querying document by oid: ${error}`);
      throw error;
    }
  }

  /**
   * 通过标题查询文档
   * @param title 文档标题
   * @returns 查询到的文档或null
   */
  async getDocumentByTitle(title: string): Promise<MilvusDocument | null> {
    try {
      await this.ensureCollectionLoaded();

      const queryResult = await this.milvusClient.query({
        collection_name: this.milvusCollectionName,
        filter: `title == "${title}"`,
        output_fields: ["title", "alias", "content", "tags"],
      });

      if (queryResult.status.error_code !== "Success") {
        throw new Error(`Query failed: ${queryResult.status.reason}`);
      }

      if (queryResult.data.length === 0) {
        return null;
      }

      return queryResult.data[0] as MilvusDocument;
    } catch (error) {
      console.error(`Error querying document by title: ${error}`);
      throw error;
    }
  }

  private async ensureCollectionLoaded(): Promise<void> {
    const loadStatus = await this.milvusClient.getLoadState({
      collection_name: this.milvusCollectionName,
    });

    if (loadStatus.state !== "LoadStateLoaded") {
      await this.milvusClient.loadCollectionSync({
        collection_name: this.milvusCollectionName,
        timeout: 30, // 30秒超时
      });
    }
  }

  /**
   * 通过标签查询文档
   * @param tag 要查询的标签
   * @param options 查询选项
   * @returns 查询结果
   */
  async getDocumentsByTag(
    tag: string,
    options: SearchOptions = {},
  ): Promise<MilvusDocument[]> {
    try {
      const {
        limit = 10,
        offset = 0,
        outputFields = ["title", "alias", "content", "tags", "oid"],
      } = options;

      const queryResult = await this.milvusClient.query({
        collection_name: this.milvusCollectionName,
        filter: `array_contains(tags, "${tag}")`,
        output_fields: outputFields,
        limit,
        offset,
      });

      if (queryResult.status.error_code !== "Success") {
        throw new Error(`Query failed: ${queryResult.status.reason}`);
      }

      return queryResult.data as MilvusDocument[];
    } catch (error) {
      console.error(`Error querying documents by tag: ${error}`);
      throw error;
    }
  }

  /**
   * Basic ANN search: 通过向量相似度搜索文档
   * @param query 查询文本
   * @param options 搜索选项
   * @returns 搜索结果
   */
  async searchSimilarDocuments(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult> {
    try {
      const { limit = 5, partitionNames, expr } = options;

      const outputFields = [
        "title",
        "alias",
        "content",
        "tags",
        "partition_key",
        "oid",
      ];

      // 生成查询文本的向量嵌入
      const queryEmbedding = await embedding(query);
      if (queryEmbedding === null) {
        throw new Error("Failed to generate embedding for search query.");
      }

      const searchquery: SearchSimpleReq = {
        collection_name: this.milvusCollectionName,
        data: [queryEmbedding], // data should be number[][]
        anns_field: "embedding",
        limit: limit,
        output_fields: outputFields,
        params: {
          metric_type: "COSINE",
          // params: { ef: 64 } // HNSW 索引的搜索参数
        },
      };

      if (partitionNames && partitionNames.length > 0) {
        searchquery.partition_names = partitionNames;
      }

      if (expr) {
        searchquery.expr = expr;
      }

      console.log(searchquery);

      // 执行向量搜索
      const searchResult = await this.milvusClient.search(searchquery);
      // console.log(searchResult)

      if (searchResult.status.error_code !== "Success") {
        throw new Error(`Search failed: ${searchResult.status.reason}`);
      }

      // 格式化搜索结果
      const documents = searchResult.results.map((item) => {
        const doc: MilvusDocument = {
          oid: item.oid,
          title: item.title,
          content: item.content,
          partition_key: item.partition_key,
        };

        if (item.alias) doc.alias = item.alias;
        if (item.tags) doc.tags = item.tags;
        console.log(item.partition_key);
        return doc;
      });

      const distances = searchResult.results.map((item) => item.score);

      return { documents, distances };
    } catch (error) {
      console.error(`Error searching similar documents: ${error}`);
      throw error;
    }
  }

  /**
   * 更新文档 - 使用upsert方法
   * @param title 要更新的文档标题
   * @param updateData 更新的数据
   * @returns 更新操作的结果
   */
  async updateDocument(
    title: string,
    updateData: Partial<MilvusDocument>,
  ): Promise<any> {
    try {
      // 1. 首先获取现有文档
      const existingDoc = await this.getDocumentByTitle(title);

      if (!existingDoc) {
        throw new Error(`Document with title "${title}" not found`);
      }

      // 2. 合并现有文档和更新数据
      const updatedDoc: MilvusDocument = {
        ...existingDoc,
        ...updateData,
      };

      // 3. 如果内容被更新，重新生成嵌入
      if (updateData.content) {
        const newEmbedding = await embedding(updatedDoc.content);
        if (newEmbedding === null) {
          throw new Error(
            `Failed to generate embedding for updated document ${updatedDoc.oid}`,
          );
        }
        updatedDoc.embedding = newEmbedding;
      }

      // 4. 使用upsert方法更新文档
      // 由于title是主键，upsert会自动覆盖已存在的文档
      const upsertResult = await this.milvusClient.upsert({
        collection_name: this.milvusCollectionName,
        data: [updatedDoc],
      });

      return upsertResult;
    } catch (error) {
      console.error(`Error updating document: ${error}`);
      throw error;
    }
  }

  /**
   * 删除文档
   * @param title 要删除的文档标题
   * @returns 删除操作的结果
   */
  async deleteDocument(title: string): Promise<any> {
    try {
      const deleteResult = await this.milvusClient.delete({
        collection_name: this.milvusCollectionName,
        filter: `title == "${title}"`,
      });

      return deleteResult;
    } catch (error) {
      console.error(`Error deleting document: ${error}`);
      throw error;
    }
  }

  /**
   * 获取集合统计信息
   * @returns 集合统计信息
   */
  async getCollectionStats(): Promise<any> {
    try {
      const statsResult = await this.milvusClient.getCollectionStatistics({
        collection_name: this.milvusCollectionName,
      });

      return statsResult;
    } catch (error) {
      console.error(`Error getting collection statistics: ${error}`);
      throw error;
    }
  }

  /**
   * 批量删除文档
   * @param filter 删除过滤条件
   * @returns 删除操作的结果
   */
  async batchDeleteDocuments(filter: string): Promise<any> {
    try {
      const deleteResult = await this.milvusClient.delete({
        collection_name: this.milvusCollectionName,
        filter,
      });

      return deleteResult;
    } catch (error) {
      console.error(`Error batch deleting documents: ${error}`);
      throw error;
    }
  }

  /**
   * Merge multiple collections into one, using source collection names as partitions
   * @param sourceCollections Array of source collection names to merge
   * @param targetCollection Name of target collection to merge into
   */
  async mergeCollections(
    sourceCollections: string[],
    targetCollection: string,
  ): Promise<void> {
    try {
      // Create target collection if it doesn't exist
      const targetOperator = new milvusCollectionOperator(targetCollection);
      await targetOperator.ensureCollectionExists();

      // Process each source collection
      for (const sourceName of sourceCollections) {
        const sourceOperator = new milvusCollectionOperator(sourceName);

        // Create partition in target collection named after source collection
        await this.milvusClient.createPartition({
          collection_name: targetCollection,
          partition_name: sourceName,
        });

        // Get and transfer documents in smaller batches to avoid GRPC size limits
        const queryBatchSize = 200; // Reduced from 1000
        const insertBatchSize = 100; // Reduced from 500
        let offset = 0;
        let totalTransferred = 0;

        console.log(
          `Starting transfer from ${sourceName} to ${targetCollection}`,
        );

        while (true) {
          // Query source collection in batches
          let queryResult;
          let retries = 3;
          let lastError;

          while (retries > 0) {
            try {
              queryResult = await sourceOperator.milvusClient.query({
                collection_name: sourceName,
                output_fields: ["*"],
                limit: queryBatchSize,
                offset: offset,
                expr: 'oid != ""',
                timeout: 30000, // 30 second timeout
              });

              if (queryResult.status.error_code !== "Success") {
                throw new Error(
                  `Query failed for collection ${sourceName}: ${queryResult.status.reason}`,
                );
              }
              break;
            } catch (error) {
              lastError = error;
              retries--;
              if (retries > 0) {
                console.warn(
                  `Query failed, ${retries} retries remaining. Error: ${error}`,
                );
                await new Promise((resolve) => setTimeout(resolve, 2000));
              }
            }
          }

          if (!queryResult) {
            throw (
              lastError ||
              new Error(
                `Failed to query collection ${sourceName} after retries`,
              )
            );
          }

          if (queryResult.data.length === 0) {
            break; // No more documents
          }

          // Process and validate documents
          const docs = queryResult.data.map((doc) => {
            if (!doc.oid || !doc.content) {
              throw new Error(
                `Invalid document from collection ${sourceName}: missing required fields`,
              );
            }
            return doc as MilvusDocument;
          });

          // Insert in smaller batches
          for (let i = 0; i < docs.length; i += insertBatchSize) {
            const batch = docs.slice(i, i + insertBatchSize);
            try {
              let insertResult;
              let retries = 3;
              let lastInsertError;

              while (retries > 0) {
                try {
                  // 添加partition_key字段，让Milvus自动处理分区
                  const batchWithPartition = batch.map((doc) => ({
                    ...doc,
                    partition_key: sourceName,
                  }));
                  insertResult = await this.milvusClient.insert({
                    collection_name: targetCollection,
                    data: batchWithPartition,
                    timeout: 60000, // 60 second timeout
                  });

                  if (insertResult.status.error_code !== "Success") {
                    throw new Error(
                      `Insert failed: ${insertResult.status.reason}`,
                    );
                  }
                  break;
                } catch (error) {
                  lastInsertError = error;
                  retries--;
                  if (retries > 0) {
                    console.warn(
                      `Insert failed, ${retries} retries remaining. Error: ${error}`,
                    );
                    await new Promise((resolve) => setTimeout(resolve, 5000)); // Longer delay for inserts
                  }
                }
              }

              if (
                !insertResult ||
                insertResult.status.error_code !== "Success"
              ) {
                console.error(
                  `Failed to insert batch ${i} after retries: ${lastInsertError}`,
                );
                continue; // Skip to next batch instead of failing completely
              }

              totalTransferred += batch.length;
              console.log(
                `Transferred ${totalTransferred} docs from ${sourceName} (batch ${i}-${i + batch.length - 1})`,
              );
            } catch (err) {
              console.error(`Error inserting batch ${i}: ${err}`);
            }
          }

          offset += queryBatchSize;
        }

        console.log(
          `Merged ${totalTransferred} documents from ${sourceName} to ${targetCollection}`,
        );
      }

      console.log(
        `Successfully merged ${sourceCollections.length} collections into ${targetCollection}`,
      );
    } catch (error) {
      console.error(`Error merging collections: ${error}`);
      throw error;
    }
  }
}
