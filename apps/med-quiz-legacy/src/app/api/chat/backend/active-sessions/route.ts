import { NextRequest, NextResponse } from 'next/server';
import { chatBackendService } from '@/lib/services/ChatBackendService';

export async function GET(request: NextRequest) {
  try {
    const sessions = chatBackendService.getActiveSessions();

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error getting active sessions:', error);
    return NextResponse.json(
      { error: 'Failed to get active sessions' },
      { status: 500 },
    );
  }
}
