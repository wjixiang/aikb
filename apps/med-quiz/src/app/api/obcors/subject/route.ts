import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { quizSelector } from '@/types/quizSelector.types';

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: corsHeaders(null),
    },
  );
}

const getUniqueUnitCount = async (selector: quizSelector) => {
  try {
    const { db } = await connectToDatabase();
    const results = db.collection('quiz').distinct('class');

    return results;
  } catch (error) {
    console.error('Error fetching unique unit count:', error);
    throw error; // 处理错误
  }
};

export async function POST(request: NextRequest) {
  const headers = corsHeaders(null);

  try {
    const body = await request.json();
    const selector: quizSelector = body.reqestData;

    // const { cls, mode, quizNum, unit, source, extractedYear } = selector;

    const res = await getUniqueUnitCount(selector);

    // 返回查询结果
    return NextResponse.json(res, {
      status: 200,
      headers: headers,
    });
  } catch (error) {
    console.error('Quiz fetch error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Failed to fetch quizzes', req: request }),
      {
        status: 500,
        headers: headers,
      },
    );
  }
}
