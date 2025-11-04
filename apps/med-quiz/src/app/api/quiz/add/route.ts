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
  title: string;
  quizzes: {
    quiz: quiz;
    answer: answerType | null;
  }[];
  createdAt: Date;
  creator?: string;
}

/**
 * Adds new quizzes to an existing quiz set.
 *
 * @param request - The incoming HTTP request object containing quizSetId and quizzes array
 * @returns A JSON response indicating success or an error message
 *
 * @example
 * // POST /api/quiz/add
 * // Body: { "quizSetId": "507f1f77bcf86cd799439011", "quizzes": [{ question: "What is...", options: [...], type: "MCQ" }] }
 * // Response: { "success": true, "message": "Quizzes added successfully" }
 *
 * @throws {401} When user is not authenticated
 * @throws {400} When request data is invalid (missing quizSetId or quizzes)
 * @throws {404} When quiz set is not found or no quizzes were added
 * @throws {500} When there's a server error during database operations
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { quizSetId, quizzes } = await request.json();

    if (!quizSetId || !quizzes || !Array.isArray(quizzes)) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();

    const quizSetObjectId = new ObjectId(quizSetId);

    const newQuizzes = quizzes.map((quiz: quiz) => ({
      quiz: quiz,
      answer: null,
    }));
    const result = await db
      .collection('quizSets')
      .updateOne(
        { _id: quizSetObjectId },
        { $push: { quizzes: { $each: newQuizzes } as any } },
      );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { error: 'Quiz set not found or no quizzes added' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Quizzes added successfully',
    });
  } catch (error) {
    console.error('Error adding quizzes to quiz set:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
