import { extractNoteTitles, getNoteFileFromTitle } from '../utils';
import { BaseCallbackConfig } from '@langchain/core/callbacks/manager';
import { Document } from '@langchain/core/documents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { BaseRetriever } from '@langchain/core/retrievers';
import milvusCollectionOperator, {
  MilvusDocument,
} from '@/lib/milvus/milvusCollectionOperator';
import { getChatModel, getEmbeddings } from '../provider';

import * as dotenv from 'dotenv';
dotenv.config();

export interface retrieveTextBookSource {
  title: string;
  chunkId: string;
  score: number;
  scoreSource?: 'vector' | 'bm25' | 'hybrid';
  combinedScore?: number;
}

export interface NotebookRetrieverOptions {
  minSimilarityScore: number;
  maxK: number;
  salientTerms: string[];
  timeRange?: { startTime: number; endTime: number };
  textWeight?: number;
  returnAll?: boolean;
  useRerankerThreshold?: number;
  useBM25?: boolean;
  bm25Weight?: number;
  maxBM25Results?: number;
  partitionNames?: string[];
  expr?: string;
  vectorWeight?: number;
  hybridSearch?: boolean;
}

export class NotebookRetriever extends BaseRetriever {
  public lc_namespace = ['baseline_retriever'];

  private queryRewritePrompt: ChatPromptTemplate;
  notebookCollectionName: string;

  constructor(
    notebookCollectionName: string,
    public options: NotebookRetrieverOptions,
  ) {
    super();
    this.queryRewritePrompt = ChatPromptTemplate.fromTemplate(
      "Please write a passage to answer the question. If you don't know the answer, just make up a passage. \nQuestion: {question}\nPassage:",
    );
    this.notebookCollectionName = notebookCollectionName;
  }

  private async combineResults(
    vectorResults: Document<retrieveTextBookSource>[],
    bm25Results: Document<retrieveTextBookSource>[],
  ): Promise<Document<retrieveTextBookSource>[]> {
    if (!this.options.useBM25 || !this.options.hybridSearch) {
      return vectorResults;
    }

    const combined = new Map<string, Document<retrieveTextBookSource>>();
    const vectorWeight = this.options.vectorWeight || 0.7;
    const bm25Weight = this.options.bm25Weight || 0.3;

    // Add vector results with weighted scores
    vectorResults.forEach((doc) => {
      const score = doc.metadata.score * vectorWeight;
      combined.set(doc.metadata.chunkId, {
        ...doc,
        metadata: {
          ...doc.metadata,
          combinedScore: score,
          scoreSource: 'vector',
        },
      });
    });

    // Add BM25 results with weighted scores
    bm25Results.forEach((doc) => {
      const existing = combined.get(doc.metadata.chunkId);
      const score = doc.metadata.score * bm25Weight;

      if (existing) {
        existing.metadata.combinedScore! += score;
        existing.metadata.scoreSource = 'hybrid';
      } else {
        combined.set(doc.metadata.chunkId, {
          ...doc,
          metadata: {
            ...doc.metadata,
            combinedScore: score,
            scoreSource: 'bm25',
          },
        });
      }
    });

    // Convert to array and sort by combined score
    return Array.from(combined.values())
      .sort(
        (a, b) =>
          (b.metadata.combinedScore || 0) - (a.metadata.combinedScore || 0),
      )
      .slice(0, this.options.maxK);
  }

  public async getRelevantDocuments(
    query: string,
    config?: BaseCallbackConfig,
  ): Promise<Document<retrieveTextBookSource>[]> {
    // Extract note titles from query
    const noteTitles = extractNoteTitles(query);

    let rewrittenQuery = query;
    try {
      rewrittenQuery = await this.rewriteQuery(query);
    } catch (error) {
      console.log('Query rewrite error');
      throw error;
    }

    // Perform vector similarity search
    const vectorResults = await this.getRetrievedChunks(
      rewrittenQuery,
      this.options.salientTerms,
      this.options.textWeight,
    );

    // Get BM25 results if enabled
    let bm25Results: Document<retrieveTextBookSource>[] = [];
    if (this.options.useBM25) {
      bm25Results = await this.getBM25Results(
        query,
        this.options.maxBM25Results || this.options.maxK,
      );
    }

    // Combine results if hybrid search enabled
    const combinedResults = await this.combineResults(
      vectorResults,
      bm25Results,
    );

    if (combinedResults.length === 0) {
      return [];
    }

    return combinedResults;
  }

