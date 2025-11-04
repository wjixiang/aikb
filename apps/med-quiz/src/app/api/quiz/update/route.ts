import { connectToDatabase } from '@/lib/db/mongodb';
import { NextResponse } from 'next/server';
import { quiz, answerType } from '@/types/quizData.types';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { ObjectId } from 'mongodb';

/**
 * Interface representing the structure of a quiz set document in the database
 */
interface QuizSetDocument {
  quizzes: {
    quizId: string;
    answer: answerType | null;
  }[];
}

/**
 * Updates a quiz set by replacing all quizzes with a new set of quiz IDs.
 * This operation completely replaces the existing quiz list with the provided one.
 *
 * @param request - The incoming HTTP request object containing quizSetId and quizIds array
 * @returns A JSON response indicating success or an error message
 *
 * @example
 * // POST /api/quiz/update
 * // Body: { "quizSetId": "507f1f77bcf86cd799439011", "quizIds": ["507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"] }
 * // Response: { "success": true }
 *
 * @throws {401} When user is not authenticated
 * @throws {400} When request data is invalid (missing quizSetId or quizIds)
 * @throws {404} When quiz set is not found or not owned by the user
 * @throws {500} When there's a server error during database operations
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { quizSetId, quizIds } = await request.json();

    if (!quizSetId || !quizIds || !Array.isArray(quizIds)) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();

    const updateResult = await db.collection('quizSets').updateOne(
      { _id: new ObjectId(quizSetId), creator: session.user.email },
      {
        $set: {
          quizzes: quizIds.map((id) => ({
            quizId: id,
            answer: null,
          })),
        },
      },
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Quiz set not found or not owned by user' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error updating quiz set:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
