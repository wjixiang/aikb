import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { QuizTag } from '@/lib/quiz/quizTagger';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const userId = session.user.email;
    const { action, oldTagName, newTagName } = await request.json();

    if (!action || !oldTagName) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 },
      );
    }

    if (action === 'rename' && !newTagName) {
      return NextResponse.json(
        { error: 'New tag name is required for rename operation' },
        { status: 400 },
      );
    }

    // Find all documents that contain the old tag for this user
    const query = {
      userId,
      'tags.value': oldTagName,
    };

    if (action === 'rename') {
      // Rename all occurrences of the tag
      const result = await db.collection('quiztags').updateMany(
        query,
        { $set: { 'tags.$[elem].value': newTagName } },
        {
          arrayFilters: [{ 'elem.value': oldTagName }],
        },
      );

      return NextResponse.json({
        success: true,
        message: `Successfully renamed ${result.modifiedCount} tags from "${oldTagName}" to "${newTagName}"`,
        modifiedCount: result.modifiedCount,
      });
    } else if (action === 'delete') {
      // Delete all occurrences of the tag
      const result = await db.collection('quiztags').updateMany({ userId }, {
        $pull: { tags: { value: oldTagName } },
      } as any);

      return NextResponse.json({
        success: true,
        message: `Successfully deleted ${result.modifiedCount} occurrences of tag "${oldTagName}"`,
        modifiedCount: result.modifiedCount,
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'rename' or 'delete'" },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error('Error managing user tags:', error);
    return NextResponse.json(
      { error: 'Failed to manage user tags' },
      { status: 500 },
    );
  }
}
