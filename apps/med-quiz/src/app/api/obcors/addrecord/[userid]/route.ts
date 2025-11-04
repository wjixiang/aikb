import { NextRequest, NextResponse } from 'next/server';
import { clientPromise, connectToDatabase } from '@/lib/db/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ [key: string]: string | string[] }> },
) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    await clientPromise;

    // 明确类型断言确保 userid 为字符串
    const Params = await context.params;
    const userid = Params.userid as string;
    const req = await request.json();

    const { db } = await connectToDatabase();
    await db.collection('practicerecords').insertOne({
      userid: userid,
      quizid: new ObjectId(req.quizid),
      timestamp: new Date(),
      selectrecord: req.selectrecord,
      correct: req.correct,
    });

    return NextResponse.json(
      { message: 'Record added successfully' },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('Error adding record:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}
