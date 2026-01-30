import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { chatHistoryService } from '@/lib/services/ChatHistoryService';
import { createLoggerWithPrefix } from '@/lib/console/logger';

const logger = createLoggerWithPrefix('ChatHistoryRoute');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  logger.info('GET request received for chat history');

  try {
    const session = await getServerSession(authOptions);
    logger.debug('Session retrieved', { userId: session?.user?.id });

    if (!session?.user?.id) {
      logger.warn('Authentication failed - no valid session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    const { sessionId } = await params;
    logger.info('Fetching messages for session', { sessionId });

    const messages = await chatHistoryService.getMessages(sessionId);
    logger.debug('Messages retrieved successfully', { count: messages.length });

    logger.info('Successfully returning chat history', {
      sessionId,
      messageCount: messages.length,
    });
    return NextResponse.json({ messages });
  } catch (error) {
    logger.error('Error getting chat history', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to get history' },
      { status: 500 },
    );
  }
}
