import { connectToDatabase } from "@/lib/db/mongodb";
import { Db, WithId } from "mongodb";
import Progress from "progress";
import { embedding } from "@/kgrag/lib/embedding";
import {
  DataType,
  FunctionType,
  MilvusClient,
  RRFRanker,
} from "@zilliz/milvus2-sdk-node";
import { createLoggerWithPrefix } from "@/lib/console/logger";
import pLimit from "p-limit";
import oss from "ali-oss";
import { Reference } from "@/lib/agents/agent.types";
import notebook_s3_storage from "./notebook_s3_storage";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { chunkit, ChunkitOptions } from "semantic-chunking";

require("dotenv").config(); // Explicitly load environment variables

export interface textbookSearchResultItem {
  id: string;
  content: string;
  pdf_name: string;
  score: number;
  presigned_url: string;
  page_number: string;
}

interface SearchResultItem {
  id: string | number; // The document ID from Milvus
  content: string; // The text content of the matching document
  pdf_name: string; // Name of the PDF the content came from
  score: number; // The relevance score (0-1)
  presigned_url: string; // URL to access the PDF page
  page_number: string; // Page range (e.g. "5 - 7")
}

interface PDFPageRecord {
  _id?: string; // MongoDB ObjectId
  pdf_name: string;
  page_number: number;
  s3_key: string;
  s3_url: string;
  presigned_url: string;
  text_content: string;
  start_page: number;
  end_page: number;
  created_at: Date;
}

interface MilvusTextbookData {
  content: string;
  embedding: number[];
  pdf_name: string;
  s3_key: string;
  page_number: string;
  [key: string]: any; // Add index signature
}

export interface bm25Function {
  name: string;
  description: string;
  type: string;
  input_field_names: string[];
  output_field_names: string[];
  params: Record<string, any>;
}

export interface TextbookMilvusStorageConfig {
  textbook_chunk_mongodb_collection_name: string;
  textbook_milvus_collection_name: string;
  milvus_collection_name: string;
  chunk_size: number;
  chunk_overlap: number;
  embedding_batch_size?: number;
  milvus_batch_size?: number;
}

export default class TextbookMilvusStorage {
  config: TextbookMilvusStorageConfig;
  private bm25Function: bm25Function;
  CHUNK_SIZE: number = 600;
  CHUNK_OVERLAP: number = 200;
  EMBEDDING_BATCH_SIZE: number = 20;
  MILVUS_SAVE_BATCH_SIZE: number = 100;

  milvusCollectionName: string;
  logger = createLoggerWithPrefix("TextbookMilvusStorage");

  s3_storage = new notebook_s3_storage();

  // spliter = new RecursiveCharacterTextSplitter({
  //     chunkSize: 2000,
  //     chunkOverlap: 200,
  // })

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

  constructor(config: TextbookMilvusStorageConfig) {
    this.config = config;
    this.CHUNK_SIZE = config.chunk_size;
    this.CHUNK_OVERLAP = config.chunk_overlap || 200;
    this.EMBEDDING_BATCH_SIZE =
      config.embedding_batch_size ||
      parseInt(process.env.EMBEDDING_BATCH_SIZE || "100");
    this.MILVUS_SAVE_BATCH_SIZE =
      config.milvus_batch_size ||
      parseInt(process.env.MILVUS_SAVE_BATCH_SIZE || "100");

    this.bm25Function = {
      name: "text_bm25_emb",
      description: "bm25 function",
      type: "BM25",
      input_field_names: ["content"],
      output_field_names: ["sparse_embedding"],
      params: {},
    };

    // this.textSplitter = new RecursiveCharacterTextSplitter({
    //     chunkSize: this.CHUNK_SIZE,
    //     chunkOverlap: this.CHUNK_OVERLAP,
    // });

    this.milvusCollectionName = config.milvus_collection_name;
  }

