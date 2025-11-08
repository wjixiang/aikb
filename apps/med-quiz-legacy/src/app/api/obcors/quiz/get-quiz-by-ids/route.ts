import { connectToDatabase } from '@/lib/db/mongodb';
import { ObjectId } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const data: {
      ids: string[];
    } = await request.json();
    const { db } = await connectToDatabase();
    const quizes = await db
      .collection('quiz')
      .find({
        _id: { $in: data.ids.map((e) => ObjectId.createFromHexString(e)) },
      })
      .toArray();
    console.log(quizes);
    return NextResponse.json(quizes);
  } catch (error) {
    return new NextResponse(
      JSON.stringify({ error: 'Failed to fetch quizzes' }),
      {
        status: 500,
      },
    );
  }
}
