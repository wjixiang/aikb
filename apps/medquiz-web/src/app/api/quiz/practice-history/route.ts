import { NextResponse } from 'next/server';
import QuizStorage from '../../../../lib/quiz/QuizStorage';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { ObjectId } from 'mongodb';

/**
 * Retrieves practice history for a specific quiz for the authenticated user.
 *
 * @param request - The incoming HTTP request object with quizId as query parameter
 * @returns A JSON response containing practice history records or an error message
 *
 * @queryParam {string} quizId - Required. The ID of the quiz to fetch history for
 *
 * @example
 * // GET /api/quiz/practice-history?quizId=507f1f77bcf86cd799439011
 * // Response: [{ _id: "...", quizid: "507f1f77bcf86cd799439011", correct: true, timestamp: "2023-01-01" }]
 *
 * @throws {401} When user is not authenticated
 * @throws {400} When quizId parameter is missing
 * @throws {500} When there's a server error during database operations
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const quizId = searchParams.get('quizId');

  const session = await getServerSession(authOptions);
  const userId = session?.user?.email;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!quizId) {
    return NextResponse.json(
      { error: 'Missing quizId parameter' },
      { status: 400 },
    );
  }

  try {
    const quizStorage = new QuizStorage();
    const practiceHistory = await quizStorage.fetchPracticeRecordsForQuiz(
      userId,
      quizId,
    );
    return NextResponse.json(practiceHistory);
  } catch (error) {
    console.error('Error fetching practice history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch practice history' },
      { status: 500 },
    );
  }
}

/**
 * Saves a new practice record for the authenticated user.
 *
 * @param request - The incoming HTTP request object containing practice record data
 * @returns A JSON response indicating success or an error message
 *
 * @example
 * // POST /api/quiz/practice-history
 * // Body: { quizid: "507f1f77bcf86cd799439011", correct: true, answer: "A", timestamp: "2023-01-01" }
 * // Response: { "success": true }
 *
 * @throws {401} When user is not authenticated
 * @throws {500} When there's a server error during database operations
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.email;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.json();
    const quizStorage = new QuizStorage();
    console.log(data);

    await quizStorage.pushRecord({ ...data, userid: userId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving practice record:', error);
    return NextResponse.json(
      { error: 'Failed to save practice record' },
      { status: 500 },
    );
  }
}
