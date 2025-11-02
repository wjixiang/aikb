import milvusCollectionOperator from "@/lib/milvus/milvusCollectionOperator";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { note } from "@/types/noteData.types";
import { connectToDatabase } from "@/lib/db/mongodb";
import Progress from "progress";
import dotenv from "dotenv";
import { embeddings } from "@/lib/langchain/provider";
import { writeFileSync } from "fs";
import { MilvusDocument } from "../milvusCollectionOperator";

dotenv.config();

export default class noteEmbedding extends milvusCollectionOperator {
  CHUNK_SIZE: number = 6000;
  textSplitter: RecursiveCharacterTextSplitter;
  private readonly NOTE_COLLECTION_NAME: string;

  constructor(chunkSize?: number) {
    const collectionName = process.env.NOTE_COLLECTION_NAME as string;
    super(collectionName);
    this.NOTE_COLLECTION_NAME = collectionName;

    if (chunkSize) this.CHUNK_SIZE = chunkSize;
    this.textSplitter = RecursiveCharacterTextSplitter.fromLanguage(
      "markdown",
      {
        chunkSize: this.CHUNK_SIZE,
      },
    );
  }

  /**
   * 同步 MongoDB 的 note 集合中的所有笔记至 Milvus 并完成嵌入
   */
  async embedAllNotes() {
    const { db } = await connectToDatabase();
    const mongoNoteCollection = db.collection<note>("note");
    const documents = await mongoNoteCollection
      .find({
        "metaData.tags": { $nin: ["excalidraw"] },
      })
      .toArray();

    console.log(
      `共找到 ${documents.length} 个文档，开始逐个处理并同步到 Milvus...`,
    );

    // 确保集合存在
    await this.ensureCollectionExists();

    const bar = new Progress(":embedding :percent", {
      total: documents.length,
      width: 40,
    });

    const syncChunks = this.chunkArray<note>(documents, 50);
    let count = 0;

    for (const chunk of syncChunks) {
      const notesToEmbed: note[] = [];

      for (const e of chunk) {
        // if (!(await this.checkDocumentExists(e.oid))) {
        notesToEmbed.push(e);
        // }
        bar.tick();
      }

      if (notesToEmbed.length > 0) {
        const embeddedNotes = await this.batchEmbedNote(notesToEmbed);
        await this.saveToMilvus(embeddedNotes);
        count += notesToEmbed.length;
      }
    }
    console.log(`共处理嵌入 ${count} 个新文档。`);
  }

  /**
   * 将嵌入结果保存到Milvus
   */
  private async saveToMilvus(embeddedNotes: MilvusDocument[]) {
    const milvusDocuments: MilvusDocument[] = embeddedNotes.map((note) => ({
      oid: note.oid,
      title: note.title, // 使用oid作为主键
      content: note.content || "", // 需要从原始数据获取内容
      tags: note.tags || [],
      alias: note.alias,
      embedding: note.embedding,
      partition_key: null,
    }));

    return this.insertDocuments(milvusDocuments);
  }

  /**
   * 批量生成嵌入
   */
  async batchEmbedNote(files: note[]): Promise<MilvusDocument[]> {
    const allChunks: MilvusDocument[] = [];

    await Promise.all(
      files.map(async (file) => {
        const chunks = await this.prepareChunks(
          file.fileName,
          file.content[file.content.length - 1].fileContent,
          file.metaData.tags,
        );

        chunks.forEach((e) => {
          allChunks.push({
            title: file.fileName,
            content: e.pageContent,
            tags: file.metaData.tags,
            alias: file.metaData.alias,
            oid: file.oid,
            partition_key: null,
          });
        });
      }),
    );

    try {
      const vectors = await embeddings().Embeddings.embedDocuments(
        allChunks.map((chunk) => chunk.content),
      );

      return allChunks.map((chunk, index) => {
        const res: MilvusDocument = {
          embedding: vectors[index],
          title: chunk.title,
          content: chunk.content,
          tags: chunk.tags,
          alias: chunk.tags,
          oid: chunk.oid,
          partition_key: null,
        };
        return res;
      });
    } catch (error) {
      console.error("嵌入异常:", error);
      writeFileSync("error_chunks.json", JSON.stringify(allChunks));
      throw error;
    }
  }

  /**
   * 通用数组分块方法
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
      array.slice(i * size, i * size + size),
    );
  }

  /**
   * 文本分块处理
   */
  async prepareChunks(title: string, content: string, metadata: any) {
    return this.textSplitter.createDocuments([content], [], {
      chunkHeader: `\n\nNOTE TITLE: [[${title}]]\n\nMETADATA:${JSON.stringify(metadata)}\n\nCONTENT:\n`,
      appendChunkOverlapHeader: true,
    });
  }
}
