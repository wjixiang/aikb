import { NextRequest, NextResponse } from "next/server";
import { chatBackendService } from "@/lib/services/ChatBackendService";

export async function POST(request: NextRequest) {
  try {
    const { sessionId, finalMessage } = await request.json();

    await chatBackendService.completeConversation(sessionId, finalMessage);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error completing conversation:", error);
    return NextResponse.json(
      { error: "Failed to complete conversation" },
      { status: 500 },
    );
  }
}
