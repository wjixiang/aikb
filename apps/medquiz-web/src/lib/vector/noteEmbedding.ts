import Qdrant from './qdrant';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { EmbeddedNote, note } from '@/types/noteData.types';
import { connectToDatabase } from '../db/mongodb';
import Progress from 'progress';
import dotenv from 'dotenv';
import { embeddings } from '../langchain/provider';
import { writeFileSync } from 'fs';

dotenv.config();

/**
 * @deprecated
 */
export default class noteEmbedding extends Qdrant {
  CHUNK_SIZE: number = 6000;
  textSplitter: RecursiveCharacterTextSplitter;

  constructor(chunkSize?: number) {
    super(process.env.NOTE_COLLECTION_NAME as string);
    if (chunkSize) this.CHUNK_SIZE = chunkSize;
    // 在构造函数中初始化 textSplitter，以确保使用最新的 CHUNK_SIZE
    this.textSplitter = RecursiveCharacterTextSplitter.fromLanguage(
      'markdown',
      {
        chunkSize: this.CHUNK_SIZE,
      },
    );
  }

  /**
   * 同步 MongoDB 的 note 集合中的所有笔记至 Qdrant 并完成嵌入
   */
  async embedAllNotes() {
    const { db, client } = await connectToDatabase();
    this.mongoNoteCollection = db.collection<note>('note');
    const documents = await this.mongoNoteCollection
      .find({ 'metaData.tags': { $nin: ['excalidraw'] } })
      .toArray();
    console.log(
      `共找到 ${documents.length} 个文档，开始逐个处理并同步到 Qdrant...`,
    );

    await this.ensureCollectionExists(this.NOTE_COLECTION_NAME);

    // 创建进度条实例，total 为文档总数
    const bar = new Progress(':embedding :percent', {
      total: documents.length,
      width: 40,
    });

    const syncChunks = this.chunkArray<note>(documents, 50);
    let count = 0;
    // 遍历每个块
    for (const chunk of syncChunks) {
      const notesToEmbed: note[] = [];
      // await this.detectEmptyVectors(0)
      for (const e of chunk) {
        // 只有当记录不存在时才加入待嵌入列表
        // if (!(await this.recordExistsInPayload(this.NOTE_COLECTION_NAME || 'note', "oid", e.oid))) {
        notesToEmbed.push(e);
        // }
        bar.tick();
      }

      // if (notesToEmbed.length > 0) {
      const embeddedNotes = await this.batchEmbedNote(notesToEmbed);
      await this.saveEmbeddedNotesToQdrant(embeddedNotes);
      count += notesToEmbed.length;
      // } else {
      //   console.log("当前批次均已存在嵌入，跳过。");
      // }
    }
    console.log(`共处理嵌入 ${count} 个新文档。`);
  }

  /**
   * 检查 Qdrant 集合中是否已存在 payload 中 key 对应的指定值
   * 当存在记录时返回 true
   */
  async recordExistsInPayload(
    collectionName: string,
    key: string,
    value: string | number | boolean,
  ): Promise<boolean> {
    const filter = {
      must: [
        {
          key,
          match: { value },
        },
      ],
    };

    const response = await this.qdrantClient.scroll(collectionName, {
      filter,
      limit: 1,
    });

    // 如果返回 points 数组非空，则说明记录已存在
    return response.points.length > 0;
  }

  async batchEmbedNote(files: note[]) {
    const allChunks: Array<{ content: string; oid: string }> = [];

    // 遍历每个文件，分割文本后收集所有分块
    await Promise.all(
      files.map(async (file) => {
        const chunks = await this.prepareChunks(
          file.fileName,
          file.content[file.content.length - 1].fileContent,
          file.metaData.tags,
        );
        chunks.forEach((e) => {
          allChunks.push({
            content: e.pageContent,
            oid: file.oid,
          });
        });
      }),
    );

    // 调用嵌入服务，得到所有分块对应的向量
    try {
      const vectors = await embeddings().Embeddings.embedDocuments(
        allChunks.map((chunk) => chunk.content),
      );
      console.log(vectors[0]);
      const embeddingResult: EmbeddedNote[] = [];
      for (let j = 0; j < allChunks.length; j++) {
        try {
          embeddingResult.push({
            embedding: vectors[j],
            oid: allChunks[j].oid,
          });
        } catch (error) {
          console.log(allChunks[j], error);
        }
      }

      return embeddingResult;
    } catch (error) {
      console.log('嵌入异常', JSON.stringify(error));
      console.log(allChunks);
      writeFileSync('chunk.json', JSON.stringify(allChunks));
      throw error;
    }
  }

  /**
   * 切割原始文本
   */
  async prepareChunks(title: string, content: string, metadata: any) {
    const chunks = await this.textSplitter.createDocuments([content], [], {
      chunkHeader: `\n\nNOTE TITLE: [[${title}]]\n\nMETADATA:${JSON.stringify(metadata)}\n\nNOTE BLOCK CONTENT:\n\n`,
      appendChunkOverlapHeader: true,
    });
    return chunks;
  }
}
