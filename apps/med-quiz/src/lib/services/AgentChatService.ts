import { Agent, agent_config } from "../agents/Agent";
import { AgentService } from "./agentService";
import { chatBackendService } from "./ChatBackendService";
import { language } from "@/kgrag/type";

export class AgentChatService {
  private static instances = new Map<string, AgentChatService>();
  private agentService: AgentService;
  private sessionId: string;

  constructor(sessionId: string, config: agent_config) {
    this.sessionId = sessionId;
    this.agentService = new AgentService(new Agent(config), config);
  }

  public static async getInstance(
    sessionId: string,
    config: agent_config,
  ): Promise<AgentChatService> {
    if (this.instances.has(sessionId)) {
      return this.instances.get(sessionId)!;
    }
    const service = new AgentChatService(sessionId, config);
    this.instances.set(sessionId, service);
    return service;
  }

  /**
   * Process user query with AI agent and stream results to frontend
   */
  async processUserQuery(
    query: string,
    options: {
      mode: "simple" | "agent";
      selectedSource?: string;
      analysisLLMId?: string;
      workerLLMId?: string;
      useHyDE?: boolean;
      useHybrid?: boolean;
    },
  ): Promise<void> {
    try {
      console.log("AgentChatService processing query:", {
        query,
        options,
        sessionId: this.sessionId,
      });

      // Ensure session exists
      chatBackendService.ensureSession(this.sessionId);

      // Send initial status
      await chatBackendService.sendStatus(
        this.sessionId,
        "正在分析您的问题...",
      );

      // Prepare request
      const request = {
        mode: options.mode,
        messages: [
          {
            content: query,
            sender: "user" as const,
            timestamp: new Date(),
            isVisible: true,
            messageType: "content" as const,
          },
        ],
        analysisLLMId: options.analysisLLMId || "",
        workerLLMId: options.workerLLMId || "",
        selectedSource: options.selectedSource || "vault",
        rag_config: {
          useHyDE: options.useHyDE || false,
          useHybrid: options.useHybrid || false,
          topK: 10,
          language: "zh" as language,
        },
      };

      // Process with agent
      const agentStream = this.agentService.processRequest(request);
      const transformedStream =
        this.agentService.transformAgentStream(agentStream);

      // Stream results to frontend
      for await (const step of transformedStream) {
        const stepData = step as any;

        switch (step.type) {
          case "step":
            await chatBackendService.sendStatus(this.sessionId, step.content);
            break;

          case "update":
            await chatBackendService.pushMessage(this.sessionId, {
              type: "ai",
              content: step.content,
            });
            break;

          case "done":
            await chatBackendService.completeConversation(
              this.sessionId,
              step.content,
            );
            break;

          case "error":
            await chatBackendService.pushMessage(this.sessionId, {
              type: "system",
              content: `错误: ${step.content}`,
            });
            break;

          case "result":
            if (stepData.task === "Execute_RAG" && stepData.data?.documents) {
              await chatBackendService.pushMessage(this.sessionId, {
                type: "ai",
                content: step.content,
                data: { references: stepData.data.documents },
              });
            }
            break;
        }
      }
    } catch (error) {
      console.error("Error processing with agent:", error);
      await chatBackendService.pushMessage(this.sessionId, {
        type: "system",
        content: `处理失败: ${error instanceof Error ? error.message : "未知错误"}`,
      });
    }
  }

  /**
   * Start a backend-initiated conversation
   */
  async startConversation(initialMessage: string): Promise<void> {
    await chatBackendService.startConversation(this.sessionId, initialMessage);
  }

  /**
   * Continue conversation with next message
   */
  async continueConversation(message: string, data?: any): Promise<void> {
    await chatBackendService.continueConversation(
      this.sessionId,
      message,
      data,
    );
  }

  /**
   * Complete conversation
   */
  async completeConversation(finalMessage?: string): Promise<void> {
    await chatBackendService.completeConversation(this.sessionId, finalMessage);
  }

  /**
   * Get conversation history
   */
  getHistory(): any[] {
    return chatBackendService.getHistory(this.sessionId);
  }

  /**
   * Clear session
   */
  clearSession(): void {
    chatBackendService.clearSession(this.sessionId);
    AgentChatService.instances.delete(this.sessionId);
  }
}

// Export singleton access
export const agentChatService = {
  async getInstance(sessionId: string, config: agent_config) {
    return await AgentChatService.getInstance(sessionId, config);
  },
};
