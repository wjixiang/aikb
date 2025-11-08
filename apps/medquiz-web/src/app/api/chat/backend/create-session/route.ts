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

    const { sessionId, title } = await request.json();

    // If sessionId is provided, use it; otherwise create new one
    const newSessionId =
      sessionId || (await chatHistoryService.createSession(title));

    return NextResponse.json({ sessionId: newSessionId });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 },
    );
  }
}
