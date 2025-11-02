import { NextRequest } from "next/server";
import { AgentChatService } from "@/lib/services/AgentChatService";
import { language } from "@/kgrag/type";

export async function POST(req: NextRequest) {
  try {
    console.log("Chat agent API called with:", {
      url: req.url,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
    });

    const requestData = await req.json();
    const {
      sessionId,
      message,
      mode,
      selectedSource,
      analysisLLMId,
      workerLLMId,
      useHyDE,
      useHybrid,
    } = requestData;

    console.log("Processing chat request:", {
      sessionId,
      message,
      mode,
      selectedSource,
    });

    if (!sessionId || !message) {
      console.error("Missing required fields:", { sessionId, message });
      return new Response(
        JSON.stringify({ error: "sessionId and message are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const agentConfig = {
      rag_config: {
        useHyDE: useHyDE || false,
        useHybrid: useHybrid || false,
        topK: 10,
        language: "zh" as language,
      },
    };

    const agentChatService = await AgentChatService.getInstance(
      sessionId,
      agentConfig,
    );

    // Process the query asynchronously
    agentChatService.processUserQuery(message, {
      mode,
      selectedSource,
      analysisLLMId,
      workerLLMId,
      useHyDE,
      useHybrid,
    });

    return new Response(JSON.stringify({ success: true, sessionId }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in agent chat API:", error);
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
