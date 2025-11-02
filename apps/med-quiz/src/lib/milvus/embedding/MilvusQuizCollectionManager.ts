import {
  MilvusClient,
  DataType,
  IndexType,
  MetricType,
  SearchSimpleReq,
} from "@zilliz/milvus2-sdk-node";
import { Embeddings } from "@langchain/core/embeddings";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import dotenv from "dotenv";
import { ObjectId } from "mongodb";

dotenv.config();

// 定义MongoDB文档类型
export interface MongoQuizDocument {
  _id: ObjectId | string;
  content?: string;
  class?: string;
  mode?: "A1" | "A2" | "A3" | "X" | "B";
  unit?: string | null;
  source?: string;
  extractedYear?: number | null;
  tags?: string[];
  analysis?: {
    discuss?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface QuizMilvusDocument {
  oid: string;
  content: string;
  cls: string;
  mode: "A1" | "A2" | "A3" | "X" | "B";
  unit: string | null;
  source: string;
  extractedYear: number | null;
  tags?: string[];
  embedding?: number[];
  createdAt?: number; // 使用时间戳而不是Date对象
  updatedAt?: number; // 使用时间戳而不是Date对象
  [key: string]: any; // 允许添加其他字段
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  outputFields?: string[];
  filter?: string;
}

export interface SearchResult {
  documents: QuizMilvusDocument[];
  distances: number[];
}

// 索引配置接口
interface IndexConfig {
  field: string;
  indexType: string;
  params: any;
}

export default class QuizEmbeddingManager {
  CHUNK_SIZE: number = 6000;
  textSplitter: RecursiveCharacterTextSplitter;
  milvusCollectionName: string;
  milvusClient: MilvusClient;
  embeddings: Embeddings;
  debug: boolean;
  loadTimeout: number;
  maxRetries: number;

  constructor(
    collectionName: string,
    embeddings: Embeddings,
    chunkSize?: number,
    debug: boolean = false,
    loadTimeout: number = 120, // 2 minutes default
    maxRetries: number = 3,
  ) {
    if (chunkSize) this.CHUNK_SIZE = chunkSize;

    this.milvusCollectionName = collectionName;
    this.embeddings = embeddings;
    this.debug = debug;
    this.loadTimeout = loadTimeout;
    this.maxRetries = maxRetries;

    // 初始化Milvus客户端
    if (!process.env.MILVUS_URI) {
      throw new Error("env empty: MILVUS_URI");
    }

    this.milvusClient = new MilvusClient({
      address: process.env.MILVUS_URI as string,
      timeout: 30000, // 30 second timeout
      username: process.env.MILVUS_USERNAME as string,
      password: process.env.MILVUS_PASSWORD as string,
      token: process.env.TOKEN as string,
      ssl: (process.env.MILVUS_URI as string).startsWith("https"),
    });

    if (this.debug) {
      console.log(
        `[DEBUG] Initialized Milvus client for collection ${this.milvusCollectionName}`,
      );
      console.log(`[DEBUG] Milvus URI: ${process.env.MILVUS_URI}`);
      console.log(`[DEBUG] Chunk size: ${this.CHUNK_SIZE}`);
    }

    // 初始化文本分割器
    this.textSplitter = RecursiveCharacterTextSplitter.fromLanguage(
      "markdown",
      {
        chunkSize: this.CHUNK_SIZE,
        chunkOverlap: Math.floor(this.CHUNK_SIZE * 0.1), // 10% 重叠
      },
    );
  }

  /**
   * 检查嵌入维度
   */
  async checkEmbeddingDimension(): Promise<number> {
    try {
      const query = "获取嵌入向量维度的测试文本";
      const vector = await this.embeddings.embedQuery(query);
      console.log("生成的向量长度：", vector.length);
      return vector.length;
    } catch (error) {
      console.warn("获取嵌入维度失败，使用默认值 1536", error);
      return 1536;
    }
  }

  /**
   * 创建集合
   */
  async createCollection(): Promise<any> {
    try {
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
            description: "唯一标识符",
          },
          {
            name: "content",
            data_type: DataType.VarChar,
            description: "试题内容或解析",
            type_params: {
              max_length: "10000",
            },
          },
          {
            name: "cls",
            data_type: DataType.VarChar,
            description: "科目分类",
            type_params: {
              max_length: "100",
            },
          },
          {
            name: "mode",
            data_type: DataType.VarChar,
            description: "题目类型",
            type_params: {
              max_length: "10",
            },
          },
          {
            name: "unit",
            data_type: DataType.VarChar,
            description: "单元",
            type_params: {
              max_length: "100",
            },
          },
          {
            name: "source",
            data_type: DataType.VarChar,
            description: "来源",
            type_params: {
              max_length: "500",
            },
          },
          {
            name: "extractedYear",
            data_type: DataType.Int64,
            description: "提取年份",
          },
          {
            name: "tags",
            data_type: DataType.Array,
            element_type: DataType.VarChar,
            max_capacity: 50,
            max_length: 100,
            description: "标签数组",
          },
          {
            name: "createdAt",
            data_type: DataType.Int64,
            description: "创建时间戳",
          },
          {
            name: "updatedAt",
            data_type: DataType.Int64,
            description: "更新时间戳",
          },
          {
            name: "embedding",
            data_type: DataType.FloatVector,
            description: "嵌入向量",
            type_params: {
              dim: String(await this.checkEmbeddingDimension()),
            },
          },
        ],
      });

