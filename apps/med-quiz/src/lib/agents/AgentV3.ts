import { AgentMessage } from "./agent.types";

export interface AgentTask {
  taskName: string;
  taskDescription: string;
}

export interface AgentProfile {
  agentName: string;
  functionDescription: string;
  followAgents: AgentProfile[];
}

export interface TaskCompletionResult {
  isComplete: boolean;
  qualityScore?: number;
  nextAction: "continue" | "delegate" | "finish";
  delegateTo?: AgentProfile;
  feedback?: string;
}

/**
 * Abstract base class for all agents implementing the iterator pattern
 *
 * This class provides an abstract iterator interface for agents to yield messages
 * during task execution. It supports both async generator pattern and traditional
 * hasNext/next pattern for flexibility.
 *
 * Usage:
 * 1. Extend this class and implement the abstract methods
 * 2. Use the async generator pattern (for await...of) with the start() method
 * 3. Or use the hasNext()/next() pattern for manual iteration control
 */
export default abstract class AgentV3 {
  task: AgentTask;
  maxIterations: number = 5;
  currentIteration: number = 0;

  abstract agentProfile: AgentProfile;

  constructor(task: AgentTask) {
    this.task = task;
  }

  /**
   * Abstract async generator method that yields AgentMessages
   *
   * This is the primary method for implementing the iterator pattern.
   * Subclasses should implement this method to yield messages during task execution.
   *
   * @example
   * async *start(): AsyncGenerator<AgentMessage> {
   *   yield { type: "step", content: "Starting task" };
   *   // ... task logic
   *   yield { type: "done", content: "Task completed" };
   * }
   */
  abstract start(): AsyncGenerator<AgentMessage>;

  /**
   * Execute the agent task with self-iteration and delegation logic
   *
   * This method orchestrates the agent's behavior:
   * 1. Runs the agent task
   * 2. Evaluates completion after each iteration
   * 3. Decides whether to continue, delegate, or finish
   */
  async *execute(): AsyncGenerator<AgentMessage> {
    this.currentIteration = 0;

    while (this.currentIteration < this.maxIterations) {
      this.currentIteration++;

      // Yield a message indicating the start of this iteration
      yield {
        type: "step",
        content: `Starting iteration ${this.currentIteration} for task: ${this.task.taskName}`,
        task: this.task.taskName,
      };

      // Execute the agent's main task logic
      for await (const message of this.start()) {
        yield message;
      }

      // Evaluate task completion
      const completionResult = await this.evaluateTaskCompletion();

      // Yield evaluation result
      yield {
        type: "update",
        content: `Task evaluation: ${completionResult.feedback || "No feedback"}`,
        task: this.task.taskName,
      };

      // Make decision based on evaluation
      switch (completionResult.nextAction) {
        case "continue":
          yield {
            type: "notice",
            content: "Continuing with next iteration...",
            task: this.task.taskName,
          };
          continue;

        case "delegate":
          if (completionResult.delegateTo) {
            yield {
              type: "notice",
              content: `Delegating to agent: ${completionResult.delegateTo.agentName}`,
              task: this.task.taskName,
            };

            // Create and execute the delegate agent
            const delegateAgent = await this.createDelegateAgent(
              completionResult.delegateTo,
            );
            if (delegateAgent) {
              for await (const message of delegateAgent.execute()) {
                yield message;
              }
            }
          }
          yield {
            type: "done",
            content: "Task completed with delegation",
            task: this.task.taskName,
          };
          return;

        case "finish":
          yield {
            type: "done",
            content: "Task completed successfully",
            task: this.task.taskName,
          };
          return;
      }
    }

    // Max iterations reached
    yield {
      type: "error",
      content: "Maximum iterations reached without completion",
      task: this.task.taskName,
    };
  }

  /**
   * Evaluate task completion and decide next action
   *
   * Subclasses should implement this method to provide their own logic
   * for determining if a task is complete and what to do next.
   */
  protected abstract evaluateTaskCompletion(): Promise<TaskCompletionResult>;

  /**
   * Create a delegate agent based on profile
   *
   * Subclasses can override this method to provide custom agent creation logic.
   * This default implementation returns null and should be overridden.
   */
  protected async createDelegateAgent(
    profile: AgentProfile,
  ): Promise<AgentV3 | null> {
    // This is a placeholder implementation
    // Subclasses should implement this to create actual agent instances
    return null;
  }

  /**
   * Select the most appropriate follow-up agent
   *
   * This method can be used by evaluateTaskCompletion to choose
   * which agent to delegate to next.
   */
  protected selectFollowUpAgent(): AgentProfile | null {
    if (
      this.agentProfile.followAgents &&
      this.agentProfile.followAgents.length > 0
    ) {
      // For now, we'll just return the first follow agent
      // In a more sophisticated implementation, this could use
      // some criteria to select the best agent
      return this.agentProfile.followAgents[0];
    }
    return null;
  }
}