  private async upload_embed(chunk: PDFPageRecord) {
    const embeddingResult = await this.withRetry(async () => {
      const result = await embedding(chunk.text_content);
      if (result === null) {
        throw new Error(`Failed to generate embedding for text chunk`);
      }
      return result;
    });
    const doc: MilvusTextbookData = {
      content: chunk.text_content,
      embedding: embeddingResult,
      pdf_name: chunk.pdf_name,
      s3_key: chunk.s3_key,
      page_number: `${chunk.start_page} - ${chunk.end_page}`,
    };

    await this.milvusClient.insert({
      collection_name: this.milvusCollectionName,
      data: [doc], // Wrap the single doc in an array
    });
  }

  private async fetch_textbook_chunks(db: Db, pdf_name: string) {
    const cursor = db
      .collection<PDFPageRecord>("pdf_pages")
      .find({ pdf_name: pdf_name })
      .sort({ page_number: 1 });
    return cursor;
  }

  /**
   * Process textbook PDF from MongoDB records
   */
  async processTextbookFromDB(pdf_name: string) {
    this.logger.info(`\n====== Processing textbook from DB ======`);
    this.logger.info(`PDF: ${pdf_name}`);
    // const chunks = await this.spliter.splitDocuments(await this.spliter.createDocuments([fullText]))

    await this.ensureCollectionExists();

    const { db } = await connectToDatabase();
    const test = await this.fetch_textbook_chunks(db, pdf_name);
    console.log(await test.toArray());
    const cursor = await this.fetch_textbook_chunks(db, pdf_name);

    // Process cursor with concurrent embeddings
    const limit = pLimit(this.EMBEDDING_BATCH_SIZE);
    const embeddingPromises: Promise<void>[] = [];

    while (await cursor.hasNext()) {
      const chunk = await cursor.next();
      if (!chunk) continue;

      const promise = limit(async () => {
        try {
          // for await (const element of chunks) {
          await this.upload_embed({
            pdf_name: chunk.pdf_name,
            page_number: chunk.page_number,
            s3_key: chunk.s3_key,
            s3_url: chunk.s3_url,
            presigned_url: chunk.presigned_url,
            text_content: chunk.text_content,
            created_at: new Date(),
            start_page: chunk.start_page,
            end_page: chunk.end_page,
          });
          // }
        } catch (error) {
          this.logger.error(`Error processing chunk: ${error}`);
          throw error; // Re-throw to stop processing
        }
      });

      embeddingPromises.push(promise);
    }

    // Wait for all embeddings to complete
    await Promise.all(embeddingPromises);

    // if (chunkCount === 0) {
    //     throw new Error(`No textbook chunks found for ${pdf_name}`);
    // }

    // // Combine all page texts
    // const fullText = textParts.join('\n\n');
    // const fileId = uuidv4();

    // // Add PDF metadata to each chunk
    // const enhancedMetadata = {
    //     ...metadata,
    //     pdf_name,
    //     fileId,
    //     s3_url: firstChunk?.s3_url,
    //     presigned_url: firstChunk?.presigned_url
    // };

    // this.logger.info(`Processed ${chunkCount} textbook chunks from DB`);
    // return this.processTextbookContent(fullText, pdf_name, enhancedMetadata);
  }

  /**
   * Get textbook processing stats
   */
  async getTextbookStats(pdf_name: string): Promise<{
    page_count: number;
    char_count: number;
    avg_page_length: number;
  }> {
    const { db } = await connectToDatabase();
    const cursor = await this.fetch_textbook_chunks(db, pdf_name);
    const chunks = await cursor.toArray();

    if (chunks.length === 0) {
      throw new Error(`No textbook chunks found for ${pdf_name}`);
    }

    const charCount = chunks.reduce(
      (sum, chunk) => sum + (chunk.text_content?.length || 0),
      0,
    );

    return {
      page_count: chunks.length,
      char_count: charCount,
      avg_page_length: Math.round(charCount / chunks.length),
    };
  }

