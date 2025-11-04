import AgentV3, {
  AgentTask,
  AgentProfile,
  TaskCompletionResult,
} from './AgentV3';
import { AgentMessage } from './agent.types';

// Example concrete implementation of AgentV3
export class ExampleAgent extends AgentV3 {
  // Implementation of the required abstract property
  agentProfile: AgentProfile = {
    agentName: 'ExampleAgent',
    functionDescription:
      'An example agent that demonstrates the AgentV3 framework',
    followAgents: [],
  };

  constructor(task: AgentTask) {
    super(task);
    // Set a lower max iterations for demo purposes
    this.maxIterations = 3;
  }

  // Implementation of the required abstract method
  async *start(): AsyncGenerator<AgentMessage> {
    yield {
      type: 'step',
      content: `Executing task: ${this.task.taskName}`,
      task: this.task.taskName,
    };

    // Simulate some work being done
    yield {
      type: 'update',
      content: 'Processing task data...',
      task: this.task.taskName,
    };

    // Simulate work with a delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    yield {
      type: 'update',
      content: 'Task processing complete',
      task: this.task.taskName,
    };
  }

  // Implementation of the required abstract method
  protected async evaluateTaskCompletion(): Promise<TaskCompletionResult> {
    // This is a simple example - in a real implementation, this would
    // contain logic to evaluate the actual task completion

    // For demo purposes, we'll simulate different outcomes based on iteration
    if (this.currentIteration < 2) {
      return {
        isComplete: false,
        nextAction: 'continue',
        feedback: `Task not yet complete, continuing iteration ${this.currentIteration}`,
      };
    } else if (this.currentIteration === 2) {
      // On the second iteration, we'll decide to delegate
      return {
        isComplete: false,
        nextAction: 'delegate',
        delegateTo: this.selectFollowUpAgent() || undefined,
        feedback: `Task requires specialized handling, delegating to follow-up agent`,
      };
    } else {
      // On the final iteration, we'll finish
      return {
        isComplete: true,
        nextAction: 'finish',
        feedback: `Task completed successfully after ${this.currentIteration} iterations`,
      };
    }
  }

  // Override the createDelegateAgent method for demonstration
  protected async createDelegateAgent(
    profile: AgentProfile,
  ): Promise<AgentV3 | null> {
    // In a real implementation, this would create an actual agent instance
    // For this example, we'll just return null
    console.log(`Would create delegate agent: ${profile.agentName}`);
    return null;
  }
}

// Example usage
export async function runExample() {
  console.log('Starting AgentV3 example...');

  // Create a task
  const task: AgentTask = {
    taskName: 'DataAnalysis',
    taskDescription: 'Analyze user data and generate insights',
  };

  // Create an agent
  const agent = new ExampleAgent(task);

  // Execute the agent
  for await (const message of agent.execute()) {
    console.log(`[${message.type}] ${message.task}: ${message.content}`);
  }

  console.log('Agent execution completed.');
}

// Run the example if this file is executed directly
if (require.main === module) {
  runExample().catch(console.error);
}

export default ExampleAgent;
