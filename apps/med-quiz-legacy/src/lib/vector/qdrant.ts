import dotenv from 'dotenv';
import { Collection, MongoClient, ObjectId } from 'mongodb';
import { QdrantClient } from '@qdrant/js-client-rest';
import { v5 as uuidv5 } from 'uuid';
import { EmbeddedNote, note } from '@/types/noteData.types';
import { embeddings, getEmbeddings } from '../langchain/provider';
import { QdrantVectorStore } from '@langchain/qdrant';
import { connectToDatabase } from '../db/mongodb';
import { OpenAIEmbeddings } from '@langchain/openai';
dotenv.config();

interface DocumentData {
  _id: ObjectId | string;
  embedding: number[];
}

export default class Qdrant {
  MONGODB_URI: string = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  NOTE_COLECTION_NAME: string;
  DB_NAME: string = process.env.QUIZ_DB || 'QuizBank';
  COLLECTION_NAME: string = process.env.COLLECTION_NAME || 'a2';
  QDRANT_URL: string = process.env.QDRANT_URL || 'http://localhost:6333';
  // UUID namespace（确保这是一个合法的 UUID）
  UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  qdrantClient = new QdrantClient({ url: this.QDRANT_URL });

  mongoNoteCollection!: Collection<note>;

  constructor(QdrantCollection: string) {
    this.NOTE_COLECTION_NAME = QdrantCollection;
    this.initDB();
  }

  async initDB() {
    const { db, client } = await connectToDatabase();
    this.mongoNoteCollection = db.collection<note>('note');
  }

  embedInstance = new OpenAIEmbeddings({
    model: 'text-embedding-3-large',
    openAIApiKey: 'sk-QcY6be4838a6e61d6f01028396cfbb5ed2459b8b34crCNNQ',
    configuration: {
      baseURL: 'https://api.gptsapi.net/v1',
    },
  });

  /**
   * 将数组分成多个小批
   */
  chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 删除 Qdrant 中的指定集合
   */
  async deleteCollection(collectionName: string): Promise<void> {
    const qdrantClient = new QdrantClient({ url: this.QDRANT_URL });
    try {
      const result = await qdrantClient.deleteCollection(collectionName);
      console.log(`删除集合 ${collectionName} 成功:`, result);
    } catch (error) {
      console.error(`删除集合 ${collectionName} 出错:`, error);
    }
  }

  /**
   * 批量上传已完成嵌入的笔记数据
   * 先对每个待上传的嵌入记录进行过滤，如果 Qdrant 中已存在则跳过
   */
  async saveEmbeddedNotesToQdrant(embeddedNotes: EmbeddedNote[]) {
    console.log(`准备处理 ${embeddedNotes.length} 条嵌入笔记`);

    // 1. 验证输入向量
    const validEmbeddedNotes = embeddedNotes.filter((note) => {
      if (!note.embedding || note.embedding.length === 0) {
        console.warn(`笔记 ${note.oid} 的嵌入为空，跳过`);
        return false;
      }

      if (note.embedding.every((v) => v === 0)) {
        console.warn(`笔记 ${note.oid} 的嵌入全为零，跳过`);
        return false;
      }

      if (note.embedding.some((v) => isNaN(v))) {
        console.warn(`笔记 ${note.oid} 的嵌入包含 NaN 值，跳过`);
        return false;
      }

      return true;
    });

    console.log(
      `验证后有效笔记: ${validEmbeddedNotes.length}/${embeddedNotes.length}`,
    );

    if (validEmbeddedNotes.length === 0) {
      console.log('没有有效的嵌入笔记需要处理');
      return;
    }

    // 2. 检查记录是否已存在（分批并行处理以提高效率）
    const batchSize = 20; // 并行检查的批次大小
    const allNewPoints: {
      id: any;
      vector: number[];
    }[] = [];

    for (let i = 0; i < validEmbeddedNotes.length; i += batchSize) {
      const batch = validEmbeddedNotes.slice(i, i + batchSize);
      console.log(
        `检查批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(validEmbeddedNotes.length / batchSize)}`,
      );

      const batchPoints = await Promise.all(
        batch.map(async (note) => {
          try {
            const existingRecords = await this.searchRecordsByMetadata(
              'oid',
              note.oid,
              this.NOTE_COLECTION_NAME,
              1,
            );
            if (existingRecords.length === 0) {
              return {
                id: note.oid,
                vector: note.embedding,
              };
            }
            return null;
          } catch (error) {
            console.error(`检查笔记 ${note.oid} 是否存在时出错:`, error);
            return null;
          }
        }),
      );

      allNewPoints.push(...batchPoints.filter((point) => point !== null));
    }

    if (allNewPoints.length === 0) {
      console.log('没有新的嵌入点需要上传至 Qdrant');
      return;
    }

    console.log(`需要上传 ${allNewPoints.length} 个新点`);

    // 3. 分批上传数据
    const uploadBatchSize = 50; // 每批上传的记录数
    let successCount = 0;
    let failedBatches = [];

    for (let i = 0; i < allNewPoints.length; i += uploadBatchSize) {
      const uploadBatch = allNewPoints.slice(i, i + uploadBatchSize);
      const batchNumber = Math.floor(i / uploadBatchSize) + 1;
      const totalBatches = Math.ceil(allNewPoints.length / uploadBatchSize);

      console.log(
        `上传批次 ${batchNumber}/${totalBatches}，包含 ${uploadBatch.length} 个点`,
      );

      try {
        // 添加超时控制
        const upsertPromise = this.qdrantClient.upsert(
          this.NOTE_COLECTION_NAME,
          {
            points: uploadBatch as any,
            wait: true,
          },
        );

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('上传超时')), 30000),
        );

