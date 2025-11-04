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

const getUnitsBySubject = async (selector: quizSelector) => {
  try {
    const { db } = await connectToDatabase();
    // console.log(selector)
    const results = await db.collection('quiz').distinct('unit', {
      class: { $in: selector.cls },
    });
    return results;
  } catch (error) {
    console.error('Error fetching units:', error);
    throw error;
  }
};

export async function POST(request: NextRequest) {
  const headers = corsHeaders(null);

  try {
    const body = await request.json();
    const selector: quizSelector = body;

    const res = await getUnitsBySubject(selector);

    return NextResponse.json(res, {
      status: 200,
      headers: headers,
    });
  } catch (error) {
    console.error('Unit fetch error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Failed to fetch units', req: request }),
      {
        status: 500,
        headers: headers,
      },
    );
  }
}
