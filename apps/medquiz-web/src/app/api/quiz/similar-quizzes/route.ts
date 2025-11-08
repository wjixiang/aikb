import { NextRequest, NextResponse } from 'next/server';
import QuizMilvusStorage from '@/lib/quiz/QuizMilvusStorage';
import { quiz, QuizWithUserAnswer } from '@/types/quizData.types';
import { createLoggerWithPrefix } from '@/lib/console/logger';

const logger = createLoggerWithPrefix('simiarquiz');

/**
 * Finds quizzes that are semantically similar to a given quiz using vector similarity search.
 * This endpoint leverages Milvus vector database to find quizzes with similar content,
 * helping users discover related practice questions.
 *
 * @param req - The incoming HTTP request object containing search parameters
 * @returns A JSON response with similar quizzes or an error message
 *
 * @bodyParam {string} quizId - Required. The ID of the quiz to find similar quizzes for
 * @bodyParam {number} [top_k=5] - Optional. Maximum number of similar quizzes to return
 * @bodyParam {string} [class] - Optional. Filter similar quizzes by class/category
 * @bodyParam {string} [source] - Optional. Filter similar quizzes by source
 *
 * @example
 * // POST /api/quiz/similar-quizzes
 * // Body: { "quizId": "507f1f77bcf86cd799439011", "top_k": 5, "class": "anatomy" }
 * // Response: [{ _id: "...", question: "...", options: [...], similarity: 0.85 }]
 *
 * @throws {400} When quizId is missing
 * @throws {404} When quiz is not found
 * @throws {500} When there's a server error during processing
 */
export async function POST(req: NextRequest) {
  try {
    const {
      quizId,
      top_k,
      class: quizClass,
      source: quizSource,
    } = await req.json();

    if (!quizId) {
      return NextResponse.json(
        { error: 'Quiz ID is required' },
        { status: 400 },
      );
    }

    // Fetch the quiz from the database to get its content

    const storage = new QuizMilvusStorage({ semantic_search_threshold: 0.65 });
    const quiz = await storage.fetchQuizzesByOids([quizId]);

    if (quiz.length < 1) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    // Convert the retrieved record to the 'quiz' type
    const formattedQuiz: quiz = quiz[0];

    // Ensure quiz.answer is an array for type 'X' quizzes to prevent join() errors
    if (formattedQuiz.type === 'X' && !Array.isArray(formattedQuiz.answer)) {
      formattedQuiz.answer = [];
    }

    const similarQuizzes = await storage.semanticQuizRetriever(
      formattedQuiz,
      top_k || 5,
      quizClass,
      quizSource,
    );

    return NextResponse.json(similarQuizzes);
  } catch (error: any) {
    logger.error('Error in similar-quizzes API:', error);
    return NextResponse.json(
      { error: `Internal Server Error: ${error.message || error}` },
      { status: 500 },
    );
  }
}
