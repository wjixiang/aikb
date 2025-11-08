import { NextRequest, NextResponse } from 'next/server';
import { chatBackendService } from '@/lib/services/ChatBackendService';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, userQuery, agentConfig } = await request.json();

    // This will run asynchronously on the server
    chatBackendService
      .processWithAgent(sessionId, userQuery, agentConfig)
      .catch((error) => {
        console.error('Error in background agent processing:', error);
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error starting agent processing:', error);
    return NextResponse.json(
      { error: 'Failed to start agent processing' },
      { status: 500 },
    );
  }
}
