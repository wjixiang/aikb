import { RecordId, Surreal } from 'surrealdb'; // Import Surreal and RecordId from surrealdb
import { ChunkDocument } from '@/kgrag/database/chunkStorage'; // Assuming ChunkDocument type is still needed
import { b } from '@/baml_client';
import { formQuizContent } from '@/lib/utils'; // Import formQuizContent
import { quiz } from '@/types/quizData.types'; // Import quiz
import KnowledgeGraphRetriever from '@/kgrag/core/KnowledgeGraphRetriever'; // Import KnowledgeGraphRetriever
import { semanticSearchResult } from '../../kgrag/database/chunkStorage'; // Import semanticSearchResult

import { language } from '@/kgrag/type'; // Import language type

export interface SimilarQuizResult {
  quizId: RecordId;
  similarityScore: number;
  sharedChunks: number;
}

export class QuizQueryService {
  private db: Surreal; // Add Surreal instance

  private knowledgeGraphRetriever: KnowledgeGraphRetriever; // Add KnowledgeGraphRetriever instance

  constructor(db: Surreal, knowledgeGraphRetriever: KnowledgeGraphRetriever) {
    // Accept Surreal and KnowledgeGraphRetriever instances
    this.db = db; // Store Surreal instance
    this.knowledgeGraphRetriever = knowledgeGraphRetriever; // Store KnowledgeGraphRetriever instance
  }

