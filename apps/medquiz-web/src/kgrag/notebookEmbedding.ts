import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import Progress from 'progress';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import dotenv from 'dotenv';
import { embedding } from '@/kgrag/lib/embedding';
import { Document } from '@langchain/core/documents';
import { EmbeddedTextChunk } from '../types/textData.types';
import milvusCollectionOperator, {
  MilvusDocument,
} from '@/lib/milvus/milvusCollectionOperator';
dotenv.config();

export interface PDF_Chunk {
  pdf_name: string;
  content: string;
  source: {
    pagination: number;
    presigned_url: string;
  }[];
}

/**
 * @deprecated Migrate to textbookEmbedding
 */
export default class TextFileEmbedding extends milvusCollectionOperator {
  private bm25Function: {
    name: string;
    description: string;
    type: string;
    input_field_names: string[];
    output_field_names: string[];
    params: Record<string, any>;
  };

  CHUNK_SIZE: number = 25;
  CHUNK_OVERLAP: number = 200;
  EMBEDDING_BATCH_SIZE: number = 100;
  MILVUS_SAVE_BATCH_SIZE: number = 100;
  textSplitter: RecursiveCharacterTextSplitter;
  collectionName: string;

  constructor(
    collectionName: string,
    chunkSize?: number,
    chunkOverlap?: number,
  ) {
    super(collectionName);
    this.collectionName = collectionName;
    if (chunkSize) this.CHUNK_SIZE = chunkSize;
    if (chunkOverlap) this.CHUNK_OVERLAP = chunkOverlap;
    this.EMBEDDING_BATCH_SIZE = parseInt(
      process.env.EMBEDDING_BATCH_SIZE || '100',
    );
    this.MILVUS_SAVE_BATCH_SIZE = parseInt(
      process.env.MILVUS_SAVE_BATCH_SIZE || '100',
    );
    this.bm25Function = {
      name: 'text_bm25_emb',
      description: 'bm25 function',
      type: 'BM25',
      input_field_names: ['text_content'],
      output_field_names: ['bm25_vector'],
      params: {},
    };

    // 初始化文本分割器
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.CHUNK_SIZE,
      chunkOverlap: this.CHUNK_OVERLAP,
    });
  }

  /**
   * 从文件读取文本内容
   */
  async readTextFromFile(filePath: string): Promise<string> {
    try {
      const stats = fs.statSync(filePath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      console.log(`文件大小: ${fileSizeInMB.toFixed(2)} MB`);

      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      console.error(`读取文件失败: ${error}`);
      throw error;
    }
  }

  /**
   * 处理单个文本文件：分割、嵌入并同步到Milvus
   * @param filePath 文本文件路径
   * @param metadata 可选的元数据
   */
  async processTextFile(filePath: string, metadata: any = {}) {
    console.log(`\n====== 开始处理文本文件 ======`);
    console.log(`文件路径: ${filePath}`);

    const startTime = Date.now();

    try {
      // 确保集合存在
      console.log(`[1/5] 检查并确保Milvus集合存在...`);
      await this.ensureCollectionExists();
      console.log(`✓ 集合确认: ${this.collectionName}`);

      // 读取文件内容
      console.log(`\n[2/5] 读取文件内容...`);
      const text = await this.readTextFromFile(filePath);
      console.log(`✓ 文件读取完成，字符数: ${text.length.toLocaleString()}`);

      // 生成文件ID
      const fileId = uuidv4();
      const fileName = path.basename(filePath);

      // 准备元数据
      const fileMetadata = {
        ...metadata,
        fileName,
        filePath,
        fileId,
        processedAt: new Date().toISOString(),
        charCount: text.length,
      };

      // 分割文本
      console.log(`\n[3/5] 分割文本为块...`);
      console.log(`块大小: ${this.CHUNK_SIZE}, 重叠: ${this.CHUNK_OVERLAP}`);

      const splitStartTime = Date.now();
      const chunks = await this.splitTextIntoChunks(text, fileMetadata);
      const splitEndTime = Date.now();

      console.log(
        `✓ 文本已分割为 ${chunks.length.toLocaleString()} 个块 (耗时: ${((splitEndTime - splitStartTime) / 1000).toFixed(2)}秒)`,
      );
      console.log(
        `平均块大小: ${(text.length / chunks.length).toFixed(0)} 字符`,
      );

      // 批量处理嵌入
      console.log(`\n[4/5] 开始嵌入处理...`);
      const embeddingStartTime = Date.now();
      const embeddedChunks = await this.batchEmbedTextChunks(chunks, fileId);
      const embeddingEndTime = Date.now();
      console.log(
        `✓ 嵌入完成 (耗时: ${((embeddingEndTime - embeddingStartTime) / 1000).toFixed(2)}秒)`,
      );

      // 保存嵌入到Milvus
      console.log(`\n[5/5] 保存嵌入向量到Milvus...`);
      const saveStartTime = Date.now();
      await this.saveEmbeddedChunksToMilvus(embeddedChunks);
      const saveEndTime = Date.now();
      console.log(
        `✓ 保存完成 (耗时: ${((saveEndTime - saveStartTime) / 1000).toFixed(2)}秒)`,
      );

      const totalTime = (Date.now() - startTime) / 1000;
      console.log(`\n✅ 文件 ${fileName} 处理完成!`);
      console.log(`总耗时: ${totalTime.toFixed(2)}秒`);
      console.log(`处理速度: ${(text.length / totalTime).toFixed(0)} 字符/秒`);
      console.log(`文件ID: ${fileId}`);
      console.log(`======= 处理完成 =======\n`);

      return {
        fileId,
        stats: {
          fileName,
          charCount: text.length,
          chunkCount: chunks.length,
          processingTimeSeconds: totalTime,
          charactersPerSecond: Math.round(text.length / totalTime),
        },
      };
    } catch (error) {
      const totalTime = (Date.now() - startTime) / 1000;
      console.error(`\n❌ 处理失败! 耗时: ${totalTime.toFixed(2)}秒`);
      console.error(`错误信息: ${error}`);
      throw error;
    }
  }

  async pdfSplit(pdf_path: string) {}

  /**
   * 将文本分割成块
   */
  async splitTextIntoChunks(text: string, metadata: any): Promise<Document[]> {
    return await this.textSplitter.createDocuments([text], [metadata]);
  }

  /**
   * 批量嵌入文本块
   */
  async batchEmbedTextChunks(chunks: Document[], fileId: string) {
    const batches = this.chunkArray<Document>(
      chunks,
      this.EMBEDDING_BATCH_SIZE,
    );

    console.log(
      `嵌入处理分为 ${batches.length} 批次，每批 ${this.EMBEDDING_BATCH_SIZE} 个块`,
    );

    // 创建进度条 - 包含批次信息和百分比
    const bar = new Progress(
      '嵌入处理中 [:bar] :current/:total 块 (:percent) 批次:batch/:batches 速率::rate chunk/s 剩余::etas',
      {
        total: chunks.length,
        width: 30,
        complete: '=',
        incomplete: ' ',
      },
    );

    const allEmbeddedChunks: EmbeddedTextChunk[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      try {
        // 更新进度条显示当前批次
        bar.tick(0, {
          batch: i + 1,
          batches: batches.length,
        });

        const textContents = batch.map((chunk) => chunk.pageContent);
        const vectors = await Promise.all(
          textContents.map(async (content) => {
            const vector = await embedding(content);
            if (vector === null) {
              throw new Error(
                `Failed to generate embedding for content: ${content.substring(0, 50)}...`,
              );
            }
            return vector;
          }),
        );

        for (let j = 0; j < batch.length; j++) {
          const chunkId = uuidv4();

          allEmbeddedChunks.push({
            embedding: vectors[j],
            fileId: fileId,
            chunkId: chunkId,
            content: batch[j].pageContent,
            metadata: {
              ...batch[j].metadata,
              originalIndex: i * this.EMBEDDING_BATCH_SIZE + j,
              chunkIndex: allEmbeddedChunks.length,
              chunkLength: batch[j].pageContent.length,
            },
          });

          bar.tick(1, {
            batch: i + 1,
            batches: batches.length,
          });
        }

        // 每完成一个批次显示一些信息
        if (i > 0 && i % 5 === 0) {
          const progress = Math.round((i / batches.length) * 100);
          console.log(`已完成 ${progress}% (${i} / ${batches.length} 批次)`);
        }
      } catch (error) {
        console.error(`\n⚠️ 批处理嵌入失败 (批次 ${i + 1}/${batches.length})`);
        console.error(`错误详情: ${error}`);

        // 记录部分批次失败信息并尝试继续
        if (i < batches.length - 1) {
          console.log(`尝试继续处理剩余批次...`);
          continue;
        } else {
          throw error;
        }
      }
    }

    console.log(
      `\n嵌入向量生成完成，共 ${allEmbeddedChunks.length} / ${chunks.length} 个文本块成功处理`,
    );

    // 检查是否有任何块没有成功嵌入
    if (allEmbeddedChunks.length < chunks.length) {
      console.warn(
        `警告: ${chunks.length - allEmbeddedChunks.length} 个块未能成功嵌入`,
      );
    }

    return allEmbeddedChunks;
  }

  async saveEmbeddedChunksToMilvus(embeddedChunks: EmbeddedTextChunk[]) {
    const batches = this.chunkArray<EmbeddedTextChunk>(
      embeddedChunks,
      this.MILVUS_SAVE_BATCH_SIZE,
    );

    // 显示保存计划
    console.log(
      `向量存储分为 ${batches.length} 批次，每批 ${this.MILVUS_SAVE_BATCH_SIZE} 个向量`,
    );

    // 增强的进度条
    const bar = new Progress(
      '保存到Milvus [:bar] :current/:total 批次 (:percent) 速率::rate 批/s 剩余时间::etas',
      {
        total: batches.length,
        width: 30,
        complete: '█',
        incomplete: '░',
      },
    );

    let successCount = 0;
    let failedCount = 0;
    let failedBatches = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const documents = batch.map((chunk) => ({
        oid: chunk.chunkId,
        title: `chunk_${chunk.chunkId.substring(0, 8)}`,
        content: chunk.content,
        text_content: chunk.content, // For BM25 analysis
        embedding: chunk.embedding,
        bm25_vector: [], // Will be populated by BM25 function
        // metadata: JSON.stringify(chunk.metadata),
        // fileId: chunk.fileId,
        tags: [chunk.fileId, 'text_chunk'], // 使用fileId作为标签，便于按文件查询
        partition_key: chunk.metadata.partition, // 添加分区键字段
      }));

      try {
        await this.insertDocuments(documents);

        successCount += batch.length;
        bar.tick(1);

        // 每保存一定数量的批次显示进度摘要
        if (i > 0 && i % 10 === 0) {
          console.log(
            `保存进度: ${Math.round((i / batches.length) * 100)}% (${successCount} 向量)`,
          );
        }
      } catch (error) {
        failedCount += batch.length;
        failedBatches.push(i);

        console.error(`\n⚠️ 批次 ${i + 1}/${batches.length} 保存失败`);
        console.error(`错误消息: ${error}`);

        // 对于其他类型的错误，我们继续处理剩余批次
        bar.tick(1);
        console.log(`继续处理剩余批次...`);
      }
    }

    // 显示最终结果
    if (failedCount > 0) {
      console.warn(
        `\n⚠️ 部分向量保存失败: ${failedCount} 个向量未能保存 (${failedBatches.length} 个批次)`,
      );
      console.log(
        `✅ 成功保存: ${successCount} / ${embeddedChunks.length} 个向量 (${(successCount / embeddedChunks.length) * 100}%)`,
      );
    } else {
      console.log(
        `\n✅ 全部向量保存成功: ${successCount} 个向量已保存到 ${this.collectionName} 集合`,
      );
    }
  }

  /**
   * 辅助方法：将数组分成指定大小的多个批次
   */
  chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 处理目录中的所有文本文件
   * @param directoryPath 目录路径
   * @param collectionName 集合名称
   */
  async processDirectory(directoryPath: string, collectionName: string) {
    try {
      console.log(`\n====== 开始处理目录 ======`);
      console.log(`目录路径: ${directoryPath}`);
      console.log(`目标集合: ${collectionName}`);

      // 读取目录中的所有文件
      const files = fs
        .readdirSync(directoryPath)
        .filter((file) => file.endsWith('.txt'))
        .map((file) => path.join(directoryPath, file));

      console.log(`找到 ${files.length} 个文本文件`);

      // 创建进度条
      const bar = new Progress(
        '处理文件 [:bar] :current/:total (:percent) :file',
        {
          total: files.length,
          width: 30,
          complete: '=',
          incomplete: ' ',
        },
      );

      // 处理每个文件
      for (const filePath of files) {
        const fileName = path.basename(filePath);
        bar.tick(1, { file: fileName });

        try {
          // 使用文件名作为partition
          await this.processTextFile(filePath, {
            partition: fileName.replace('.txt', ''),
            source: 'notebook',
          });
        } catch (error) {
          console.error(`处理文件 ${fileName} 失败:`, error);
          continue;
        }
      }

      console.log(`\n✅ 目录处理完成! 共处理 ${files.length} 个文件`);
      console.log(`======= 处理完成 =======\n`);
    } catch (error) {
      console.error(`处理目录失败:`, error);
      throw error;
    }
  }

  /**
   * 基于文本内容进行语义搜索
   */
  async searchByText(
    query: string,
    limit: number = 5,
    useBM25: boolean = false,
  ) {
    console.log(
      `执行${useBM25 ? 'BM25' : '语义'}搜索: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`,
    );
    console.log(`集合: ${this.collectionName}, 结果限制: ${limit}`);

    const startTime = Date.now();

    let results;
    if (useBM25) {
      // BM25 search
      const searchReq = {
        collection_name: this.collectionName,
        data: [query],
        anns_field: 'bm25_vector',
        limit: limit,
        params: {
          metric_type: 'BM25',
          drop_ratio_search: 0.2,
        },
        output_fields: [
          'oid',
          'title',
          'content',
          'metadata',
          'fileId',
          'tags',
        ],
      };
      const searchRes = await this.milvusClient.search(searchReq);
      results = {
        documents: searchRes.results.map((r: any) => ({
          oid: r.id || r.oid,
          title: r.entity?.title || r.title,
          content: r.entity?.content || r.content,
          metadata: r.entity?.metadata,
          fileId: r.entity?.fileId || r.fileId,
          tags: r.entity?.tags || r.tags,
        })),
        distances: searchRes.results.map((r: any) => r.score),
      };
    } else {
      // Dense vector search
      results = await this.searchSimilarDocuments(query, {
        limit: limit,
        outputFields: ['oid', 'title', 'content', 'metadata', 'fileId', 'tags'],
      });
    }

    const endTime = Date.now();
    console.log(
      `✓ 搜索完成，找到 ${results.documents.length} 个结果 (用时: ${endTime - startTime}ms)`,
    );

    return {
      documents: results.documents,
      distances: results.distances,
    };
  }
}
