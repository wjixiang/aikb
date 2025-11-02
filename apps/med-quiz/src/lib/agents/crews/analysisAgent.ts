import AgentV3, {
  AgentTask,
  AgentProfile,
  TaskCompletionResult,
} from "../AgentV3";
import { AgentMessage } from "../agent.types";

// Analysis agent that specializes in analyzing data
export class AnalysisAgent extends AgentV3 {
  agentProfile: AgentProfile = {
    agentName: "AnalysisAgent",
    functionDescription: "Analyzes data and generates insights",
    followAgents: [], // Could link to reporting agent
  };

  constructor(task: AgentTask) {
    super(task);
    this.maxIterations = 2;
  }

  async *start(): AsyncGenerator<AgentMessage> {
    yield {
      type: "step",
      content: `Analysis agent starting work on: ${this.task.taskName}`,
      task: this.task.taskName,
    };

    yield {
      type: "update",
      content: "Analyzing collected data...",
      task: this.task.taskName,
    };

    // Simulate analysis work
    await new Promise((resolve) => setTimeout(resolve, 1500));

    yield {
      type: "update",
      content: "Identified key patterns and insights",
      task: this.task.taskName,
    };

    yield {
      type: "update",
      content: "Analysis phase complete",
      task: this.task.taskName,
    };
  }

  protected async evaluateTaskCompletion(): Promise<TaskCompletionResult> {
    // Analysis agent focuses on data analysis
    if (this.currentIteration < this.maxIterations) {
      return {
        isComplete: false,
        nextAction: "continue",
        feedback: `Analysis iteration ${this.currentIteration} complete, continuing analysis`,
      };
    } else {
      // After analysis is done, finish the task
      return {
        isComplete: true,
        nextAction: "finish",
        feedback: "Analysis complete, task finished",
      };
    }
  }

  protected async createDelegateAgent(
    profile: AgentProfile,
  ): Promise<AgentV3 | null> {
    // Could delegate to a reporting agent or other specialized agent
    console.log(`Analysis agent would delegate to: ${profile.agentName}`);
    return null;
  }
}

export default AnalysisAgent;
