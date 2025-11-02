import { MongoClient } from "mongodb";
import { Embeddings } from "@langchain/core/embeddings";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import MilvusQuizCollectionManager from "./MilvusQuizCollectionManager";
import dotenv from "dotenv";
import { connectToDatabase } from "@/lib/db/mongodb";

dotenv.config();

interface SyncOptions {
  chunkSize?: number;
  batchSize?: number;
  filterQuery?: any;
}

export class QuizEmbeddingSync {
  private milvusManager: MilvusQuizCollectionManager;
  private embeddings: Embeddings;
  private textSplitter: RecursiveCharacterTextSplitter;

  constructor(
    embeddings: Embeddings,
    milvusManager: MilvusQuizCollectionManager,
    options: SyncOptions = {},
  ) {
    this.embeddings = embeddings;
    this.milvusManager = milvusManager;

    const chunkSize = options.chunkSize || 6000;
    this.textSplitter = RecursiveCharacterTextSplitter.fromLanguage(
      "markdown",
      {
        chunkSize,
        chunkOverlap: Math.floor(chunkSize * 0.1), // 10% 重叠
      },
    );
  }

  /**
   * 准备文档嵌入
   */
  private async prepareDocumentEmbedding(document: any) {
    // 使用 discuss 字段或其他合适的内容字段进行嵌入
    const contentToEmbed = document.analysis?.discuss || document.content || "";

    // 文本分块
    const chunks = await this.textSplitter.createDocuments([contentToEmbed]);

    // 生成分块嵌入
    const embeddings = await this.embeddings.embedDocuments(
      chunks.map((chunk) => chunk.pageContent),
    );

    return {
      oid: document._id.toString(),
      content: contentToEmbed,
      cls: document.class,
      mode: document.mode || "A1",
      unit: document.unit || null,
      source: document.source || "",
      extractedYear: document.extractedYear || null,
      tags: document.tags || [],
      embedding: embeddings[0], // 使用第一个嵌入向量
    };
  }

  /**
   * 同步所有匹配的文档
   */
  async syncDocuments(options: SyncOptions = {}) {
    const {
      batchSize = 50,
      filterQuery = {
        class: { $in: ["内科学"] },
        "analysis.discuss": { $ne: "" },
      },
    } = options;

    try {
      // 连接 MongoDB

      const { db } = await connectToDatabase();
      const collection = db.collection("quiz");

      // 确保 Milvus 集合存在
      await this.milvusManager.createCollection();

      // 获取文档总数
      const totalDocuments = await collection.countDocuments(filterQuery);
      console.log(`总文档数: ${totalDocuments}`);

      // 正确处理批量获取
      let processedCount = 0;

      // 方法1: 使用skip和limit进行分页获取
      for (let skip = 0; skip < totalDocuments; skip += batchSize) {
        // 每次查询一个新的批次，而不是在同一个游标上执行操作
        const batchDocuments = await collection
          .find(filterQuery)
          .skip(skip)
          .limit(batchSize)
          .toArray();

        if (batchDocuments.length === 0) break;

        // 准备嵌入
        const embeddedDocuments = await Promise.all(
          batchDocuments.map((doc) => this.prepareDocumentEmbedding(doc)),
        );

        // 插入到 Milvus (不要求集合已加载，避免超时问题)
        await this.milvusManager.insertDocuments(embeddedDocuments, false);

        processedCount += batchDocuments.length;
        console.log(`已处理 ${processedCount}/${totalDocuments} 个文档`);
      }

      console.log("文档同步完成");
      return processedCount;
    } catch (error) {
      console.error("同步过程中发生错误:", error);
      throw error;
    } finally {
      //   await this.mongoClient.close();
    }
  }

  /**
   * 执行相似性搜索
   */
  async performSimilaritySearch(query: string, topK: number = 5) {
    return this.milvusManager.similaritySearch(query);
  }
}

export default QuizEmbeddingSync;
