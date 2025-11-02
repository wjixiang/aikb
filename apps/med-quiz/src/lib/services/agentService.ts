import { Agent, agent_config } from "../agents/Agent";
import { surrealDBClient } from "@/kgrag/database/surrrealdbClient";
import KnowledgeGraphRetriever from "@/kgrag/core/KnowledgeGraphRetriever";
import ChunkStorage from "@/kgrag/database/chunkStorage";
import { embedding } from "@/kgrag/lib/embedding";
import { ChatReq } from "../agents/agent.types";
import { Reference } from "../agents/agent.types";
import { AgentStep } from "../agents/agent.types";

export class AgentService {
  private static instances = new Map<string, AgentService>();
  private agent: Agent;
  config: agent_config;

  constructor(agent: Agent, config: agent_config) {
    this.agent = agent;
    this.config = config;
  }

  public static async getInstance(
    sessionId: string,
    config: agent_config,
  ): Promise<AgentService> {
    if (this.instances.has(sessionId)) {
      return this.instances.get(sessionId)!;
    }
    const agent = new Agent(config);
    const service = new AgentService(agent, config);
    this.instances.set(sessionId, service);
    return service;
  }

  public async *processRequest(request: ChatReq): AsyncGenerator<AgentStep> {
    const { messages } = request;
    const query = messages[messages.length - 1].content;

    for await (const message of this.agent.start(query)) {
      yield {
        type: message.type,
        task: message.task ?? "unknown", // Provide default if undefined
        content: message.content,
        isFinal: message.type === "done",
        data: message.data,
        status: message.status,
      };
    }
  }

  public async *transformAgentStream(stream: AsyncGenerator<AgentStep>) {
    let documents: Reference[] = [];
    let quizzes: any[] = [];

    for await (const step of stream) {
      // Forward all steps directly to maintain consistency
      yield step;

      // Track documents and quizzes for final message
      if (step.type === "result" && step.task === "Execute_RAG") {
        documents = step.data?.documents || documents;
      }
      // if (step.type === 'result' && step.task === 'Fetch_Quizzes') {
      //     quizzes = step.data?.quizzes || quizzes;
      // }

      // Send final message with all accumulated data
      if (step.type === "result") {
        yield {
          type: "done",
          content: step.content,
          references: documents,
          quizzes: quizzes.length ? quizzes : undefined,
        };
      }
    }
  }
}
