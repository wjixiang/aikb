import { embedding } from "@/kgrag/lib/embedding";
import { surrealDBClient } from "../../kgrag/database/surrrealdbClient";
import { formQuizContent } from "../utils";
import { RecordId } from "surrealdb";
import type { DocumentToRerank } from "@/types/baml";
import { b } from "../../baml_client/async_client";
import { Db } from "mongodb";
import { quiz } from "@/types/quizData.types";

export default class quiz_to_property {
  async fetchQuizData(recordId: RecordId): Promise<any> {
    try {
      const db = await surrealDBClient.getDb();
      const quizData = await db.select(recordId);
      return quizData;
    } catch (error) {
      console.error(
        `Error fetching quiz data for recordId ${recordId}:`,
        error,
      );
      throw error;
    }
  }

  async processQuizzes() {
    const db = await surrealDBClient.getDb();
    const quizzes = (await db.query<[][]>("SELECT * FROM quiz"))[0];
    quizzes.map(async (quiz: { id: RecordId }) => {
      try {
        const recordId = quiz.id as RecordId;
        console.log(`Processing quiz with recordId: ${recordId}`);
        const relevantDocuments =
          await this.analyzeQuizAndFindDocuments(recordId);
        // console.log(`Found ${relevantDocuments.length} relevant documents for quiz ${quiz._id}`);
      } catch (error) {
        // console.error(`Error processing quiz ${quiz._id}:`, error);
      }
    });
  }

  async findRelevantDocuments(parsedQuizData: string): Promise<any[]> {
    console.log("Finding relevant documents for:", parsedQuizData);

    const query = parsedQuizData;
    const top_k = 10; // Retrieve more documents initially for reranking

    if (!query) {
      console.log("No question text found in parsedQuizData.");
      return [];
    }

    try {
      // Step 1: Retrieve initial documents using the property_retriever
      const initialDocuments = await this.property_retriever(query, top_k);

      if (!initialDocuments || initialDocuments.length === 0) {
        console.log("No initial documents retrieved.");
        return [];
      }

      // Step 2: Map retrieved documents to the DocumentToRerank format
      // Keep track of the original index
      const documentsToRerank: DocumentToRerank[] = initialDocuments.map(
        (doc: any) => ({
          content: doc.property_content || "", // Assuming property_content is the main content
          metadata: JSON.stringify({
            // Include other relevant fields in metadata
            id: doc.id,
            core_entity: doc.core_entity,
            property_name: doc.property_name,
            score: doc.score,
          }),
        }),
      );

      // Step 3: Call the BAML reranker function
      console.log("Calling BAML reranker...");
      // The reranker now returns a list of relevant document indices (as strings)
      const relevantDocumentIndices = await b.RerankDocuments(
        query,
        documentsToRerank,
      );
      console.log("BAML reranker returned indices:", relevantDocumentIndices);

      // Step 4: Select and reorder the original documents based on the reranked indices
      const rerankedDocuments = relevantDocumentIndices
        .map((indexStr) => {
          const index = indexStr;
          // BAML indices are 1-based, array indices are 0-based
          if (!isNaN(index) && index > 0 && index <= initialDocuments.length) {
            return initialDocuments[index - 1];
          }
          console.warn(
            `Invalid document index returned by reranker: ${indexStr}`,
          );
          return null; // Or handle invalid index as appropriate
        })
        .filter((doc) => doc !== null); // Remove any null entries from invalid indices

      return rerankedDocuments;
    } catch (error) {
      console.error("Error in findRelevantDocuments:", error);
      throw error;
    }
  }

  async analyzeQuizAndFindDocuments(recordId: RecordId): Promise<any[]> {
    try {
      const quizData = await this.fetchQuizData(recordId);
      if (!quizData) {
        console.log(`No quiz data found for recordId: ${recordId}`);
        return [];
      }
      const parsedQuizData = formQuizContent(quizData);
      const relevantDocuments =
        await this.findRelevantDocuments(parsedQuizData);
      await this.create_relation(
        recordId,
        relevantDocuments.map((doc) => ({
          id: doc.id,
          score: doc.score || 0, // Assuming score is available, default to 0 if not
        })),
      );
      return relevantDocuments;
    } catch (error) {
      console.error(
        `Error analyzing quiz and finding documents for recordId ${recordId}:`,
        error,
      );
      throw error;
    }
  }

  async property_retriever(query: string, top_k: number) {
    const queryEmbedding = await embedding(query);
    // this.logger.debug("queryEmbedding length:", queryEmbedding?.length);
    console.log(
      `queryEmbedding type: ${typeof queryEmbedding}, length: ${queryEmbedding?.length}`,
    );

    if (queryEmbedding === null) {
      console.log(
        "Failed to generate embedding for query. Cannot perform vector search.",
      );
      return []; // Return empty array if embedding generation failed
    }

    let surrealQL = `
            SELECT  id, core_entity, property_content, property_name , vector::similarity::cosine(embedding_vector, <array<number>> $queryEmbedding) AS score
            FROM property
            WHERE embedding_vector != NONE
        `;

    surrealQL += `
            ORDER BY score DESC
            LIMIT ${top_k};
        `;

    try {
      const db = await surrealDBClient.getDb();
      const result = await db.query(surrealQL, {
        queryEmbedding: queryEmbedding,
      });
      console.log("query raw result:", JSON.stringify(result, null, 2));
      if (
        result &&
        Array.isArray(result) &&
        result.length > 0 &&
        Array.isArray(result[0])
      ) {
        // Filter results based on cosine_better_than_threshold if score is available
        return result[0];
      }
      return [];
    } catch (error) {
      console.log("Error during chunk query:", error);
      throw error;
    }
  }

  async create_relation(
    quiz_id: RecordId,
    property: { id: RecordId; score: number }[],
  ) {
    const db = await surrealDBClient.getDb();
    for (const chunk of property) {
      await db.insertRelation("quiz_to_property", {
        in: quiz_id,
        out: chunk.id,
        score: chunk.score,
      });
      // if(quiz.surrealRecordId){
      //     const chunkNode = await this.graphStorage.createEdge(quiz.surrealRecordId, 'has_chunk', chunk.document.id, {score: chunk.score} );
      // }
    }
  }
}
