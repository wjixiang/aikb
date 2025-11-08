import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../lib/db/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { ObjectId } from 'mongodb';
import { QuizTag, TagType } from '@/lib/quiz/quizTagger';

/**
 * Retrieves all tags associated with a specific quiz for the authenticated user.
 *
 * @param request - The incoming HTTP request object
 * @param params - Route parameters containing the quizId
 * @returns A JSON response containing an array of tags or an error message
 *
 * @example
 * // GET /api/quiz/123/tags
 * // Response: { "tags": [{ value: "anatomy", type: "private", createdAt: "2023-01-01", userId: "user@example.com", quizId: "123" }] }
 *
 * @throws {401} When user is not authenticated
 * @throws {500} When there's a server error during database operations
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const quizId = (await params).quizId;
    const userId = session.user.email;

    // Get tags from quiztags collection with userId filter
    const tagDoc = await db.collection('quiztags').findOne({
      quizId,
      userId,
    });
    const tags = tagDoc?.tags || [];

    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Error fetching quiz tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quiz tags' },
      { status: 500 },
    );
  }
}

/**
 * Adds a new tag to a specific quiz for the authenticated user.
 *
 * @param request - The incoming HTTP request object containing the tag data in the body
 * @param params - Route parameters containing the quizId
 * @returns A JSON response containing the newly created tag or an error message
 *
 * @example
 * // POST /api/quiz/123/tags
 * // Body: { "tag": "anatomy", "type": "private" }
 * // Response: { "tag": { value: "anatomy", type: "private", createdAt: "2023-01-01", userId: "user@example.com", quizId: "123" } }
 *
 * @throws {401} When user is not authenticated
 * @throws {500} When there's a server error during database operations
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const quizId = (await params).quizId;
    const userId = session.user.email;
    const { tag, type = 'private' as TagType } = await request.json();

    // Check if tag already exists for this user
    const existingTag = await db.collection('quiztags').findOne({
      quizId,
      userId,
      'tags.value': tag,
    });

    if (existingTag) {
      return NextResponse.json({
        tag: existingTag.tags.find((t: any) => t.value === tag),
      });
    }

    // Add new tag with metadata
    const newTag: QuizTag = {
      value: tag,
      type: type,
      createdAt: new Date(),
      userId,
      quizId: quizId,
    };

    await db
      .collection('quiztags')
      .updateOne(
        { quizId, userId },
        { $push: { tags: newTag } },
        { upsert: true },
      );

    return NextResponse.json({ tag: newTag });
  } catch (error) {
    console.error('Error adding quiz tag:', error);
    return NextResponse.json(
      { error: 'Failed to add quiz tag' },
      { status: 500 },
    );
  }
}

/**
 * Removes a specific tag from a quiz for the authenticated user.
 *
 * @param request - The incoming HTTP request object containing the tag value to delete in the body
 * @param params - Route parameters containing the quizId
 * @returns A JSON response indicating success or an error message
 *
 * @example
 * // DELETE /api/quiz/123/tags
 * // Body: { "tag": "anatomy" }
 * // Response: { "success": true, "message": "Tag removed successfully" }
 *
 * @throws {401} When user is not authenticated
 * @throws {404} When the tag is not found or not owned by the user
 * @throws {500} When there's a server error during database operations
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const quizId = (await params).quizId;
    const userId = session.user.email;
    const { tag } = await request.json();

    // Remove the specific tag from the user's tags array
    const result = await db
      .collection('quiztags')
      .updateOne({ quizId, userId }, { $pull: { tags: { value: tag } } });

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { error: 'Tag not found or not owned by user' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Tag removed successfully',
    });
  } catch (error) {
    console.error('Error removing quiz tag:', error);
    return NextResponse.json(
      { error: 'Failed to remove quiz tag' },
      { status: 500 },
    );
  }
}