  /**
   * 创建集合
   */
  async createCollection(): Promise<any> {
    const createRes = await this.milvusClient.createCollection({
      collection_name: this.milvusCollectionName,
      fields: [
        {
          name: "id",
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: true, // Enable auto-generation of primary key IDs
          description: "Primary Key",
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
          // type_params: {
          //     dim: '768'
          // }
        },
        {
          name: "pdf_name",
          data_type: DataType.VarChar,
          is_partition_key: true,
          type_params: {
            max_length: "100",
          },
        },
        {
          name: "page_number",
          data_type: DataType.VarChar,
          type_params: {
            max_length: "100",
          },
        },
        {
          name: "s3_key",
          data_type: DataType.VarChar,
          type_params: {
            max_length: "10000",
          },
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
        },
      ],
    });

    this.logger.info(
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
    const query = "hello";
    const vector = await embedding(query);
    if (vector === null) {
      throw new Error("Failed to generate embedding for dimension check.");
    }
    this.logger.info("生成的向量长度：", vector.length);
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
      this.logger.error(`Error ensuring collection exists: ${error}`);
      throw error; // Re-throw the error to propagate it
    }
  }

  async ensureIndexesExist(): Promise<void> {
    // 定义需要索引的字段及其配置
    const indexConfigs = [
      {
        field: "content",
        indexType: "INVERTED",
        params: {},
      },
      {
        field: "embedding",
        indexType: "HNSW",
        params: {
          metric_type: "COSINE",
          M: "8",
          efConstruction: "64",
        },
      },
      {
        field: "sparse_embedding",
        indexType: "AUTOINDEX",
        params: {
          metric_type: "BM25",
        },
      },
      {
        field: "pdf_name",
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
            (idx: string) => idx === config.field,
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
   * Perform hybrid search across multiple vector fields.
   * @param query The search query string.
   * @param limit The maximum number of results to return from each ANN search.
   * @param topK The maximum number of results to return after reranking.
   * @param pdf_name Optional: Filter results by pdf_name.
   * @returns Search results from Milvus.
   */
  async hybridSearch(
    query: string,
    limit: number,
    topK: number,
    pdf_name?: string,
  ): Promise<textbookSearchResultItem[]> {
    this.logger.info(
      `Entering hybridSearch for query: "${query}" with limit ${limit} and topK ${topK}`,
    );

    await this.ensureCollectionLoaded();

    const query_vector = await embedding(query);
    if (query_vector === null) {
      throw new Error("Failed to generate embedding for query.");
    }

    // Placeholder for multimodal vector. In a real scenario, this would come from a dedicated multimodal embedding model.
    // For now, we'll use the same embedding as text_dense for demonstration purposes.
    const query_multimodal_vector = query_vector;

    const commonExpr = pdf_name ? `pdf_name == "${pdf_name}"` : undefined;

    const search_param_text_dense = {
      data: query_vector,
      anns_field: "embedding", // Assuming 'embedding' is the text_dense field
      param: { nprobe: 10 },
      limit: limit,
      expr: commonExpr,
    };

    const search_param_text_sparse = {
      data: query,
      anns_field: "sparse_embedding",
      param: { drop_ratio_search: 0.2 },
      limit: limit,
      expr: commonExpr,
    };

    const search_param_image_dense = {
      data: query_multimodal_vector,
      anns_field: "embedding", // Assuming 'embedding' can also serve as image_dense for now
      param: { nprobe: 10 },
      limit: limit,
      expr: commonExpr,
    };

    const rerank = RRFRanker(topK);

    const searchResults = await this.milvusClient.search({
      collection_name: this.milvusCollectionName,
      data: [
        search_param_text_dense,
        search_param_text_sparse,
        search_param_image_dense,
      ],
      limit: topK, // Use topK for the final limit after reranking
      rerank: rerank,
      output_fields: ["content", "pdf_name", "s3_key", "page_number"], // Specify fields to return
    });

    this.logger.info("Hybrid search completed.");
    // this.logger.debug(`${JSON.stringify(searchResults,null,2)}`)
    const results = searchResults.results;
    this.logger.debug(`Raw searchResults.results length: ${results.length}`);
    this.logger.debug(
      `Raw searchResults.results content: ${JSON.stringify(results, null, 2)}`,
    );

    const results_with_pdf_url = await Promise.all(
      results.map(async (e) => {
        this.logger.debug(`Processing result with s3_key: ${e.s3_key}`);
        let presigned_url = "";
        try {
          presigned_url = await this.get_url(e.s3_key);
          this.logger.debug(`Generated presigned_url: ${presigned_url}`);
        } catch (error) {
          this.logger.error(
            `Error generating presigned URL for s3_key ${e.s3_key}: ${error}`,
          );
        }
        return {
          id: e.id,
          content: e.content,
          pdf_name: e.pdf_name,
          score: e.score,
          presigned_url: presigned_url,
          page_number: e.page_number,
        };
      }),
    );

    // this.logger.debug(`with url: ${JSON.stringify(results_with_pdf_url,null,2)}`)
    return results_with_pdf_url;
  }

  async vectorSearch(
    query: string,
    limit: number,
    topK: number,
    pdf_name?: string,
  ): Promise<textbookSearchResultItem[]> {
    const searchVector = await embedding(query);
    this.logger.debug(`complete embedding`);
    if (!searchVector) throw new Error();

    // Perform a vector search on the collection
    const searchResults = await this.milvusClient.search({
      collection_name: this.milvusCollectionName, // required, the collection name
      data: [searchVector], // required, vector used to compare other vectors in milvus
      params: { nprobe: 64 }, // optional, specify the search parameters
      limit: topK, // specify the number of nearest neighbors to return
      metric_type: "COSINE", // optional, metric to calculate similarity of two vectors
      output_fields: ["content", "pdf_name", "s3_key", "page_number"], // optional, specify the fields to return in the search results
    });

    this.logger.info("Vector search completed.");
    // this.logger.debug(`${JSON.stringify(searchResults,null,2)}`)
    const results = searchResults.results;
    this.logger.debug(`Raw searchResults.results length: ${results.length}`);
    // this.logger.debug(`Raw searchResults.results content: ${JSON.stringify(results, null, 2)}`);

    const results_with_pdf_url = await Promise.all(
      results.map(async (e) => {
        this.logger.debug(`Processing result with s3_key: ${e.s3_key}`);
        let presigned_url = "";
        try {
          presigned_url = await this.get_url(e.s3_key);
          this.logger.debug(`Generated presigned_url: ${presigned_url}`);
        } catch (error) {
          this.logger.error(
            `Error generating presigned URL for s3_key ${e.s3_key}: ${error}`,
          );
        }
        return {
          id: e.id,
          content: e.content,
          pdf_name: e.pdf_name,
          score: e.score,
          presigned_url: presigned_url,
          page_number: e.page_number,
        };
      }),
    );

    // this.logger.debug(`with url: ${JSON.stringify(results_with_pdf_url,null,2)}`)
    return results_with_pdf_url;
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
      retryableErrors?: string[];
      circuitBreakerTimeout?: number;
    } = {},
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 100000,
      retryableErrors = [
        "rate limit",
        "too many requests",
        "timeout",
        "network",
      ],
      circuitBreakerTimeout = 30000,
    } = options;

    let attempt = 0;
    let lastError: Error | null = null;
    let circuitOpen = false;
    let circuitOpenUntil = 0;

    while (true) {
      // Check circuit breaker first
      if (circuitOpen) {
        if (Date.now() < circuitOpenUntil) {
          throw new Error(
            `Circuit breaker open - retry after ${Math.ceil((circuitOpenUntil - Date.now()) / 1000)}s`,
          );
        }
        circuitOpen = false;
      }

      try {
        const result = await fn();
        return result;
      } catch (error) {
        const err = error as Error;
        lastError = err;

        // Check if error is retryable
        const isRetryable = retryableErrors.some((msg) =>
          err.message.toLowerCase().includes(msg.toLowerCase()),
        );

        if (!isRetryable || attempt >= maxRetries) {
          throw err;
        }

        attempt++;

        // Handle rate limit headers if present
        let delay = baseDelay * Math.pow(2, attempt - 1);
        const axiosError = error as {
          response?: { headers?: Record<string, string> };
        };
        if (axiosError.response?.headers?.["retry-after"]) {
          delay = Math.min(
            parseInt(axiosError.response.headers["retry-after"]) * 1000,
            maxDelay,
          );
        } else {
          // Add jitter to avoid thundering herd
          delay = Math.min(delay + Math.random() * baseDelay, maxDelay);
        }

        // Open circuit if we hit max retries
        if (attempt >= maxRetries) {
          circuitOpen = true;
          circuitOpenUntil = Date.now() + circuitBreakerTimeout;
          console.warn(
            `[CircuitBreaker] Opening circuit for ${circuitBreakerTimeout / 1000}s`,
          );
        }

        console.warn(
          `[Retry] Attempt ${attempt}/${maxRetries} - Retrying in ${delay}ms`,
          err.message,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      // Check circuit breaker first
      if (circuitOpen) {
        if (Date.now() < circuitOpenUntil) {
          throw new Error(
            `Circuit breaker open - retry after ${Math.ceil((circuitOpenUntil - Date.now()) / 1000)}s`,
          );
        }
        circuitOpen = false;
      }
      try {
        if (circuitOpen) {
          const now = Date.now();
          if (now < circuitOpenUntil) {
            const remaining = circuitOpenUntil - now;
            this.logger.warn(
              `Circuit breaker open, retrying in ${remaining}ms...`,
            );
            await new Promise((resolve) => setTimeout(resolve, remaining));
            continue;
          }
          circuitOpen = false;
        }

        return await fn();
      } catch (error) {
        attempt++;
        lastError = error as Error;

        // Check if error is retryable
        const isRetryable =
          retryableErrors.some(
            (pattern) =>
              error instanceof Error &&
              error.message.toLowerCase().includes(pattern.toLowerCase()),
          ) || (error as any)?.status === 429;

        if (!isRetryable || attempt >= maxRetries) {
          this.logger.error(`Operation failed after ${attempt} attempts`);
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const backoff = Math.min(
          baseDelay * Math.pow(2, attempt - 1),
          maxDelay,
        );
        const jitter = Math.random() * baseDelay;
        let delay = backoff + jitter;

        // Handle rate limit specific logic
        const isRateLimit =
          (error as any)?.status === 429 ||
          (error instanceof Error &&
            error.message.toLowerCase().includes("rate limit"));

        if (isRateLimit) {
          // Check for Retry-After header
          if ((error as any)?.headers?.["retry-after"]) {
            delay = Math.max(
              delay,
              parseInt((error as any).headers["retry-after"]) * 1000,
            );
          }

          // Trip circuit breaker for rate limits
          if (attempt >= Math.floor(maxRetries / 2)) {
            circuitOpen = true;
            circuitOpenUntil = Date.now() + delay;
            this.logger.warn(
              `Rate limit triggered circuit breaker for ${delay}ms`,
            );
          }
        }

        this.logger.warn(
          `Attempt ${attempt} failed (${error instanceof Error ? error.message : "Unknown error"}), retrying in ${Math.round(delay)}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private async get_url(obejctKey: string) {
    this.logger.debug(`predesigned url: ${obejctKey}`);
    const client = new oss({
      // 从环境变量中获取访问凭证。运行本代码示例之前，请确保已设置环境变量OSS_ACCESS_KEY_ID和OSS_ACCESS_KEY_SECRET。
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      accessKeySecret: process.env.AWS_SECRET_ACCESS_KEY as string,
      bucket: process.env.AWS_S3_BUCKET_NAME_NOTEBOOK_CHUNK as string,
      // yourregion填写Bucket所在地域。以华东1（杭州）为例，Region填写为oss-cn-hangzhou。
      region: process.env.AWS_REGION as string,
      // 设置secure为true，使用HTTPS，避免生成的下载链接被浏览器拦截
      secure: true,
      // authorizationV4: true
    });

    const url = await client.asyncSignatureUrl(obejctKey);
    this.logger.debug(`predesigned url: ${url}`);

    return url;
  }
}

export type { PDFPageRecord };
