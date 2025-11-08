import { MongoClient, ObjectId } from 'mongodb';
import { create, insert } from '@orama/orama';

import { promises as fs } from 'fs';

import { embeddings } from '../langchain/provider';
import { Embeddings } from '@langchain/core/embeddings';

// 定义 index 中存储的文档结构
interface DocumentType {
  id: string;
  content: string;
  embedding: number[];
}

class OramaSyncService {
  private mongoClient: MongoClient;
  private dbName: string;
  private collectionName: string;
  private embeddings: Embeddings;
  private oramaIndex: any;
  // 保存 schema，后续加载索引时需要使用同样的 schema
  private schema: Record<string, any> = {
    id: 'string',
    content: 'string',
    embedding: 'number[]',
  };

  /**
   * 构造函数
   * @param mongoUri - MongoDB 的连接 URI
   * @param dbName - 数据库名称
   * @param collectionName - 集合名称
   */
  constructor(mongoUri: string, dbName: string, collectionName: string) {
    this.mongoClient = new MongoClient(mongoUri);
    this.dbName = dbName;
    this.collectionName = collectionName;
    // 初始化 embedding 模型，具体参数例如 API key 可根据需要传入环境变量或构造参数
    this.embeddings = embeddings().Embeddings;
  }

  /**
   * 初始化 Orama 搜索索引，定义文档 Schema
   */
  async initOrama(): Promise<void> {
    this.oramaIndex = create({
      schema: {
        id: 'string',
        content: 'string',
        embedding: 'number[]',
      },
    });
  }

  /**
   * 从 MongoDB 同步所有文档到 Orama 数据库，并对每个文档内容生成 embedding
   */
  async syncDocuments(): Promise<void> {
    try {
      // 连接 MongoDB
      await this.mongoClient.connect();
      const db = this.mongoClient.db(this.dbName);
      const collection = db.collection(this.collectionName);

      // 获取集合内所有文档
      const docs = await collection.find({}).toArray();
      console.log(`从 MongoDB 中获取到 ${docs.length} 条文档。`);

      // 遍历所有文档
      for (const doc of docs) {
        // 如果文档中不存在 content，则跳过
        const text = doc.content;
        if (!text) continue;

        // 使用嵌入模型生成 embedding 向量
        const vector = await this.embeddings.embedQuery(text);

        const oramaDoc: DocumentType = {
          id:
            doc._id instanceof ObjectId
              ? doc._id.toHexString()
              : String(doc._id),
          content: text,
          embedding: vector,
        };

        // 调用 insert 方法将文档插入到 Orama 索引中
        await insert(this.oramaIndex, oramaDoc);
      }
      console.log('所有文档已成功同步到 Orama 数据库。');
    } catch (error) {
      console.error('同步文档时出错：', error);
    } finally {
      await this.mongoClient.close();
    }
  }

  /**
   * 根据输入查询字符串，在 Orama 中执行查询
   * @param queryStr - 查询文本
   * @param k - 返回结果数（默认 10）
   * @returns 查询结果
   */
  async query(queryStr: string, k: number = 10): Promise<any> {
    // 计算查询文本的 embedding 向量
    const queryVector = await this.embeddings.embedQuery(queryStr);

    // 使用 orama 索引执行搜索，假设搜索函数接受 query 字符串和 vector 参数进行相似度检索
    const results = await this.oramaIndex.search(queryStr, {
      vector: queryVector,
      k,
    });
    return results;
  }

  /**
   * 将当前的 Orama 索引状态保存到本地文件
   * @param filePath - 保存文件的路径
   */
  async saveIndex(filePath: string): Promise<void> {
    try {
      // 假设 oramaIndex 提供 dump 方法来导出索引状态
      const indexDump = await this.oramaIndex.dump();
      await fs.writeFile(filePath, JSON.stringify(indexDump), 'utf-8');
      console.log(`Orama 索引已保存到 ${filePath}`);
    } catch (error) {
      console.error('保存 Orama 索引时出错：', error);
    }
  }

  /**
   * 从本地文件加载 Orama 索引状态
   * @param filePath - 加载文件的路径
   */
  async loadIndex(filePath: string): Promise<void> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const indexDump = JSON.parse(fileContent);
      // 假设 orama 提供 create 方法能接收导出的索引状态进行加载
      this.oramaIndex = create({ schema: this.schema, data: indexDump } as any);
      console.log(`Orama 索引已从 ${filePath} 加载。`);
    } catch (error) {
      console.error('加载 Orama 索引时出错：', error);
    }
  }
}

export default OramaSyncService;
