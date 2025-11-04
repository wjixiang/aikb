import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Connect to database
    const { db } = await connectToDatabase();

    // Get all favorite sentences for the user
    const favorites = await db
      .collection('translationFavorites')
      .aggregate([
        {
          $match: {
            userId: new ObjectId(session.user.id),
          },
        },
        {
          $lookup: {
            from: 'translationPractice',
            localField: 'documentId',
            foreignField: '_id',
            as: 'document',
          },
        },
        {
          $unwind: '$document',
        },
        {
          $project: {
            _id: 1,
            documentId: 1,
            sentenceIndex: 1,
            sentence: 1,
            createdAt: 1,
            documentTitle: '$document.title',
            documentContent: '$document.text',
          },
        },
        {
          $sort: { createdAt: -1 },
        },
      ])
      .toArray();

    return NextResponse.json({
      success: true,
      favorites: favorites.map((fav) => ({
        id: fav._id.toString(),
        documentId: fav.documentId.toString(),
        sentenceIndex: fav.sentenceIndex,
        sentence: fav.sentence,
        documentTitle: fav.documentTitle,
        documentContent: fav.documentContent,
        createdAt: fav.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
