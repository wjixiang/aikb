import { connectToDatabase } from "@/lib/db/mongodb";
import { embeddings } from "@/lib/langchain/provider";
import QuizEmbeddingManager from "@/lib/milvus/embedding/MilvusQuizCollectionManager";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

/**
 * @description Searches for quizzes similar to the provided description text using vector embeddings
 * @route POST /api/obcors/quiz/similar-search-by-desc
 * @param {NextRequest} request - The Next.js request object
 * @returns {Promise<NextResponse>} Returns quiz documents matching the search
 *
 * @example
 * // Request body example:
 * {
 *   "filter": "subject:anatomy", // MongoDB filter query (optional)
 *   "searchStr": "heart anatomy questions" // Text to find similar quizzes for
 * }
 *
 * @example
 * // Successful response example:
 * [
 *   {
 *     "_id": "65a1b2c3d4e5f6a7b8c9d0e1",
 *     "question": "What is the function of the mitral valve?",
 *     "subject": "anatomy",
 *     // ...other quiz fields
 *   },
 *   // ...more matching quizzes
 * ]
 *
 * @example
 * // Error response example:
 * {
 *   "error": "Failed to fetch quizzes"
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log(`[API] Starting similar search request`);

  try {
    const data: {
      filter: string;
      searchStr: string;
    } = await request.json();

    console.log(`[API] Request data:`, {
      filter: data.filter,
      searchStr:
        data.searchStr.substring(0, 100) +
        (data.searchStr.length > 100 ? "..." : ""),
    });

    const { db } = await connectToDatabase();
    console.log(`[API] Connected to database`);

    const quizManager = new QuizEmbeddingManager(
      "quiz",
      embeddings().Embeddings,
      undefined,
      true,
    );
    console.log(`[API] Initialized QuizEmbeddingManager in debug mode`);

    const vectorSearchStart = Date.now();
    const abstractQuizes = await quizManager.filterSearch(
      data.filter,
      data.searchStr,
      { limit: 10 },
    );
    console.log(
      `[API] Vector search completed in ${Date.now() - vectorSearchStart}ms`,
    );
    console.log(`[API] Found ${abstractQuizes.length} vector matches`);

    const mongoLookupStart = Date.now();
    const quizes = await db
      .collection("quiz")
      .find({
        _id: {
          $in: abstractQuizes.map((e) => ObjectId.createFromHexString(e.oid)),
        },
      })
      .toArray();
    console.log(
      `[API] MongoDB lookup completed in ${Date.now() - mongoLookupStart}ms`,
    );
    console.log(`[API] Found ${quizes.length} full documents`);

    console.log(`[API] Request completed in ${Date.now() - startTime}ms`);
    return NextResponse.json(quizes);
  } catch (error) {
    console.error(`[API] Error in similar search:`, error);
    return new NextResponse(
      JSON.stringify({
        error: "Failed to fetch quizzes",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
      },
    );
  }
}
