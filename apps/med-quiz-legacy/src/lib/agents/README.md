# AgentV3 Framework

The AgentV3 framework is an enhanced agent system that provides task binding, self-iteration, and delegation capabilities.

## Features

1. **Task Binding**: Each agent is bound to a specific task with a clear name and description
2. **Self-Iteration**: Agents can iterate on their tasks multiple times to improve results
3. **Decision Making**: After each iteration, agents evaluate their progress and decide whether to continue, delegate, or finish
4. **Delegation**: Agents can delegate tasks to other specialized agents when appropriate
5. **Extensible Design**: Abstract base class that can be extended for specific use cases

## Core Components

### AgentV3 Abstract Base Class

The `AgentV3` class is an abstract base class that provides the core functionality:

- `task`: The task the agent is bound to
- `agentProfile`: Profile information including name, description, and follow-up agents
- `maxIterations`: Maximum number of iterations allowed
- `execute()`: Main execution method that orchestrates the agent's behavior
- `start()`: Abstract method that must be implemented by subclasses
- `evaluateTaskCompletion()`: Abstract method for evaluating task progress
- `createDelegateAgent()`: Method for creating delegate agents

### AgentTask Interface

```typescript
interface AgentTask {
  taskName: string;
  taskDescription: string;
}
```

### AgentProfile Interface

```typescript
interface AgentProfile {
  agentName: string;
  functionDescription: string;
  followAgents: AgentProfile[];
}
```

### TaskCompletionResult Interface

```typescript
interface TaskCompletionResult {
  isComplete: boolean;
  qualityScore?: number;
  nextAction: "continue" | "delegate" | "finish";
  delegateTo?: AgentProfile;
  feedback?: string;
}
```

## Usage Example

```typescript
import AgentV3, {
  AgentTask,
  AgentProfile,
  TaskCompletionResult,
} from "./AgentV3";
import { AgentMessage } from "./agent.types";

class ExampleAgent extends AgentV3 {
  agentProfile: AgentProfile = {
    agentName: "ExampleAgent",
    functionDescription:
      "An example agent that demonstrates the AgentV3 framework",
    followAgents: [],
  };

  async *start(): AsyncGenerator<AgentMessage> {
    // Implementation of the agent's main logic
    yield {
      type: "step",
      content: `Executing task: ${this.task.taskName}`,
      task: this.task.taskName,
    };
  }

  protected async evaluateTaskCompletion(): Promise<TaskCompletionResult> {
    // Implementation of task evaluation logic
    return {
      isComplete: true,
      nextAction: "finish",
      feedback: "Task completed successfully",
    };
  }
}

// Usage
const task: AgentTask = {
  taskName: "DataAnalysis",
  taskDescription: "Analyze user data and generate insights",
};

const agent = new ExampleAgent(task);
for await (const message of agent.execute()) {
  console.log(`[${message.type}] ${message.task}: ${message.content}`);
}
```

## Delegation Example

Agents can delegate tasks to other specialized agents:

```typescript
class ResearchAgent extends AgentV3 {
  protected async evaluateTaskCompletion(): Promise<TaskCompletionResult> {
    // After research is done, delegate to analysis agent
    return {
      isComplete: false,
      nextAction: "delegate",
      delegateTo: {
        agentName: "AnalysisAgent",
        functionDescription: "Analyzes data and generates insights",
        followAgents: [],
      },
      feedback: "Research complete, delegating to analysis agent",
    };
  }

  protected async createDelegateAgent(
    profile: AgentProfile,
  ): Promise<AgentV3 | null> {
    if (profile.agentName === "AnalysisAgent") {
      return new AnalysisAgent(this.task);
    }
    return null;
  }
}
```

## Key Benefits

1. **Focused Agents**: Each agent is designed for a specific task
2. **Self-Improvement**: Agents can iterate to improve their results
3. **Flexible Workflow**: Agents can delegate to other specialized agents
4. **Clear Decision Making**: Built-in evaluation and decision logic
5. **Extensible**: Easy to create new agent types by extending the base class

## Running Examples

To run the examples:

```bash
# Run the basic AgentV3 example
npx tsx src/lib/agents/testAgentV3.ts

# Run the full example with delegation
npx tsx src/lib/agents/exampleUsage.ts
```