  private async rewriteQuery(query: string): Promise<string> {
    try {
      const promptResult = await this.queryRewritePrompt.format({
        question: query,
      });
      const chatModel = getChatModel()('gpt-4o-mini');
      const rewrittenQueryObject = await chatModel.invoke(promptResult);

      // 直接返回内容
      if (rewrittenQueryObject && 'content' in rewrittenQueryObject) {
        return rewrittenQueryObject.content as string;
      }
      if (process.env.NODE_ENV !== 'production') {
        console.warn('意外的重写查询格式。回退到原始查询。');
      }
      return query;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('重写查询出错:', error);
      } else {
        console.error('重写查询出错');
      }
      return query;
    }
  }

  // private async getExplicitChunks(noteTitles: string[]): Promise<Document[]> {
  //   // 如果没有明确的笔记标题，返回空数组
  //   if (noteTitles.length === 0) {
  //     return [];
  //   }

  //   const {client, db} = await connectToDatabase()
  //   const embeddings = getEmbeddings("text-embedding-3-large");
  //   const milvusClient = new milvusCollectionOperator(process.env.NOTE_COLLECTION_NAME ?? "note", embeddings);
  //   const noteCollection = db.collection<note>("note")
  //   const notes = await noteCollection.find({fileName: {$in: noteTitles}}).toArray()

  //   const explicitChunks: Document[] = [];
  //   for (const file of notes) {
  //     // 查询Milvus中与笔记相关的数据
  //     const searchResults = await milvusClient.searchSimilarDocuments({
  //       filter: `fileId == "${file.oid}"`,
  //       outputFields: ['oid', 'title', 'content', 'metadata']
  //     });

  //     // 从结果创建文档
  //     if (searchResults && searchResults.documents.length > 0) {
  //       for (const doc of searchResults.documents) {
  //         const metadata = typeof doc.metadata === 'string'
  //           ? JSON.parse(doc.metadata)
  //           : doc.metadata || {};

  //         explicitChunks.push(
  //           new Document({
  //             pageContent: doc.content || "",
  //             metadata: {
  //               ...metadata,
  //               fileName: file.fileName,
  //               oid: file.oid,
  //               score: 1.0, // 为明确引用的笔记设置最高分数
  //               source: "explicit"
  //             },
  //           })
  //         );
  //       }
  //     }
  //   }
  //   return explicitChunks;
  // }

  public async getBM25Results(
    query: string,
    limit: number,
  ): Promise<Document<retrieveTextBookSource>[]> {
    // TODO: Connect to actual BM25 search service
    // For now return mock results with random scores
    return Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
      pageContent: `BM25 result ${i} for query: ${query}`,
      metadata: {
        title: `BM25 Doc ${i}`,
        chunkId: `bm25-${i}`,
        score: Math.random(),
        scoreSource: 'bm25',
      },
    }));
  }

  public async getRetrievedChunks(
    query: string,
    salientTerms: string[],
    textWeight?: number,
  ): Promise<Document<retrieveTextBookSource>[]> {
    try {
      // 使用Milvus进行语义搜索
      const milvusInstance = new milvusCollectionOperator(
        this.notebookCollectionName,
      );

      const searchResults = await milvusInstance.searchSimilarDocuments(query, {
        limit: this.options.maxK,
        outputFields: ['oid', 'title', 'content'],
        partitionNames: this.options.partitionNames,
        expr: this.options.expr,
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log(`Milvus搜索返回 ${searchResults.documents.length} 个结果`);
      }

      // 从结果创建文档
      const documents = searchResults.documents.map(
        (doc: MilvusDocument, index: number) => {
          // console.log("mdoc",doc )
          return new Document<retrieveTextBookSource>({
            pageContent: doc.content || '',
            metadata: {
              score: searchResults.distances[index],
              // source: "vector_search",
              // includeInContext: true,
              chunkId: doc.oid,
              title: doc.partition_key || 'Untitle',
            },
          });
        },
      );

      // console.log(`分数: ${documents.map((doc: { metadata: { score: any; }; }) => doc.metadata.score).join(', ')}`);

      return documents;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Milvus搜索出错:', error);
      } else {
        console.error('Milvus搜索出错');
      }
      return [];
    }
  }

  private async convertQueryToVector(query: string): Promise<number[]> {
    const embeddingsAPI = getEmbeddings()('text-embedding-3-large');
    const vector = await embeddingsAPI.Embeddings.embedQuery(query);
    if (vector.length === 0) {
      throw new Error('查询嵌入返回空向量');
    }
    return vector;
  }

  private generateDateRange(startTime: number, endTime: number): string[] {
    const dateRange: string[] = [];
    const start = new Date(startTime);
    const end = new Date(endTime);

    const current = new Date(start);
    while (current <= end) {
      dateRange.push(current.toLocaleDateString('en-CA'));
      current.setDate(current.getDate() + 1);
    }

    return dateRange;
  }

  private filterAndFormatChunks(
    retrievedChunks: Document[],
    explicitChunks: Document[],
  ): Document[] {
    const threshold = this.options.minSimilarityScore;

    // 过滤向量搜索获取的块，保留分数高于阈值的块
    const filteredChunks = retrievedChunks.filter((chunk) => {
      const score = chunk.metadata.score;
      if (typeof score !== 'number' || isNaN(score)) {
        return true; // 保留分数为NaN的块
      }
      return score >= threshold;
    });

    // 组合明确块和过滤后的检索块，移除重复项（基于页面内容）
    const uniqueChunks = new Set<string>(
      explicitChunks.map((chunk) => chunk.pageContent),
    );
    const combinedChunks: Document[] = [...explicitChunks];

    for (const chunk of filteredChunks) {
      const chunkContent = chunk.pageContent;
      if (!uniqueChunks.has(chunkContent)) {
        uniqueChunks.add(chunkContent);
        combinedChunks.push(chunk);
      }
    }

    // 按分数排序（从高到低）
    return combinedChunks.sort((a, b) => {
      const scoreA =
        typeof a.metadata.score === 'number' ? a.metadata.score : 0;
      const scoreB =
        typeof b.metadata.score === 'number' ? b.metadata.score : 0;
      return scoreB - scoreA;
    });
  }
}
