import { extractNoteTitles, getNoteFileFromTitle } from "./utils";
import { BaseCallbackConfig } from "@langchain/core/callbacks/manager";
import { Document } from "@langchain/core/documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { BaseRetriever } from "@langchain/core/retrievers";
import { connectToDatabase } from "../db/mongodb";
import { note } from "@/types/noteData.types";
import { embeddings, getChatModel, getEmbeddings } from "./provider";

import * as dotenv from "dotenv";
import milvusCollectionOperator from "../milvus/milvusCollectionOperator";
dotenv.config();

if (!process.env.NOTE_COLLECTION_NAME) {
  throw new Error("GPTSAPI_KEY 环境变量未提供！");
}

export interface HybridRetrieverOptions {
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
  vectorWeight?: number;
  keywordWeight?: number;
  stagedSearch?: boolean;
  firstStageK?: number;
}

export class NoteRetriever extends BaseRetriever {
  public lc_namespace = ["hybrid_retriever"];

  private queryRewritePrompt: ChatPromptTemplate;

  constructor(private options: HybridRetrieverOptions) {
    super();
    this.queryRewritePrompt = ChatPromptTemplate.fromTemplate(
      "Please write a passage to answer the question. If you don't know the answer, just make up a passage. \nQuestion: {question}\nPassage:",
    );
  }

  public async stagedSearch(
    query: string,
    config?: BaseCallbackConfig,
  ): Promise<Document[]> {
    if (!this.options.stagedSearch) {
      return this.getOramaChunks(
        query,
        this.options.salientTerms,
        this.options.textWeight,
      );
    }

    // First stage - broad search
    const firstStageResults = await this.getOramaChunks(
      query,
      this.options.salientTerms,
      this.options.textWeight,
      this.options.firstStageK || this.options.maxK * 2,
    );

    // Second stage - refine results
    const refinedQuery = await this.rewriteQuery(query);
    const refinedResults = await this.getOramaChunks(
      refinedQuery,
      this.options.salientTerms,
      this.options.textWeight,
      this.options.maxK,
      firstStageResults.map((d) => d.metadata.chunkId),
    );

    return refinedResults;
  }

