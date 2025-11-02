import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { chatHistoryService } from "@/lib/services/ChatHistoryService";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "10");

    const sessions = await chatHistoryService.getUserSessions();

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Error getting sessions:", error);
    return NextResponse.json(
      { error: "Failed to get sessions" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { title } = await request.json();
    const sessionId = await chatHistoryService.createSession(title);

    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error("Error creating session:", error);
    // Provide more detailed error information
    let errorMessage = "Failed to create session";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
