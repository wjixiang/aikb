import AgentV3, {
  AgentTask,
  AgentProfile,
  TaskCompletionResult,
} from '../AgentV3';
import { AgentMessage } from '../agent.types';

// Research agent that specializes in gathering information
export class ResearchAgent extends AgentV3 {
  agentProfile: AgentProfile = {
    agentName: 'ResearchAgent',
    functionDescription: 'Specializes in gathering and researching information',
    followAgents: [], // Could link to analysis agent
  };

  constructor(task: AgentTask) {
    super(task);
    this.maxIterations = 2;
  }

  async *start(): AsyncGenerator<AgentMessage> {
    yield {
      type: 'step',
      content: `Research agent starting work on: ${this.task.taskName}`,
      task: this.task.taskName,
    };

    yield {
      type: 'update',
      content: 'Searching databases and sources...',
      task: this.task.taskName,
    };

    // Simulate research work
    await new Promise((resolve) => setTimeout(resolve, 1500));

    yield {
      type: 'update',
      content: 'Found relevant sources and data',
      task: this.task.taskName,
    };

    yield {
      type: 'update',
      content: 'Research phase complete',
      task: this.task.taskName,
    };
  }

  protected async evaluateTaskCompletion(): Promise<TaskCompletionResult> {
    // Research agent focuses on gathering information
    if (this.currentIteration < this.maxIterations) {
      return {
        isComplete: false,
        nextAction: 'continue',
        feedback: `Research iteration ${this.currentIteration} complete, continuing research`,
      };
    } else {
      // After research is done, delegate to analysis agent
      return {
        isComplete: false,
        nextAction: 'delegate',
        delegateTo: {
          agentName: 'AnalysisAgent',
          functionDescription: 'Analyzes data and generates insights',
          followAgents: [],
        },
        feedback: 'Research complete, delegating to analysis agent',
      };
    }
  }

  protected async createDelegateAgent(
    profile: AgentProfile,
  ): Promise<AgentV3 | null> {
    if (profile.agentName === 'AnalysisAgent') {
      // In a real implementation, we would import and create the AnalysisAgent
      console.log('Creating AnalysisAgent for delegation');
      return null; // Placeholder
    }
    return null;
  }
}

export default ResearchAgent;
