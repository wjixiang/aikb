import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { chatHistoryService } from '@/lib/services/ChatHistoryService';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    const { sessionId, type, content, data } = await request.json();

    await chatHistoryService.addMessage(sessionId, {
      type,
      content,
      data,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error pushing message:', error);
    return NextResponse.json(
      { error: 'Failed to push message' },
      { status: 500 },
    );
  }
}