      console.log(`成功创建集合 ${this.milvusCollectionName}`, createRes);
      return createRes;
    } catch (error) {
      console.error("创建集合失败:", error);
      throw error;
    }
  }

  /**
   * 确保集合存在并已加载
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

      // 如果集合不存在，创建集合
      console.log(`集合 '${this.milvusCollectionName}' 不存在. 正在创建...`);
      const createRes = await this.createCollection();

      // 检查创建是否成功
      if (createRes.error_code === "Success") {
        console.log(`成功创建集合 '${this.milvusCollectionName}'`);

        // 创建索引
        await this.ensureIndexesExist();

        // 加载集合到内存
        await this.ensureCollectionLoaded();

        return true;
      } else {
        console.error(`创建集合失败: ${createRes.reason}`);
        return false;
      }
    } catch (error) {
      console.error(`确保集合存在时发生错误: ${error}`);
      return false;
    }
  }

  /**
   * 确保集合已加载到内存
   */
  private async ensureCollectionLoaded(): Promise<void> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const loadStatus = await this.milvusClient.getLoadState({
          collection_name: this.milvusCollectionName,
        });

        if (loadStatus.state === "LoadStateLoaded") {
          if (this.debug) {
            console.log(`集合 ${this.milvusCollectionName} 已在内存中`);
          }
          return;
        }

        if (this.debug) {
          console.log(`集合 ${this.milvusCollectionName} 状态: ${loadStatus.state}, 尝试加载 (第 ${attempt} 次)`);
        }

        await this.milvusClient.loadCollectionSync({
          collection_name: this.milvusCollectionName,
          timeout: this.loadTimeout * 1000, // Convert to milliseconds
        });
        
        console.log(`集合 ${this.milvusCollectionName} 已加载 (尝试 ${attempt}/${this.maxRetries})`);
        return;
      } catch (error) {
        lastError = error as Error;
        console.warn(`加载集合失败 (第 ${attempt} 次尝试): ${error}`);
        
        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`等待 ${delay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error(`加载集合失败，已重试 ${this.maxRetries} 次`);
    throw lastError || new Error("Unknown error occurred while loading collection");
  }

  /**
   * 确保所有索引存在
   */
  async ensureIndexesExist(): Promise<void> {
    // 定义需要索引的字段及其配置
    const indexConfigs: IndexConfig[] = [
      {
        field: "oid",
        indexType: "INVERTED",
        params: {},
      },
      {
        field: "cls",
        indexType: "INVERTED",
        params: {},
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
          metric_type: MetricType.COSINE,
          // 修改：直接传递对象而不是字符串化的JSON
          params: {
            M: 8,
            efConstruction: 64,
          },
        },
      },
    ];

    try {
      // 获取现有索引
      const existingIndexes = await this.milvusClient.listIndexes({
        collection_name: this.milvusCollectionName,
      });

      // 创建缺失的索引
      for (const config of indexConfigs) {
        // 使用类型断言处理索引检查
        interface IndexInfo {
          index_name: string;
          field_name: string;
          index_type: string;
        }

        const indexList = existingIndexes.indexes as unknown as IndexInfo[];
        const exists = indexList.some((idx) => idx.field_name === config.field);

        if (!exists) {
          console.log(
            `正在为字段 ${config.field} 创建 ${config.indexType} 索引...`,
          );
          await this.createSingleIndexWithRetry(config);
        }
      }
    } catch (error) {
      console.error("索引验证失败:", error);
      throw error;
    }
  }

  /**
   * 带重试的单个索引创建方法
   */
  private async createSingleIndexWithRetry(
    config: IndexConfig,
    retries = 3,
  ): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // 根据字段类型构建不同的索引创建参数
        let indexParams;

        if (config.field === "embedding") {
          // 向量字段的索引参数
          indexParams = {
            collection_name: this.milvusCollectionName,
            field_name: config.field,
            index_type: config.indexType,
            metric_type: MetricType.COSINE,
            params: {
              M: 8,
              efConstruction: 64,
            },
          };
        } else {
          // 标量字段的索引参数
          indexParams = {
            collection_name: this.milvusCollectionName,
            field_name: config.field,
            index_type: config.indexType,
            ...config.params,
          };
        }

        console.log(`创建索引参数:`, JSON.stringify(indexParams, null, 2));
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
   * 文本分块处理
   */
  async prepareChunks(document: MongoQuizDocument, metadata: any = {}) {
    // 确保有内容可分块
    const content = document.analysis?.discuss || document.content || "";
    if (!content) {
      throw new Error("文档没有可嵌入的内容");
    }

    return this.textSplitter.createDocuments([content], [], {
      chunkHeader: `\n\nQUIZ: ${document.content || ""}\n\nMETADATA:${JSON.stringify(metadata)}\n\nANALYSIS:\n`,
      appendChunkOverlapHeader: true,
    });
  }

  /**
   * 批量嵌入文档
   */
  async batchEmbed(
    documents: MongoQuizDocument[],
  ): Promise<QuizMilvusDocument[]> {
    const docToEmbed: QuizMilvusDocument[] = documents.map((doc) => ({
      oid: typeof doc._id === "object" ? doc._id.toString() : doc._id,
      content: doc.analysis?.discuss || doc.content || "",
      cls: doc.class || "",
      mode: doc.mode || "A1",
      unit: doc.unit || null,
      source: doc.source || "",
      extractedYear: doc.extractedYear || null,
      tags: doc.tags || [],
    }));

    try {
      const vectors = await this.embeddings.embedDocuments(
        docToEmbed.map((doc) => doc.content),
      );

      const currentTime = Date.now();

      // 将时间戳赋值给文档
      return docToEmbed.map((doc, index) => ({
        ...doc,
        embedding: vectors[index],
        createdAt: currentTime,
        updatedAt: currentTime,
      }));
    } catch (error) {
      console.error("嵌入生成失败:", error);
      throw error;
    }
  }

  /**
   * 插入文档到Milvus
   */
  async insertDocuments(documents: QuizMilvusDocument[], requireLoaded: boolean = false): Promise<any> {
    try {
      // 确保集合存在
      const collectionExists = await this.ensureCollectionExists();
      if (!collectionExists) {
        throw new Error(`集合 '${this.milvusCollectionName}' 不存在且无法创建`);
      }

      // 如果需要集合已加载，确保加载完成
      if (requireLoaded) {
        await this.ensureCollectionLoaded();
      }

      // 处理时间字段
      const currentTime = Date.now();
      const processedDocuments = documents.map((doc) => ({
        ...doc,
        createdAt: doc.createdAt || currentTime,
        updatedAt: doc.updatedAt || currentTime,
        tags: doc.tags || [],
      }));

      // 插入文档
      const insertResult = await this.milvusClient.insert({
        collection_name: this.milvusCollectionName,
        data: processedDocuments,
      });

      console.log(
        `成功插入 ${processedDocuments.length} 个文档到 '${this.milvusCollectionName}'`,
      );
      return insertResult;
    } catch (error) {
      console.error(`插入文档失败: ${error}`);
      throw error;
    }
  }

  /**
   * 检查文档是否存在
   */
  async checkDocumentExists(oid: string): Promise<boolean> {
    try {
      await this.ensureCollectionLoaded();

      const result = await this.milvusClient.query({
        collection_name: this.milvusCollectionName,
        filter: `oid == "${oid}"`,
        output_fields: ["oid"],
      });

      return result.data.length > 0;
    } catch (error) {
      console.error("检查文档存在性失败:", error);
      return false;
    }
  }

  /**
   * 通用数组分块方法
   */
  protected chunkArray<T>(array: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
      array.slice(i * size, i * size + size),
    );
  }

  /**
   * 获取记录数量
   */
  async getRecordCount(): Promise<number> {
    try {
      await this.ensureCollectionLoaded();
      const stats = await this.milvusClient.count({
        collection_name: this.milvusCollectionName,
      });
      return stats.data;
    } catch (error) {
      console.error("获取记录数量失败:", error);
      throw error;
    }
  }

  /**
   * 相似度搜索
   */
  async similaritySearch(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult> {
    try {
      const {
        limit = 5,
        outputFields = [
          "oid",
          "content",
          "cls",
          "mode",
          "unit",
          "source",
          "extractedYear",
          "tags",
        ],
        filter,
      } = options;

      if (this.debug) {
        console.log(`[DEBUG] Starting similarity search for query: "${query}"`);
        console.log(
          `[DEBUG] Search options:`,
          JSON.stringify(options, null, 2),
        );
      }

      // 确保集合已加载
      await this.ensureCollectionLoaded();

      // 生成查询嵌入
      const queryEmbedding = await this.embeddings.embedQuery(query);
      if (this.debug) {
        console.log(
          `[DEBUG] Generated query embedding (length: ${queryEmbedding.length})`,
        );
      }

      // 构建搜索请求
      const searchQuery: SearchSimpleReq = {
        collection_name: this.milvusCollectionName,
        data: [queryEmbedding],
        anns_field: "embedding",
        limit: limit,
        output_fields: outputFields,
        params: {
          metric_type: MetricType.COSINE,
          params: JSON.stringify({ ef: 64 }),
        },
      };

      // 添加过滤条件
      if (filter) {
        searchQuery.filter = filter;
        if (this.debug) {
          console.log(`[DEBUG] Applied filter: ${filter}`);
        }
      }

      // 执行搜索
      const startTime = Date.now();
      const searchResult = await this.milvusClient.search(searchQuery);
      const duration = Date.now() - startTime;

      if (this.debug) {
        console.log(`[DEBUG] Search completed in ${duration}ms`);
        console.log(`[DEBUG] Found ${searchResult.results.length} results`);
      }

      // 处理结果
      const documents = searchResult.results.map((item) => {
        const doc: QuizMilvusDocument = {
          oid: item.oid,
          content: item.content,
          cls: item.cls,
          mode: item.mode,
          unit: item.unit,
          source: item.source,
          extractedYear: item.extractedYear,
        };

        if (item.tags) doc.tags = item.tags;

        return doc;
      });

      const distances = searchResult.results.map((item) => item.score);

      if (this.debug) {
        console.log(`[DEBUG] Search results distances:`, distances);
      }

      return { documents, distances };
    } catch (error) {
      console.error("相似度搜索失败:", error);
      if (this.debug) {
        console.error(`[DEBUG] Error details:`, error);
      }
      throw error;
    }
  }

  /**
   * 基于过滤条件搜索文档
   * 此方法不使用向量相似度，仅基于字段过滤条件查询
   */
  async filterSearch(
    filter: string,
    searchStr: string,
    options: {
      limit?: number;
      offset?: number;
      outputFields?: string[];
    } = {},
  ): Promise<QuizMilvusDocument[]> {
    try {
      const {
        limit = 100,
        offset = 0,
        outputFields = [
          "oid",
          "content",
          "cls",
          "mode",
          "unit",
          "source",
          "extractedYear",
          "tags",
        ],
      } = options;

      // 确保集合已加载
      await this.ensureCollectionLoaded();

      const vector = await this.embeddings.embedQuery(searchStr);
      // 执行查询
      const queryResult = await this.milvusClient.search({
        collection_name: this.milvusCollectionName,
        filter: filter,
        data: vector,
        output_fields: outputFields,
        limit: limit,
        offset: offset,
      });

      if (!queryResult.results || !Array.isArray(queryResult.results)) {
        return [];
      }

      // 处理并返回结果
      return queryResult.results.map((item) => {
        const doc: QuizMilvusDocument = {
          oid: item.oid,
          content: item.content || "",
          cls: item.cls || "",
          mode: item.mode || "A1",
          unit: item.unit || null,
          source: item.source || "",
          extractedYear: item.extractedYear || null,
        };

        if (item.tags) doc.tags = item.tags;

        return doc;
      });
    } catch (error) {
      console.error("过滤搜索失败:", error);
      throw error;
    }
  }

  /**
   * 同步 MongoDB 的 quiz 集合中的所有题目至 Milvus 并完成嵌入
   */
  async embedAllQuizes(
    db: any,
    batchSize: number = 50,
    filter: any = {
      class: { $in: ["内科学"] },
      "analysis.discuss": { $ne: "" },
    },
  ) {
    try {
      const mongoCollection = db.collection("quiz");
      const documents = (await mongoCollection
        .find(filter)
        .toArray()) as MongoQuizDocument[];

      console.log(
        `共找到 ${documents.length} 个文档，开始逐个处理并同步到 Milvus...`,
      );

      // 确保集合存在
      await this.ensureCollectionExists();

      const syncChunks = this.chunkArray(documents, batchSize);
      let processedCount = 0;

      for (const chunk of syncChunks) {
        const docsToEmbed: MongoQuizDocument[] = [];

        for (const doc of chunk) {
          const docId =
            typeof doc._id === "object" ? doc._id.toString() : doc._id;
          if (!(await this.checkDocumentExists(docId))) {
            docsToEmbed.push(doc);
          }
        }

        if (docsToEmbed.length > 0) {
          const embeddedDocs = await this.batchEmbed(docsToEmbed);
          await this.insertDocuments(embeddedDocs);
          processedCount += docsToEmbed.length;
        }

        console.log(`已处理 ${processedCount}/${documents.length} 个文档`);
      }

      console.log(`同步完成，共嵌入 ${processedCount} 个新文档到 Milvus`);
      return processedCount;
    } catch (error) {
      console.error("嵌入全部题目失败:", error);
      throw error;
    }
  }
}
