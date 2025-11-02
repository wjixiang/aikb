import { Collection, Db, MongoClient } from "mongodb";
import { connectToDatabase } from "../db/mongodb";
import { note } from "@/types/noteData.types";
import * as dotenv from "dotenv";
import { embeddings } from "../langchain/provider";
dotenv.config();

export default class mongodbEmbedding {
  noteCollection!: Collection<note>;
  db!: Db;
  client!: MongoClient;
  embeddingInstance = embeddings;

  constructor() {
    // 注意：initMongodbEmbedding 是异步方法，
    // 这里调用后请确保后续操作在连接成功后执行
    this.initMongodbEmbedding().catch((err) =>
      console.error("初始化 MongoDB 嵌入模块失败：", err),
    );
  }

  /**
   * 初始化 MongoDB 嵌入模块
   */
  private async initMongodbEmbedding() {
    const { db, client } = await connectToDatabase();
    if (!process.env.MONGODB_NOTE_COLLECTION) {
      throw new Error("process.env.MONGODB_NOTE_COLLECTION empty");
    }
    this.noteCollection = db.collection<note>(
      process.env.MONGODB_NOTE_COLLECTION,
    );
    this.db = db;
    this.client = client;
  }

  /**
   * 将整个 MongoDB 中的 note 集合完全嵌入，并将 embedding 向量存储在对应 document 的 `embeddings` 字段下
   *
   * @param replace 是否覆盖既有记录。如果 false 则只计算那些 embeddings 字段不存在的 document。
   * @param batch 单个批次所包含的 document 数量
   */
  async fullNoteCollectionEmbedding(replace: boolean, batch: number) {
    await this.initMongodbEmbedding();

    // 如果不替换，仅处理没有 embeddings 的文档
    const query = replace ? {} : { embeddings: { $exists: false } };
    const cursor = this.noteCollection.find(query).batchSize(batch);

    let bulkOps = [];
    let totalProcessed = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (!doc) continue;

      // 将文档中的所有 content.fileContent 拼接为一个字符串
      const contentText = doc.content.map((c) => c.fileContent).join("");

      // 调用 embedding 函数生成向量
      let vector;
      try {
        // 假设 embeddingInstance 为一个异步函数，传入文本返回向量数组
        vector =
          await this.embeddingInstance().Embeddings.embedQuery(contentText);
      } catch (err) {
        console.error(`生成 embedding 失败，document id: ${doc._id}`, err);
        continue;
      }

      // 准备 bulkWrite 操作，将计算出的 vector 写入 embeddings 字段
      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              embeddings: {
                Embeddings: vector,
                EmbeddingModal: this.embeddingInstance().EmbeddingModal,
              },
            },
          },
        },
      });
      totalProcessed++;

      // 当达到 batch 数量时，马上执行 bulkWrite 并清空
      if (bulkOps.length === batch) {
        try {
          await this.noteCollection.bulkWrite(bulkOps);
          console.log(`处理了一批 ${bulkOps.length} 条记录。`);
        } catch (err) {
          console.error("bulkWrite 处理错误：", err);
        }
        bulkOps = [];
      }
    }

    // 如果还有剩余批次，处理最后一批
    if (bulkOps.length > 0) {
      try {
        await this.noteCollection.bulkWrite(bulkOps);
        console.log(`处理了最后一批 ${bulkOps.length} 条记录。`);
      } catch (err) {
        console.error("最后一批 bulkWrite 处理错误：", err);
      }
    }

    console.log(`总共更新了 ${totalProcessed} 条记录。`);
  }
}
