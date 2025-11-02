import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { chatHistoryService } from "@/lib/services/ChatHistoryService";
import { createLoggerWithPrefix } from "@/lib/console/logger";

const logger = createLoggerWithPrefix("DELETE_SESSION_ROUTE");

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  logger.info("DELETE request received for session deletion");
  console.log("DELETE request received for session deletion");

  try {
    const session = await getServerSession(authOptions);
    logger.debug("Session retrieved from getServerSession");
    console.log("Session retrieved from getServerSession", session?.user?.id);

    if (!session?.user?.id) {
      logger.warn("Authentication failed: No user session found");
      console.log("Authentication failed: No user session found");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { sessionId } = await params;
    logger.debug(`Session ID extracted from params: ${sessionId}`);
    console.log(`Session ID extracted from params: ${sessionId}`);

    if (!sessionId) {
      logger.warn("Session ID validation failed: No session ID provided");
      console.log("Session ID validation failed: No session ID provided");
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 400 },
      );
    }

    try {
      logger.info(`Attempting to delete session with ID: ${sessionId}`);
      console.log(`Attempting to delete session with ID: ${sessionId}`);
      await chatHistoryService.deleteSession(sessionId);
      logger.info(`Successfully deleted session with ID: ${sessionId}`);
      console.log(`Successfully deleted session with ID: ${sessionId}`);
      return NextResponse.json({ success: true });
    } catch (error: any) {
      logger.error(`Error deleting session with ID ${sessionId}:`, error);
      console.error(`Error deleting session with ID ${sessionId}:`, error);
      // Provide more specific error messages
      if (error.message === "Session not found or access denied") {
        logger.warn(
          `Session not found or access denied for session ID: ${sessionId}`,
        );
        console.log(
          `Session not found or access denied for session ID: ${sessionId}`,
        );
        return NextResponse.json(
          { error: "Session not found or access denied" },
          { status: 404 },
        );
      }

      logger.error(
        `Unexpected error during session deletion for ID ${sessionId}:`,
        error,
      );
      console.error(
        `Unexpected error during session deletion for ID ${sessionId}:`,
        error,
      );
      throw error; // Re-throw for general error handling
    }
  } catch (error: any) {
    logger.error("Error in DELETE session route handler:", error);
    console.error("Error in DELETE session route handler:", error);

    // Return more specific error messages
    if (error.message) {
      logger.error(`Returning error response with message: ${error.message}`);
      console.error(`Returning error response with message: ${error.message}`);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logger.error(
      "Returning generic error response for session deletion failure",
    );
    console.error(
      "Returning generic error response for session deletion failure",
    );
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 },
    );
  }
}
