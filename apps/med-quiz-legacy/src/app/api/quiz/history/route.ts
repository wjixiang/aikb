import { NextResponse } from 'next/server';
import QuizStorage from '@/lib/quiz/QuizStorage';
import type {
  PracticeRecord,
  PracticeRecordData,
} from '@/lib/quiz/QuizStorage';
import { authOptions } from '@/lib/auth/authOptions'; // Import authOptions
import { getServerSession } from 'next-auth';

/**
 * Retrieves practice history records for the authenticated user within a specified date range.
 *
 * @param request - The incoming HTTP request object with query parameters
 * @returns A JSON response containing practice records with quiz data or an error message
 *
 * @queryParam {string} startDate - Required. The start date of the range (ISO format)
 * @queryParam {string} endDate - Required. The end date of the range (ISO format)
 * @queryParam {string} filter - Optional. Filter by "correct" or "wrong" answers
 *
 * @example
 * // GET /api/quiz/history?startDate=2023-01-01&endDate=2023-12-31&filter=correct
 * // Response: [{ _id: "...", quizid: "...", correct: true, quizData: {...} }]
 *
 * @throws {401} When user is not authenticated
 * @throws {400} When startDate or endDate parameters are missing or invalid
 * @throws {500} When there's a server error during database operations
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions); // Corrected usage
  if (!session || !session.user || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = session.user.email;
  const startDateParam = searchParams.get('startDate');
  const endDateParam = searchParams.get('endDate');
  const filter = searchParams.get('filter'); // Declared here

  if (!startDateParam || !endDateParam) {
    return NextResponse.json(
      { error: 'Missing startDate or endDate parameters' },
      { status: 400 },
    );
  }

  const startDate = new Date(startDateParam);
  const endDate = new Date(endDateParam);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
  }

  try {
    const quizStorage = new QuizStorage();
    let practiceRecords = await quizStorage.fetchPracticeRecords(
      userId,
      startDate,
      endDate,
    );

    if (filter === 'correct') {
      practiceRecords = practiceRecords.filter((record) => record.correct);
    } else if (filter === 'wrong') {
      practiceRecords = practiceRecords.filter((record) => !record.correct);
    }

    const recordsWithQuizData = await Promise.all(
      practiceRecords.map(async (record) => {
        try {
          const quizData = await quizStorage.fetchQuizzesByOids([
            record.quizid,
          ]);
          return { ...record, quizData: quizData[0] };
        } catch (error) {
          console.error(
            `Failed to fetch quiz for record ${record._id}:`,
            error,
          );
          return record;
        }
      }),
    );

    return NextResponse.json(recordsWithQuizData);
  } catch (error) {
    console.error('Failed to fetch practice records from API:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