  public combineResults(
    vectorResults: Document[],
    bm25Results: Document[],
  ): Document[] {
    if (!this.options.useBM25) {
      return vectorResults;
    }

    const combined = new Map<string, Document>();
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
          scoreSource: "vector",
        },
      });
    });

    // Add BM25 results with weighted scores
    bm25Results.forEach((doc) => {
      const existing = combined.get(doc.metadata.chunkId);
      const score = doc.metadata.score * bm25Weight;

      if (existing) {
        existing.metadata.combinedScore += score;
        existing.metadata.scoreSource = "hybrid";
      } else {
        combined.set(doc.metadata.chunkId, {
          ...doc,
          metadata: {
            ...doc.metadata,
            combinedScore: score,
            scoreSource: "bm25",
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
  ): Promise<Document[]> {
    // Extract note titles wrapped in [[]] from the query
    const noteTitles = extractNoteTitles(query);

    let rewrittenQuery = query;
    try {
      rewrittenQuery = await this.rewriteQuery(query);
    } catch (error) {
      console.log("API请求异常");
      throw error;
    }

    // Perform vector similarity search
    const vectorResults = await this.stagedSearch(rewrittenQuery, config);

    // Get BM25 results if enabled
    let bm25Results: Document[] = [];
    if (this.options.useBM25) {
      bm25Results = await this.getBM25Results(
        query,
        this.options.maxBM25Results || this.options.maxK,
      );
    }

    // Combine results
    const combinedResults = this.combineResults(vectorResults, bm25Results);

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
      const chatModel = getChatModel()("gpt-4o-mini");
      const rewrittenQueryObject = await chatModel.invoke(promptResult);

      // Directly return the content assuming it's structured as expected
      if (rewrittenQueryObject && "content" in rewrittenQueryObject) {
        return rewrittenQueryObject.content as string;
      }
      console.warn(
        "Unexpected rewrittenQuery format. Falling back to original query.",
      );
      return query;
    } catch (error) {
      console.error("Error in rewriteQuery:", error);
      // If there's an error, return the original query
      return query;
    }
  }

  // private async getExplicitChunks(noteTitles: string[]): Promise<Document[]> {
  //   const {client,db} = await connectToDatabase()
  //   const Qdrantclient = new Qdrant(process.env.NOTE_COLLECTION_NAME ?? "note")
  //   const noteCollection = db.collection<note>("note")
  //   const notes = await noteCollection.find({fileName: {$in : noteTitles}}).toArray()

  //   const explicitChunks: Document[] = [];
  //   for (const file of notes) {
  //     const hits = await Qdrantclient.queryNote(file.content[file.content.length - 1].fileContent, 10)
  //     // console.log("hitTTTTTTTTTT", hits, process.env.NOTE_COLLECTION_NAME)
  //     if (hits) {
  //       const matchingChunks = hits.map(
  //         (hit) =>
  //           new Document({
  //             pageContent: hit.pageContent,
  //             metadata: {
  //               ...hit.metadata
  //             },
  //           })
  //       );
  //       explicitChunks.push(...matchingChunks);
  //     }
  //   }
  //   return explicitChunks;
  // }

  public async getOramaChunks(
    query: string,
    salientTerms: string[],
    textWeight?: number,
    limit?: number,
    filterIds?: string[],
  ): Promise<Document[]> {
    // 如果设置了时间范围，依然使用明确查询（explicit chunks）
    // if (this.options.timeRange) {
    //   const { startTime, endTime } = this.options.timeRange;
    //   const dateRange = this.generateDateRange(startTime, endTime);
    //   const dailyNoteResults = await this.getExplicitChunks(dateRange);
    //   const dailyNoteResultsWithContext = dailyNoteResults.map((doc) => ({
    //     ...doc,
    //     metadata: {
    //       ...doc.metadata,
    //       includeInContext: true,
    //     },
    //   }));
    //   return dailyNoteResultsWithContext;
    // }

    try {
      console.log("env", process.env.NOTE_COLLECTION_NAME);
      const Instance = new milvusCollectionOperator(
        process.env.NOTE_COLLECTION_NAME ?? "note",
      );
      const Results = await Instance.searchSimilarDocuments(query, {
        limit: limit || this.options.maxK,
        expr: filterIds
          ? `chunkId in [${filterIds.map((id) => `"${id}"`).join(",")}]`
          : undefined,
      });
      // console.log("qdrantResults",qdrantResults)
      // 根据 score 过滤结果
      const filteredLength = Results.distances.filter((distance) => {
        return distance >= this.options.minSimilarityScore;
      });

      const filteredResults = Results.documents
        .splice(0, filteredLength.length)
        .map((value, index) => {
          return {
            doc: value,
            score: index,
          };
        });

      // console.log("score",)

      // 将查询结果转换为 Document 对象
      const documents = filteredResults.map((result) => {
        // console.log("pageContent",result.pageContent)
        return new Document({
          pageContent: result.doc.content,
          metadata: {
            score: result.score,
          },
        });
      });
      return documents;
    } catch (error) {
      console.error("Error in queryNote:", error);
      return [];
    }
  }

  public async getBM25Results(
    query: string,
    limit: number,
  ): Promise<Document[]> {
    // TODO: Implement BM25 retrieval
    // This should connect to a BM25 search service and return results
    // in the same Document format as vector results
    return [];
  }

  private async convertQueryToVector(query: string): Promise<number[]> {
    const embeddingsAPI = getEmbeddings()("text-embedding-3-large");
    const vector = await embeddingsAPI.Embeddings.embedQuery(query);
    if (vector.length === 0) {
      throw new Error("Query embedding returned an empty vector");
    }
    return vector;
  }

  private generateDateRange(startTime: number, endTime: number): string[] {
    const dateRange: string[] = [];
    const start = new Date(startTime);
    const end = new Date(endTime);

    const current = new Date(start);
    while (current <= end) {
      dateRange.push(current.toLocaleDateString("en-CA"));
      current.setDate(current.getDate() + 1);
    }

    return dateRange;
  }

  private filterAndFormatChunks(
    oramaChunks: Document[],
    explicitChunks: Document[],
  ): Document[] {
    const threshold = this.options.minSimilarityScore;
    // Only filter out scores that are numbers and below threshold
    const filteredOramaChunks = oramaChunks.filter((chunk) => {
      const score = chunk.metadata.score;
      if (typeof score !== "number" || isNaN(score)) {
        return true; // Keep chunks with NaN scores for now until we find out why
      }
      return score >= threshold;
    });

    // console.log("filteredOramaChunks", filteredOramaChunks)

    // Combine explicit and filtered Orama chunks, removing duplicates while maintaining order
    const uniqueChunks = new Set<string>(
      explicitChunks.map((chunk) => chunk.pageContent),
    );
    // console.log("uniqueChunks",uniqueChunks)

    const combinedChunks: Document[] = [...explicitChunks];

    for (const chunk of filteredOramaChunks) {
      const chunkContent = chunk.pageContent;
      if (!uniqueChunks.has(chunkContent)) {
        uniqueChunks.add(chunkContent);
        combinedChunks.push(chunk);
      }
    }

    // Add a new metadata field to indicate if the chunk should be included in the context
    return combinedChunks.map((chunk) => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        includeInContext: true,
      },
    }));
  }
}
