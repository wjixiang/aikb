import { connectToDatabase } from '@/lib/db/mongodb';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { ObjectId } from 'mongodb';
import { UpdateQuizAnswerRequest, APIResponse } from '@/types/quizSet.types';

/**
 * Updates the answer for a specific quiz within a quiz set.
 *
 * @param request - The incoming HTTP request object containing quizId, quizSetId, and answer
 * @returns A JSON response indicating success or an error message
 *
 * @example
 * // POST /api/quiz/answer
 * // Body: { "quizId": "507f1f77bcf86cd799439011", "quizSetId": "507f1f77bcf86cd799439012", "answer": "A" }
 * // Response: { "success": true, "message": "Answer updated successfully" }
 *
 * @throws {401} When user is not authenticated
 * @throws {400} When quizId or quizSetId is missing
 * @throws {404} When quiz is not found in the quiz set or answer already matches
 * @throws {500} When there's a server error during database operations
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { quizId, answer, quizSetId }: UpdateQuizAnswerRequest =
      await request.json();
    const isDev = process.env.NODE_ENV === 'development';

    if (!quizId || !quizSetId) {
      return NextResponse.json(
        { error: 'Quiz ID and Quiz set ID are required' },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();

    if (isDev) {
      console.log('Updating answer for quiz:', {
        quizId,
        quizSetId,
        answer,
      });
    }

    // Update the answer in quizSets using $elemMatch to handle both string and ObjectId formats
    const result = await db.collection('quizSets').updateOne(
      {
        _id: new ObjectId(quizSetId),
        quizzes: {
          $elemMatch: {
            quizId: { $in: [quizId, new ObjectId(quizId)] },
          },
        },
      },
      {
        $set: { 'quizzes.$[elem].answer': answer },
      },
      {
        arrayFilters: [
          {
            'elem.quizId': { $in: [quizId, new ObjectId(quizId)] },
          },
        ],
      },
    );

    if (result.modifiedCount === 0) {
      if (isDev) {
        console.log('Update failed - no documents matched:', {
          quizId,
          quizSetId,
        });
      }
      return NextResponse.json(
        {
          error: `Quiz ${quizId} not found in your quiz sets or answer already matches`,
          code: 'QUIZ_NOT_FOUND',
        },
        { status: 404 },
      );
    }

    return NextResponse.json<APIResponse>({
      success: true,
      message: 'Answer updated successfully',
    });
  } catch (error) {
    console.error(
      'Error updating answer:',
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
