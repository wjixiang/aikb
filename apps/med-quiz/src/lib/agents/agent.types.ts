import { QuizWithUserAnswer } from "@/types/quizData.types";

import { retrieveTextBookSource } from "../langchain/retriever/noteBookRetriever";
import { Document } from "@langchain/core/documents";
import { rag_config } from "@/kgrag/lib/llm_workflow/rag_workflow";

export interface ChatMessage {
  originalMessage?: string;
  sender: "user" | "ai" | "system";
  timestamp: Date;
  isVisible: boolean;
  messageType: "content" | "status";
  status?: "processing" | "completed" | "failed";
  sources?: Reference[];
  CoT?: string;
  content: string;
  isErrorMessage?: boolean;
  metadata?: {
    node?: string;
    progress?: number;
    useHyDE?: boolean;
    useHybrid?: boolean;
    useReasoning?: boolean;
  };
}

export interface AgentState {
  messages: ChatMessage[];
  documents: Document<retrieveTextBookSource>[];
  currentStep: string;
  agentOutput?: string;
  collectionName?: string;
}

export type Reference = {
  title: string;
  page_number?: string;
  score: number;
  content: string;
  presigned_url: string;
};

// export interface AgentNode {
//     name: string;
//     description: string;
//     execute: (state: AgentState) => Promise<AgentState>;
// }

export interface AgentWorkflow {
  nodes: AgentNode[];
  edges: {
    source: string;
    target: string;
    condition?: (state: AgentState) => boolean;
  }[];
}

export interface AgentConfig {
  workflow: AgentWorkflow;
  maxIterations?: number;
  verbose?: boolean;
}

/**
 * Unified types for agent communication
 */

export type AgentMessageType =
  | "step" // Progress update
  | "update" // Content update
  | "done" // Completion
  | "error" // Error occurred
  | "notice" // Informational message
  | "result" // Final result
  | "references" // References/citations
  | "quizzes" // Quiz data
  | "stream"
  | "cot" // Chain of Thought reasoning
  | "speech"; // Speech synthesis data

export interface AgentMessage {
  type: AgentMessageType;
  content: string;
  task?: string; // Task name if applicable
  data?: any; // Additional data payload
  references?: []; // References/citations
  node?: string; // Node name if applicable
  status?: "start" | "end" | "error"; // Node status
  error?: string; // Error details if type is 'error'
  quizzes?: QuizWithUserAnswer[]; // Quiz data if type is 'quizzes'
  speechData?: {
    text: string;
    audioUrl?: string;
    isComplete?: boolean;
    language?: string;
  };
}

export interface NodeStatus {
  node: string;
  status: "start" | "end" | "error";
  error?: string;
}

export interface ChatReq {
  mode: "simple" | "agent";
  messages: ChatMessage[];
  analysisLLMId?: string;
  workerLLMId?: string;
  selectedSource?: string;
  rag_config: rag_config;
}

export interface AgentNode {
  taskName: string;
  execute(state: ChatMessage[], query: string): AsyncGenerator<AgentMessage>;
}

export interface AgentStep {
  type: AgentMessageType;
  task: string;
  content: string;
  isFinal?: boolean;
  data?: {
    documents?: Reference[];
  };
  status?: "start" | "end" | "error";
  speechData?: {
    text: string;
    audioUrl?: string;
    isComplete?: boolean;
    language?: string;
  };
}
