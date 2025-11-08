import { NextRequest, NextResponse } from 'next/server';
import { quizSelector } from '@/types/quizSelector.types';
import QuizStorage from '@/lib/quiz/QuizStorage';

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

/**
 * 试题获取API
 * @param request
 * 示范请求：
 * ```json
 * {
 *      requestData: quizSelector
 * }
 * ```
 * @returns
 */
export async function POST(request: NextRequest) {
  const quizStorage = new QuizStorage();

  const headers = corsHeaders(null);
  // const isDev = process.env.NODE_ENV === 'development';

  try {
    const body = await request.json();
    const selector: quizSelector = body.selector;

    const quizes = await quizStorage.fetchQuizzes(selector, selector.email);

    // 返回查询结果
    return NextResponse.json(quizes, {
      status: 200,
      headers: headers,
    });
  } catch (error) {
    console.error('Quiz fetch error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Failed to fetch quizzes' }),
      {
        status: 500,
        headers: headers,
      },
    );
  }
}