  /**
   * Retrieves chunks related to a specific quiz.
   * @param quizId The ID of the quiz (SurrealDB RecordId).
   * @returns A promise resolving to an array of related ChunkDocuments.
   */
  public async getRelatedChunksForQuiz(
    quizId: RecordId,
  ): Promise<ChunkDocument[]> {
    try {
      // Use a direct SurrealDB query to find nodes connected via 'has_chunk' edge
      // SELECT out FROM $quizId->has_chunk
      const connectedNodesResult = await this.db.query(
        'SELECT * FROM $quizId->has_chunk FETCH chunks_test',
        { quizId },
      );
      console.log(
        `Connected nodes for quiz ${quizId}:`,
        JSON.stringify(connectedNodesResult),
      );

      // The result is an array of arrays containing edge objects with out/in/data
      // Example: [[{
      //   "data":{"score":0.8357419143095464},
      //   "id":"has_chunk:5mg3bpsatcg0iw1c6nle",
      //   "in":"quiz:46c4tzf9bmu827r9u5ai",
      //   "out":"chunks_test:t3wsiw8jwnanxoaipyrt"
      // }, ...]]
      const chunkIds: RecordId[] = [];
      if (
        Array.isArray(connectedNodesResult) &&
        connectedNodesResult.length > 0
      ) {
        // The outer array contains the result set
        const resultSet = connectedNodesResult[0];
        if (Array.isArray(resultSet)) {
          resultSet.forEach((edge) => {
            if (edge?.out) {
              chunkIds.push(edge.out as RecordId);
            }
          });
        }
      }

      // Fetch the actual ChunkDocuments using their IDs from the database
      // Use db.select with an array of IDs
      if (chunkIds.length === 0) {
        return [];
      }

      const result = await Promise.all(
        chunkIds.map(async (id) => {
          const { embedding, ...doc } = await this.db.select(id);
          return doc;
        }),
      );

      return result as ChunkDocument[];
    } catch (error) {
      console.error(
        `Error retrieving related chunks for quiz ${quizId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Finds quizzes similar to the given quiz based on shared chunks
   * @param quizId The ID of the quiz to find similar quizzes for
   * @param limit Maximum number of similar quizzes to return
   * @returns Array of similar quizzes with similarity scores
   */
  public async findSimilarQuizzes(
    quizId: RecordId,
    limit: number = 5,
  ): Promise<SimilarQuizResult[]> {
    try {
      // First get all chunks connected to this quiz
      const chunks = await this.getRelatedChunksForQuiz(quizId);
      console.log(`Chunks for quiz ${quizId}:`, JSON.stringify(chunks));
      if (chunks.length === 0) {
        return [];
      }

      // For each chunk, find all quizzes connected to it (excluding the original quiz)
      const quizCounts = new Map<
        string,
        { count: number; totalScore: number }
      >();

      for (const chunk of chunks) {
        const result = await this.db.query(
          'SELECT in, out, data FROM $chunkId<-has_chunk WHERE in != $quizId FETCH in',
          { chunkId: chunk.id, quizId },
        );

        if (Array.isArray(result)) {
          // The result is an array of result sets
          for (const resultSet of result) {
            if (Array.isArray(resultSet)) {
              for (const edge of resultSet) {
                if (edge?.in) {
                  const quizIdStr = edge.in as string;
                  const current = quizCounts.get(quizIdStr) || {
                    count: 0,
                    totalScore: 0,
                  };
                  const edgeScore = edge.data?.score || 1;
                  quizCounts.set(quizIdStr, {
                    count: current.count + 1,
                    totalScore: current.totalScore + edgeScore,
                  });
                }
              }
            }
          }
        }
      }

      // Convert to results with similarity scores
      const results: SimilarQuizResult[] = [];
      const totalChunks = chunks.length;

      quizCounts.forEach((value, quizIdStr) => {
        // Calculate similarity score as:
        // 1. Ratio of shared chunks (value.count / totalChunks)
        // 2. Weighted by average edge score (value.totalScore / value.count)
        const sharedRatio = value.count / totalChunks;
        const avgScore = value.totalScore / value.count;
        const similarityScore = sharedRatio * avgScore;

        results.push({
          quizId: quizIdStr as unknown as RecordId,
          similarityScore,
          sharedChunks: value.count,
        });
      });

      // Sort by similarity score descending
      results.sort((a, b) => b.similarityScore - a.similarityScore);

      return results.slice(0, limit);
    } catch (error) {
      console.error(`Error finding similar quizzes for ${quizId}:`, error);
      return [];
    }
  }

  /**
   * Generates variant questions based on a quiz's knowledge graph relationships
   * @param quizId The ID of the original quiz
   * @param options Configuration options for variant generation
   * @returns A promise resolving to the original question and its variants
   */
  public async generateQuestionVariants(
    quizId: RecordId,
    options: VariantGenerationOptions = {},
  ): Promise<{
    originalQuestion: string;
    variants: QuestionVariant[];
  }> {
    const {
      variantCount = 3,
      similarityThreshold = 0.01,
      maxChunkDistance = 2,
    } = options;

    try {
      // 1. Get original quiz content
      const originalQuiz = (await this.db.select(quizId)) as unknown as quiz;
      console.log(`Original quiz: ${JSON.stringify(originalQuiz)}`);
      const origin_quiz = formQuizContent(originalQuiz);

      // 2. Get related chunks
      const chunks = await this.getRelatedChunksForQuiz(quizId);
      if (chunks.length === 0) {
        throw new Error('No related chunks found for quiz');
      }

      // 3. Get similar quizzes
      const similarQuizzes = await this.findSimilarQuizzes(quizId, 10);
      const filteredSimilar = similarQuizzes.filter(
        (q) => q.similarityScore >= similarityThreshold,
      );

      // 4. Generate variants using LLM
      const variants: QuestionVariant[] = [];

      // Prepare arguments for LLM
      const related_chunks = chunks.map((chunk) => chunk.content);

      // Fetch and format similar quizzes
      const similar_quizes: string[] = [];
      for (const similarQuiz of similarQuizzes) {
        const fullSimilarQuiz = (await this.db.select(
          similarQuiz.quizId,
        )) as unknown as quiz[];
        console.log(`Full similar quiz: ${JSON.stringify(fullSimilarQuiz)}`);
        similar_quizes.push(formQuizContent(fullSimilarQuiz[0]));
      }

      // Assuming a BAML client is available and has a function for variant generation
      // The structure of the LLM response will determine how to parse it into QuestionVariant[]
      // The BAML function expects origin_quiz: string, related_chunks: string[], similar_quizes: string[]
      const llmResponse = await b.GenerateQuizVarient(
        origin_quiz,
        related_chunks,
        similar_quizes,
      ); // LLM call

      // Process LLM response to create QuestionVariant objects
      // Assuming the LLM response is a single MutatedQuiz object
      if (llmResponse) {
        // Since the BAML function returns a single MutatedQuiz, we'll create one variant for now.
        // If the BAML function were designed to return multiple variants, this logic would need adjustment.
        variants.push({
          variantText:
            llmResponse.question || 'Generated variant text placeholder',
          sourceChunks: chunks, // Using all related chunks for now
          similarQuizzes: similarQuizzes, // Using all filtered similar quizzes for now
        });
      } else {
        console.warn(
          'LLM response for variants was null or undefined:',
          llmResponse,
        );
        // Handle null/undefined response if necessary
      }

      return {
        originalQuestion: origin_quiz, // Use the formatted original quiz string
        variants,
      };
    } catch (error) {
      console.error(`Error generating variants for quiz ${quizId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves relevant quizzes based on a user query using RAG and the knowledge graph.
   * @param userQuery The user's query string.
   * @returns A promise resolving to an array of relevant quiz objects.
   */
  public async getQuizzesFromUserQuery(
    userQuery: string,
    top_k: number = 10,
  ): Promise<quiz[]> {
    try {
      // 1. Generate an LLM answer using the baseline RAG workflow
      // This step internally performs RAG to get chunks for answer generation
      const llmAnswer = await b.HyDE_rewrite(userQuery, '中文');
      console.log('LLM Generated Answer:', llmAnswer);

      // 2. Perform RAG again to get relevant chunks specifically for finding quizzes
      // We use the original user query here. If HyDE was used in rag_workflow,
      // we might consider using the rewritten query, but for simplicity, we'll use the original.
      const relevantChunksResult: semanticSearchResult[] =
        await this.knowledgeGraphRetriever.chunks_retriver(
          llmAnswer.HyDE_answer,
          top_k,
        );

      if (!relevantChunksResult || relevantChunksResult.length === 0) {
        console.log('No relevant chunks found for the query.');
        return [];
      }

      // Rerank and filter retrieved documents
      const rerankIndex = await b.RerankDocuments(
        userQuery,
        relevantChunksResult.map((e) => {
          return {
            content: e.document.content as string,
            metadata: String(e.score),
          };
        }),
      );

      const rerankedRelevantChunksResult = relevantChunksResult.filter(
        (e, index) => {
          return index + 1 in rerankIndex;
        },
      );

      console.log(
        'rerankedRelevantChunksResult:',
        rerankedRelevantChunksResult,
      );

      // Extract chunk IDs from the RAG result
      const relevantChunkIds: RecordId[] = relevantChunksResult.map(
        (chunk: semanticSearchResult) => chunk.document.id as RecordId,
      );
      console.log(relevantChunkIds);
      if (relevantChunkIds.length === 0) {
        console.log('No relevant chunk IDs extracted from RAG result.');
        return [];
      }

      // 3. Find quizzes connected to these chunks
      const quizIds = new Set<string>();
      // Use a single query to find quizzes connected to any of the relevant chunks
      // SELECT in FROM has_chunk WHERE out IN $relevantChunkIds
      const connectedQuizzesResult = await this.db.query(
        'SELECT in FROM quiz_to_chunk WHERE out IN $relevantChunkIds',
        { relevantChunkIds },
      );
      // console.log(connectedQuizzesResult)
      if (
        Array.isArray(connectedQuizzesResult) &&
        connectedQuizzesResult.length > 0
      ) {
        const resultSet = connectedQuizzesResult[0];
        if (Array.isArray(resultSet)) {
          resultSet.forEach((edge) => {
            if (edge?.in) {
              quizIds.add(edge.in as string);
            }
          });
        }
      }

      if (quizIds.size === 0) {
        console.log('No quizzes found connected to the relevant chunks.');
        return [];
      }

      // 4. Fetch the actual quiz documents
      const quizzes: quiz[] = [];
      for (const quizId of quizIds) {
        try {
          const quiz = (await this.db.select(quizId)) as unknown as quiz;
          quizzes.push(quiz);
        } catch (selectError) {
          console.error(`Error fetching quiz ${quizId}:`, selectError);
          // Continue to fetch other quizzes
        }
      }

      // 5. (Optional) Implement a ranking algorithm based on shared chunks or other criteria
      // For now, just return the found quizzes.

      return quizzes;
    } catch (error) {
      console.error(`Error retrieving quizzes from user query:`, error);
      return [];
    }
  }
}

/**
 * Options for question variant generation
 */
export interface VariantGenerationOptions {
  /** Number of variants to generate (default: 3) */
  variantCount?: number;
  /** Minimum similarity score for similar quizzes to consider (default: 0.7) */
  similarityThreshold?: number;
  /** Maximum chunk distance to consider (default: 2) */
  maxChunkDistance?: number;
}

/**
 * Result of variant question generation
 */
export interface QuestionVariant {
  /** The generated variant text */
  variantText: string;
  /** Chunks used to generate this variant */
  sourceChunks: ChunkDocument[];
  /** Similar quizzes that influenced this variant */
  similarQuizzes: SimilarQuizResult[];
}
