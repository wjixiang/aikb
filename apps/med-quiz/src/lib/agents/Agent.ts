import { ChatMessage } from "./agent.types";
import type { Task } from "@/types/baml";
import { QuizQueryService } from "../quiz/quiz_graph_query_service";
import ChunkStorage, { EmbeddingFunc } from "@/kgrag/database/chunkStorage";
import { embedding } from "@/kgrag/lib/embedding";
import { ExecuteRAGNode } from "./ExecuteRAGNode"; // Import concrete node implementations
import { FetchQuizzesNode } from "./FetchQuizzesNode";

import { AgentMessage, AgentNode } from "./agent.types";
import { rag_config } from "@/kgrag/lib/llm_workflow/rag_workflow";

/**
 * Represents the initial tasks that the Agent can execute.
 * Each task has a name, description, and example user queries.
 */
const inital_tasks: Task[] = [
  {
    task_name: "Execute_RAG",
    task_description:
      "This task will execute RAG searching function and get relivant documents. This is helpful to anwser various question about medical knowledge.",
    task_example_user_query: ["高血压的治疗", "流脑的病理变化"],
  },
  // {
  //     task_name: "Fetch_Quizzes",
  //     task_description: "This task will find some quizzes relavant to user's query. This is helpful when user want to practice, ecspecilly when the user has clearly indicated to generate quizzes.",
  //     task_example_user_query: ["找几道有关于呼吸衰竭的治疗的习题", "干酪性坏死主要见于哪些疾病？帮我找几道题"]
  // },
  // {
  //     task_name: "Analyze_Quiz",
  //     task_description: "This task will analyze a given quiz and provide a detailed explanation based on relevant medical knowledge.",
  //     task_example_user_query: ["[一道完整的试题]","分析这道题：[Quiz Content Here]", "请解析一下这道关于高血压的题目"]
  // }
];

export interface agent_config {
  rag_config: rag_config;
}

/**
 * The main Agent class responsible for managing and executing various tasks.
 * It coordinates between different nodes to handle user queries related to medical knowledge.
 */
export class Agent {
  /**
   * The current chat message state.
   */
  state: ChatMessage[] = [];
  config: agent_config;

  /**
   * Array of registered nodes that can execute specific tasks.
   */
  private nodes: AgentNode[] = [];

  /**
   * Creates a new Agent instance.
   * @param db - The SurrealDB instance to use for database operations.
   * @param kgretriever - The KnowledgeGraphRetriever to use for knowledge graph queries.
   */
  constructor(config: agent_config) {
    this.config = config;
    // Register nodes
    // this.registerNode(new ExecuteRAGNode());
  }

  /**
   * Registers a node with the agent.
   * @param node - The node to register.
   */
  registerNode(node: AgentNode) {
    this.nodes.push(node);
  }

  /**
   * Starts the agent's execution process for a given query.
   * @param query - The user query to process.
   * @returns An async generator yielding AgentStep objects representing the execution process.
   */
  async *start(query: string): AsyncGenerator<AgentMessage> {
    try {
      // const {selected_task, response} = await b.PlanNextStep(query, inital_tasks)

      const selected_task = "Execute_RAG";
      const response = "";
      // Yield the planned step
      yield {
        type: "step",
        content: `Planned next step: ${selected_task}`,
        task: selected_task,
      };

      yield {
        type: "notice",
        content: response,
        task: selected_task,
      };

      // Find and execute the appropriate node
      const nodeToExecute = new ExecuteRAGNode();

      if (nodeToExecute) {
        for await (const step of nodeToExecute.execute(
          this.state,
          query,
          this.config.rag_config,
        )) {
          yield step; // Yield results from the node
        }
      } else {
        console.warn(`No node found for task: ${selected_task}`);
        yield {
          type: "error",
          content: `No node found for task: ${selected_task}`,
          task: selected_task,
        };
      }
    } catch (error) {
      console.error("Failed to plan next step:", error);
      yield {
        type: "error",
        content: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