        await Promise.race([upsertPromise, timeoutPromise]);

        // 验证本批次上传的向量
        if (uploadBatch.length > 0) {
          // 随机选择一个点进行验证
          const randomIndex = Math.floor(Math.random() * uploadBatch.length);
          const samplePointId = uploadBatch[randomIndex].id;

          const retrievedPoint = await this.qdrantClient.retrieve(
            this.NOTE_COLECTION_NAME,
            {
              ids: [samplePointId],
              with_vector: true,
            },
          );

          if (retrievedPoint.length === 0) {
            throw new Error(`验证失败: 无法检索到点 ${samplePointId}`);
          }

          const vector = retrievedPoint[0].vector as number[];
          if (!vector || vector.length === 0 || vector.every((v) => v === 0)) {
            throw new Error(`验证失败: 点 ${samplePointId} 的向量为空或全零`);
          }

          console.log(`批次 ${batchNumber} 验证成功`);
        }

        successCount += uploadBatch.length;
        console.log(
          `成功上传批次 ${batchNumber}/${totalBatches}，总进度: ${successCount}/${allNewPoints.length}`,
        );

        // 添加短暂延迟，避免请求过于频繁
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`批次 ${batchNumber} 上传失败:`, error);
        failedBatches.push({
          batchNumber,
          startIndex: i,
          endIndex: i + uploadBatch.length - 1,
          reason: error,
        });

        // 添加更长的延迟，让服务器有时间恢复
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 如果连续失败超过3次，中断上传
        if (
          failedBatches.length >= 3 &&
          failedBatches
            .slice(-3)
            .every((b) => (b.reason as any).includes('验证失败'))
        ) {
          console.error('连续3次验证失败，中断上传过程');
          break;
        }
      }
    }

    // 4. 最终验证
    try {
      // 随机抽样检查多个点
      const sampleSize = Math.min(5, allNewPoints.length);
      const sampleIndices = Array.from({ length: sampleSize }, () =>
        Math.floor(Math.random() * allNewPoints.length),
      );

      const sampleIds = sampleIndices.map((index) => allNewPoints[index].id);
      const retrievedPoints = await this.qdrantClient.retrieve(
        this.NOTE_COLECTION_NAME,
        {
          ids: sampleIds,
          with_vector: true,
        },
      );

      // 检查每个样本点
      for (const point of retrievedPoints) {
        const vector = point.vector as number[];
        if (!vector || vector.length === 0 || vector.every((v) => v === 0)) {
          throw new Error(`最终验证失败: 点 ${point.id} 的向量为空或全零`);
        }
      }

      console.log(
        `最终验证成功: 所有 ${retrievedPoints.length} 个样本点的向量都有效`,
      );
    } catch (error) {
      console.error('最终验证失败:', error);
      throw new Error(`上传过程完成但最终验证失败: ${error}`);
    }

    return {
      total: embeddedNotes.length,
      valid: validEmbeddedNotes.length,
      newPoints: allNewPoints.length,
      uploaded: successCount,
      failed: allNewPoints.length - successCount,
      failedBatches,
    };
  }

  /**
   * 语义检索
   * @param query 查询文本
   */
  async queryNote(
    query: string,
    limit: number,
  ): Promise<
    {
      pageContent: string;
      metadata: {
        score: number;
        id: string;
      };
    }[]
  > {
    const queryEmbedding = await this.embedInstance.embedQuery(query);

    const results = await this.qdrantClient.query(this.NOTE_COLECTION_NAME, {
      query: queryEmbedding,
      params: {
        hnsw_ef: 1024,
        exact: true,
        quantization: {
          rescore: true,
          oversampling: 2.0,
        },
      },
      limit: limit,
      score_threshold: 0.5,
    });

    const { client, db } = await connectToDatabase();
    const noteCollection = db.collection<note>('note');

    // const results = await vectorStore.similaritySearchWithScore(query, limit);
    const documents = await Promise.all(
      results.points.map(async (hit) => {
        const noteId = hit.id as unknown as string;
        const note = await noteCollection.findOne({ oid: noteId });
        if (note) {
          const doc = {
            pageContent: note.content[note.content.length - 1].fileContent,
            metadata: {
              fileName: note.fileName,
              score: hit.score,
              id: noteId,
              ...note.metaData,
            },
          };
          return doc;
        }
        return {
          pageContent: '',
          metadata: {
            score: 0,
            id: '',
          },
        };
      }),
    );
    return documents;
  }

  /**
   * 根据传入的向量进行语义检索，返回结果结构与 queryNote 保持一致
   * @param vector 检索时使用的向量
   * @param limit 返回结果的数量
   */
  async queryNoteByVector(
    vector: number[],
    limit: number,
  ): Promise<
    {
      pageContent: string;
      metadata: {
        fileName?: string;
        score: number;
        id: string;
        [key: string]: any;
      };
    }[]
  > {
    // 从 Qdrant 中现有集合里加载向量存储

    const { client, db } = await connectToDatabase();
    const noteCollection = db.collection<note>('note');

    // 传入向量进行相似性检索
    const results = await this.qdrantClient.query(this.NOTE_COLECTION_NAME, {
      query: vector,
      params: {
        hnsw_ef: 100000,
        exact: true,
      },
      limit: 3,
    });

    // 对检索结果遍历映射，返回统一结构的结果
    const documents = await Promise.all(
      results.points.map(async (hit) => {
        // hit[0] 为文档对象，hit[1] 为相似度得分
        const noteId = hit.id as string;
        const note = await noteCollection.findOne({ oid: noteId });
        if (note) {
          return {
            pageContent: note.content[note.content.length - 1].fileContent,
            metadata: {
              fileName: note.fileName,
              score: hit.score,
              id: noteId,
              ...note.metaData,
            },
          };
        }
        return {
          pageContent: '',
          metadata: {
            score: 0,
            id: '',
          },
        };
      }),
    );
    return documents;
  }

  async ensureCollectionExists(
    collectionName: string,
    distance: string = 'Cosine',
  ) {
    // 从环境变量获取 Qdrant 地址或使用默认值
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    const client = new QdrantClient({ url: qdrantUrl });

    try {
      // 获取所有集合信息
      const collectionsResponse = await client.getCollections();
      // collectionsResponse 中包含 collections 数组
      const collections = collectionsResponse.collections || [];

      // 判断目标集合是否存在
      const exists = collections.find(
        (col: { name: string }) => col.name === collectionName,
      );
      if (exists) {
        console.log(`集合 ${collectionName} 已存在。`);
        return;
      }

      console.log(`集合 ${collectionName} 不存在，开始创建...`);
      // 调用创建集合接口，新集合内向量维度和距离计算方式根据实际情况配置
      const createResponse = await client.createCollection(collectionName, {
        vectors: {
          size: await this.checkEmbeddingDimension(),
          distance: 'Cosine',
          quantization_config: null,
        },
        optimizers_config: {
          default_segment_number: 10,
          indexing_threshold: 1000000,
          memmap_threshold: 1000000,
          vacuum_min_vector_number: 1000000,
        },
      });
      console.log(`集合 ${collectionName} 创建成功：`, createResponse);
    } catch (error) {
      console.error('检查或创建集合时发生错误：', error);
    }
  }

  /**
   * 检查 embedding 向量长度
   * @returns 当前embedding实例的嵌入长度
   */
  async checkEmbeddingDimension() {
    const query = '请介绍一下 LangChain';
    const vector = await this.embedInstance.embedQuery(query);

    console.log('生成的向量长度：', vector.length);
    return vector.length;
  }

  /**
   * 根据 metadata 过滤条件搜索记录
   */
  async searchRecordsByMetadata(
    key: string,
    value: string | number | boolean,
    collectionName: string,
    limit: number = 10,
  ): Promise<any[]> {
    const client = new QdrantClient({
      url: this.QDRANT_URL,
    });

    const filter = {
      must: [
        {
          key,
          match: { value },
        },
      ],
    };

    const response = await client.scroll(collectionName, {
      filter,
      limit,
      with_vector: true,
    });

    return response.points;
  }

  async listCollections() {
    try {
      const response = await this.qdrantClient.getCollections();
      console.log('Collections in Qdrant:', response);
    } catch (error) {
      console.error('Error fetching collections:', error);
    }
  }

  async searchById(id: string) {
    return await this.qdrantClient.retrieve(this.NOTE_COLECTION_NAME, {
      ids: [id],
      with_vector: true,
    });
  }

  /**
   * 测试指定集合的可用性
   * @param collectionName
   * @returns
   */
  async checkCollectionConnection(collectionName: string): Promise<boolean> {
    try {
      // 使用现有 qdrantClient 获取所有集合
      const response = await this.qdrantClient.getCollections();
      const collections = response.collections || [];
      const collectionExists = collections.some(
        (col: { name: string }) => col.name === collectionName,
      );
      if (collectionExists) {
        console.log(`Collection "${collectionName}" is reachable.`);
        return true;
      } else {
        console.warn(
          `Collection "${collectionName}" does not exist in Qdrant.`,
        );
        return false;
      }
    } catch (error) {
      console.error(
        `Failed to connect to Qdrant for collection "${collectionName}":`,
        error,
      );
      return false;
    }
  }

  async getCollectionCount(collectionName: string) {
    try {
      // 传入空过滤条件表示统计所有记录
      const countResponse = await this.qdrantClient.count(collectionName, {
        filter: {},
      });
      console.log(`集合 ${collectionName} 内的记录数量：`, countResponse.count);
      return countResponse.count;
    } catch (error) {
      console.error(`获取集合 ${collectionName} 数量失败:`, error);
      return null;
    }
  }

  async getRandomPoint(): Promise<{
    id: string | number;
    payload?:
      | Record<string, unknown>
      | {
          [key: string]: unknown;
        }
      | null
      | undefined;
    vector?:
      | Record<string, unknown>
      | number[]
      | number[][]
      | {
          [key: string]:
            | number[]
            | number[][]
            | {
                indices: number[];
                values: number[];
              }
            | undefined;
        }
      | null
      | undefined;
    shard_key?: string | number | Record<string, unknown> | null | undefined;
    order_value?: number | Record<string, unknown> | null | undefined;
  } | null> {
    // 初始化 Qdrant 客户端，请根据实际情况配置 URL
    const client = new QdrantClient({ url: 'http://localhost:6333' });

    // 假设这个方法能获取对应集合的点的数量
    const totalPoints: number = (await this.getCollectionCount(
      this.NOTE_COLECTION_NAME,
    )) as number;
    if (totalPoints === 0) {
      throw new Error('集合中没有点');
    }

    // 生成随机索引
    let randomIndex = Math.floor(Math.random() * totalPoints);

    // 设置每页批次大小，可根据实际情况调整
    const limit = 100;
    let cursor: string | undefined = undefined;

    while (true) {
      // 调用 scroll 接口，传入批次大小和游标（第一次调用 cursor 未定义）
      const response = await client.scroll(this.NOTE_COLECTION_NAME, {
        limit,
        cursor, // 第二次调用时传入上一次返回的 next_page_offset
      } as any);

      // 判断随机索引是否落在本批次中
      if (randomIndex < response.points.length) {
        return response.points[randomIndex];
      }

      // 若不在本批次，将随机索引递减本批次的点数，并继续后续批次
      randomIndex -= response.points.length;

      // 如果没有下一页，则直接退出（防止出现异常情况）
      if (!response.next_page_offset) {
        break;
      }
      cursor = response.next_page_offset as string;
    }

    return null;
  }

  async rebuildCollection() {
    // 1. 获取现有集合配置
    const collectionInfo = await this.qdrantClient.getCollection(
      this.NOTE_COLECTION_NAME,
    );

    // 2. 备份所有点
    const allPoints = [];
    let offset = 0;
    const limit = 1000;

    while (true) {
      const batch = await this.qdrantClient.scroll(this.NOTE_COLECTION_NAME, {
        offset: offset,
        limit: limit,
        with_vector: true,
        with_payload: true,
      });

      if (batch.points.length === 0) break;

      allPoints.push(...batch.points);
      offset += batch.points.length;

      if (batch.points.length < limit) break;
    }

    // 3. 删除旧集合
    await this.qdrantClient.deleteCollection(this.COLLECTION_NAME);

    // 4. 创建新集合，使用优化的HNSW参数
    await this.qdrantClient.createCollection(this.COLLECTION_NAME, {
      vectors: collectionInfo.config.params.vectors,
      hnsw_config: {
        m: 320, // 可以调整
        ef_construct: 10000, // 增加这个值提高索引质量
        full_scan_threshold: 100000,
      },
    });

    // 5. 重新插入所有点
    // 分批插入以避免内存问题
    const batchSize = 500;
    for (let i = 0; i < allPoints.length; i += batchSize) {
      const batch = allPoints.slice(i, i + batchSize);
      await this.qdrantClient.upsert(this.COLLECTION_NAME, {
        points: batch as any,
      });
    }

    console.log(`集合 ${this.COLLECTION_NAME} 已完全重建`);
  }

  // ... existing code ...

  /**
   * 检测 Qdrant 集合中的空向量或无效向量
   * @param sampleSize 要检查的样本大小 (0 表示检查所有向量)
   * @param threshold 判断为"接近零向量"的阈值
   * @returns 包含检测结果的详细报告
   */
  async detectEmptyVectors(sampleSize: number = 0, threshold: number = 1e-6) {
    try {
      // 获取集合信息
      const collectionInfo = await this.qdrantClient.getCollection(
        this.NOTE_COLECTION_NAME,
      );
      const totalPoints = collectionInfo.vectors_count || 0; // 确保有默认值

      if (totalPoints === 0) {
        return {
          success: true,
          message: '集合为空，没有向量可检查',
          totalPoints: 0,
          sampledPoints: 0,
          emptyVectors: [],
        };
      }

      console.log(
        `集合 ${this.NOTE_COLECTION_NAME} 包含 ${totalPoints} 个向量`,
      );

      // 确定要检查的点数量
      const pointsToCheck =
        sampleSize > 0 ? Math.min(sampleSize, totalPoints) : totalPoints;
      const isSampling = pointsToCheck < totalPoints;

      console.log(
        `将检查 ${pointsToCheck} 个向量${isSampling ? ' (抽样)' : ''}`,
      );

      // 存储空向量信息
      const emptyVectors = [];
      let processedCount = 0;
      let offset = 0;
      const batchSize = 100; // 每批获取的点数

      // 分批获取并检查向量
      while (processedCount < pointsToCheck) {
        const currentBatchSize = Math.min(
          batchSize,
          pointsToCheck - processedCount,
        );

        const response = await this.qdrantClient.scroll(
          this.NOTE_COLECTION_NAME,
          {
            offset,
            limit: currentBatchSize,
            with_vector: true,
            with_payload: true,
          },
        );

        if (response.points.length === 0) {
          break; // 没有更多点
        }

        // 检查每个向量
        for (const point of response.points) {
          const vector = point.vector as number[];

          // 检查向量是否为空或无效
          const isNull = !vector;
          const isUndefined = vector === undefined;
          const isEmptyArray = Array.isArray(vector) && vector.length === 0;
          const isZeroVector =
            Array.isArray(vector) && vector.every((v) => v === 0);
          const hasNaN = Array.isArray(vector) && vector.some((v) => isNaN(v));
          const isNearZero =
            Array.isArray(vector) &&
            vector.reduce((sum, val) => sum + Math.abs(val), 0) < threshold;

          // 计算向量统计信息
          let vectorStats = null;
          if (Array.isArray(vector) && vector.length > 0) {
            const sum = vector.reduce((a, b) => a + b, 0);
            const absSum = vector.reduce((a, b) => a + Math.abs(b), 0);
            const min = Math.min(...vector);
            const max = Math.max(...vector);

            vectorStats = {
              length: vector.length,
              sum,
              absSum,
              min,
              max,
              sample: vector.slice(0, 5),
            };
          }

          // 如果发现空向量或无效向量，记录信息
          if (
            isNull ||
            isUndefined ||
            isEmptyArray ||
            isZeroVector ||
            hasNaN ||
            isNearZero
          ) {
            console.log('empty vector');
            emptyVectors.push({
              id: point.id,
              isNull,
              isUndefined,
              isEmptyArray,
              isZeroVector,
              hasNaN,
              isNearZero,
              vectorStats,
              payload: point.payload,
            });
          }

          processedCount++;
        }

        offset += response.points.length;

        // 打印进度
        if (processedCount % 500 === 0 || processedCount === pointsToCheck) {
          console.log(`已处理 ${processedCount}/${pointsToCheck} 个向量`);
        }
      }

      // 生成报告
      const emptyVectorPercentage =
        (emptyVectors.length / processedCount) * 100;

      return {
        success: true,
        message: `检查完成。发现 ${emptyVectors.length} 个空向量或无效向量，占检查总数的 ${emptyVectorPercentage.toFixed(2)}%`,
        totalPoints,
        sampledPoints: processedCount,
        emptyVectorsCount: emptyVectors.length,
        emptyVectorPercentage: emptyVectorPercentage,
        emptyVectors: emptyVectors.slice(0, 100), // 限制返回的详细信息数量
        hasEmptyVectors: emptyVectors.length > 0,
      };
    } catch (error) {
      console.error('检测空向量时出错:', error);
      return {
        success: false,
        message: `检测失败: ${error}`,
        error,
      };
    }
  }

  /**
   * 修复集合中的空向量
   * @param emptyVectorIds 需要修复的空向量ID数组
   * @param regenerateStrategy 重新生成向量的策略，可以是'delete'(删除)或'regenerate'(重新生成)
   */
  async fixEmptyVectors(
    emptyVectorIds: (string | number)[],
    regenerateStrategy: 'delete' | 'regenerate' = 'regenerate',
  ) {
    if (emptyVectorIds.length === 0) {
      return { success: true, message: '没有需要修复的向量', fixed: 0 };
    }

    console.log(
      `开始修复 ${emptyVectorIds.length} 个空向量，策略: ${regenerateStrategy}`,
    );

    let fixedCount = 0;
    let failedCount = 0;

    try {
      if (regenerateStrategy === 'delete') {
        // 删除空向量
        for (let i = 0; i < emptyVectorIds.length; i += 100) {
          const batch = emptyVectorIds.slice(i, i + 100);
          await this.qdrantClient.delete(this.NOTE_COLECTION_NAME, {
            points: batch,
            wait: true,
          });
          fixedCount += batch.length;
          console.log(`已删除 ${fixedCount}/${emptyVectorIds.length} 个空向量`);
        }

        return {
          success: true,
          message: `成功删除了 ${fixedCount} 个空向量`,
          fixed: fixedCount,
          failed: failedCount,
        };
      } else {
        // 重新生成向量
        const { client, db } = await connectToDatabase();
        const noteCollection = db.collection<note>('note');

        for (const id of emptyVectorIds) {
          try {
            // 获取点的payload以找到原始记录ID
            const pointInfo = await this.qdrantClient.retrieve(
              this.NOTE_COLECTION_NAME,
              {
                ids: [id],
                with_payload: true,
              },
            );

            if (pointInfo.length === 0) {
              console.warn(`找不到ID为 ${id} 的点`);
              failedCount++;
              continue;
            }

            const oid = pointInfo[0].payload?.oid as string;
            if (!oid) {
              console.warn(`点 ${id} 没有oid字段`);
              failedCount++;
              continue;
            }

            // 从MongoDB获取原始笔记
            const note = await noteCollection.findOne({ oid });
            if (!note) {
              console.warn(`找不到oid为 ${oid} 的笔记`);
              failedCount++;
              continue;
            }

            // 获取笔记内容
            const content = note.content[note.content.length - 1]?.fileContent;
            if (!content) {
              console.warn(`笔记 ${oid} 没有内容`);
              failedCount++;
              continue;
            }

            // 重新生成嵌入
            const newEmbedding = await this.embedInstance.embedQuery(content);

            // 验证新生成的嵌入
            if (
              !newEmbedding ||
              newEmbedding.length === 0 ||
              newEmbedding.every((v) => v === 0)
            ) {
              console.error(`为笔记 ${oid} 生成的嵌入无效`);
              failedCount++;
              continue;
            }

            // 更新Qdrant中的向量
            await this.qdrantClient.upsert(this.NOTE_COLECTION_NAME, {
              points: [
                {
                  id,
                  vector: newEmbedding,
                  payload: pointInfo[0].payload,
                },
              ],
              wait: true,
            });

            fixedCount++;
            if (fixedCount % 10 === 0) {
              console.log(
                `已修复 ${fixedCount}/${emptyVectorIds.length} 个空向量`,
              );
            }
          } catch (error) {
            console.error(`修复向量 ${id} 时出错:`, error);
            failedCount++;
          }
        }

        return {
          success: true,
          message: `成功修复了 ${fixedCount} 个空向量，失败 ${failedCount} 个`,
          fixed: fixedCount,
          failed: failedCount,
        };
      }
    } catch (error) {
      console.error('修复空向量时出错:', error);
      return {
        success: false,
        message: `修复失败: ${error}`,
        fixed: fixedCount,
        failed: failedCount + (emptyVectorIds.length - fixedCount),
        error,
      };
    }
  }

  /**
   * 检测并修复集合中的空向量
   * @param sampleSize 要检查的样本大小 (0 表示检查所有向量)
   * @param autoFix 是否自动修复发现的空向量
   * @param fixStrategy 修复策略，'delete'或'regenerate'
   */
  async detectAndFixEmptyVectors(
    sampleSize: number = 0,
    autoFix: boolean = false,
    fixStrategy: 'delete' | 'regenerate' = 'regenerate',
  ) {
    // 1. 检测空向量
    const detectionResult = await this.detectEmptyVectors(sampleSize);

    if (!detectionResult.success) {
      return {
        success: false,
        message: `检测失败: ${detectionResult.message}`,
        detection: detectionResult,
        fix: null,
      };
    }

    console.log(detectionResult.message);

    // 2. 如果没有空向量或不需要自动修复，直接返回
    if (!detectionResult.hasEmptyVectors || !autoFix) {
      return {
        success: true,
        message: detectionResult.hasEmptyVectors
          ? `发现 ${detectionResult.emptyVectorsCount} 个空向量，但未执行修复`
          : '没有发现空向量',
        detection: detectionResult,
        fix: null,
      };
    }

    // 3. 自动修复空向量
    const emptyVectorIds = detectionResult.emptyVectors.map((v) => v.id);
    const fixResult = await this.fixEmptyVectors(emptyVectorIds, fixStrategy);

    return {
      success: fixResult.success,
      message: `检测到 ${detectionResult.emptyVectorsCount} 个空向量，${fixResult.message}`,
      detection: detectionResult,
      fix: fixResult,
    };
  }

  // ... existing code ...
}
