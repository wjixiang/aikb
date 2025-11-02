import { NextRequest } from "next/server";
import { EventEmitter } from "events";

// Global event emitter for managing chat sessions
const chatEmitter = new EventEmitter();
chatEmitter.setMaxListeners(0); // No limit on listeners

// Store active sessions
const activeSessions = new Map<
  string,
  {
    messages: any[];
    lastActivity: number;
  }
>();

// Cleanup inactive sessions every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [sessionId, session] of activeSessions.entries()) {
      if (now - session.lastActivity > 5 * 60 * 1000) {
        activeSessions.delete(sessionId);
        chatEmitter.removeAllListeners(`session:${sessionId}`);
      }
    }
  },
  5 * 60 * 1000,
);

export async function POST(req: NextRequest) {
  try {
    const { sessionId, message } = await req.json();

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Initialize or update session
    if (!activeSessions.has(sessionId)) {
      activeSessions.set(sessionId, {
        messages: [],
        lastActivity: Date.now(),
      });
    }

    const session = activeSessions.get(sessionId)!;
    session.lastActivity = Date.now();

    // Add user message to history
    const userMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sender: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };

    session.messages.push(userMessage);

    // Create SSE response
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial connection message
        const initMessage = {
          type: "connected",
          sessionId,
          timestamp: new Date().toISOString(),
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(initMessage)}\n\n`),
        );

        // Listen for backend messages
        const onBackendMessage = (data: any) => {
          const message = {
            ...data,
            timestamp: new Date().toISOString(),
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(message)}\n\n`),
          );
        };

        chatEmitter.on(`session:${sessionId}`, onBackendMessage);

        // Process the message (this would be replaced with actual agent processing)
        setTimeout(() => {
          // Simulate backend processing
          const processingMessage = {
            type: "processing",
            content: "正在处理您的消息...",
            sessionId,
          };
          chatEmitter.emit(`session:${sessionId}`, processingMessage);

          // Simulate agent response
          setTimeout(() => {
            const aiMessage = {
              sender: "ai",
              content: `收到您的消息: "${message}"，正在为您生成回复...`,
              sessionId,
            };
            session.messages.push({
              ...aiMessage,
              id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            });
            chatEmitter.emit(`session:${sessionId}`, aiMessage);

            // Signal completion
            setTimeout(() => {
              const doneMessage = {
                type: "done",
                sessionId,
              };
              chatEmitter.emit(`session:${sessionId}`, doneMessage);
              controller.close();
            }, 1000);
          }, 1000);
        }, 500);

        // Cleanup on close
        req.signal.addEventListener("abort", () => {
          chatEmitter.removeListener(`session:${sessionId}`, onBackendMessage);
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in chat stream:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

// API endpoint for backend to push messages to frontend
export async function PUT(req: NextRequest) {
  try {
    const { sessionId, type, content, data } = await req.json();

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const message = {
      sender: type || "ai",
      content,
      data,
      sessionId,
    };

    // Emit to specific session
    chatEmitter.emit(`session:${sessionId}`, message);

    // Update session messages if it's an AI message
    if (type === "ai") {
      const session = activeSessions.get(sessionId);
      if (session) {
        session.messages.push({
          ...message,
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error pushing message:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

// EventSource endpoint for streaming
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "sessionId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Initialize session if it doesn't exist
  if (!activeSessions.has(sessionId)) {
    activeSessions.set(sessionId, {
      messages: [],
      lastActivity: Date.now(),
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const initMessage = {
        type: "connected",
        sessionId,
        timestamp: new Date().toISOString(),
      };
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(initMessage)}\n\n`),
      );

      // Listen for messages from the backend
      const onMessage = (data: any) => {
        const message = {
          ...data,
          timestamp: new Date().toISOString(),
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(message)}\n\n`),
        );
      };

      chatEmitter.on(`session:${sessionId}`, onMessage);

      // Handle client disconnect
      req.signal.addEventListener("abort", () => {
        chatEmitter.removeListener(`session:${sessionId}`, onMessage);
        controller.close();
      });

      // Keep connection alive
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "ping" })}\n\n`),
          );
        } catch (error) {
          // Controller is closed, clean up
          clearInterval(keepAlive);
        }
      }, 30000);

      // Cleanup when stream ends
      const cleanup = () => {
        clearInterval(keepAlive);
        chatEmitter.removeListener(`session:${sessionId}`, onMessage);
      };

      // Handle stream end
      req.signal.addEventListener("abort", cleanup);

      // Also cleanup when controller is closed
      const originalClose = controller.close.bind(controller);
      controller.close = () => {
        cleanup();
        return originalClose();
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

// Delete session
export async function DELETE(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "sessionId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Remove from active sessions
  const session = activeSessions.get(sessionId);
  if (session) {
    activeSessions.delete(sessionId);
    chatEmitter.removeAllListeners(`session:${sessionId}`);
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
