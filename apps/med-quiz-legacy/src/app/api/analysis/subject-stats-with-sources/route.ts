import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/authOptions';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.email;

    // Get query parameters for subject filtering
    const { searchParams } = new URL(req.url);
    const selectedSubjects = searchParams.get('subjects');
    const subjectFilter = selectedSubjects
      ? selectedSubjects.split(',').map((s) => s.trim())
      : null;

    const { db } = await connectToDatabase();
    console.log('Connected to MongoDB, starting aggregation...');

    // Step 1: Fetch all quiz IDs that the user has practiced
    const practicedQuizIds = await db
      .collection('practicerecords')
      .find({ userid: userId }, { projection: { quizid: 1 } })
      .map((doc) => doc.quizid)
      .toArray();

    console.log(
      `Found ${practicedQuizIds.length} practiced quiz IDs for user ${userId}.`,
    );

    // Step 2: Perform aggregation on 'quiz' collection
    const matchStage = subjectFilter
      ? {
          $match: {
            class: { $in: subjectFilter },
          },
        }
      : {};

    const quizzes = await db
      .collection('quiz')
      .aggregate([
        matchStage,
        {
          $group: {
            _id: {
              subject: '$class',
              source: '$source',
            },
            total: { $sum: 1 },
            practiced: {
              $sum: {
                $cond: [{ $in: ['$_id', practicedQuizIds] }, 1, 0],
              },
            },
          },
        },
        {
          $group: {
            _id: '$_id.subject',
            sources: {
              $push: {
                source: '$_id.source',
                total: '$total',
                practiced: '$practiced',
              },
            },
            total: { $sum: '$total' },
            practiced: { $sum: '$practiced' },
          },
        },
        {
          $project: {
            subject: '$_id',
            sources: 1,
            total: 1,
            practiced: 1,
            percentage: {
              $cond: {
                if: { $gt: ['$total', 0] },
                then: {
                  $multiply: [{ $divide: ['$practiced', '$total'] }, 100],
                },
                else: 0,
              },
            },
          },
        },
        { $sort: { subject: 1 } },
      ])
      .toArray();

    console.log('Aggregation completed, returning response.');
    return NextResponse.json(quizzes);
  } catch (error) {
    console.error('Error fetching subject stats with sources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subject stats' },
      { status: 500 },
    );
  }
}
