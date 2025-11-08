import { NextRequest, NextResponse } from 'next/server';
import QuizStorage from '@/lib/quiz/QuizStorage';

/**
 * Fetches related markdown cards for a quiz by its MongoDB ID.
 * This endpoint retrieves content from the knowledge graph that is semantically
 * related to the specified quiz, providing additional learning materials.
 *
 * @param req - The Next.js request object containing query parameters
 * @returns A JSON response with related cards or an error message
 *
 * @queryParam {string} mongoId - Required. The MongoDB ObjectId of the quiz to find related cards for
 *
 * @returns {Promise<NextResponse>} Returns a JSON response with:
 *   - cards: Array of related markdown cards with content and SurrealDB record IDs
 *   - mongoId: The original quiz ID
 *
 * @example
 * // GET /api/quiz/related-cards?mongoId=507f1f77bcf86cd799439011
 * // Response:
 * // {
 * //   "cards": [
 * //     {
 * //       "content": "## Related Concept\nThis is related content...",
 * //       "id": "markdown_files:12345"
 * //     }
 * //   ],
 * //   "mongoId": "507f1f77bcf86cd799439011"
 * // }
 *
 * @throws {400} When mongoId parameter is missing
 * @throws {500} When there's a server error during processing
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mongoId = searchParams.get('mongoId');

    if (!mongoId) {
      return NextResponse.json(
        { error: 'Missing mongoId parameter' },
        { status: 400 },
      );
    }

    const quizStorage = new QuizStorage();
    const relatedCards = await quizStorage.get_related_cards(mongoId);

    return NextResponse.json(relatedCards);
  } catch (error) {
    console.error('Error fetching related cards:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
