import { ResearchAgent } from "./researchAgent";
import { AnalysisAgent } from "./analysisAgent";
import { AgentTask, AgentProfile } from "../AgentV3";
import AgentV3 from "../AgentV3";

// A more sophisticated example showing delegation between different agent types
class ResearchCrew {
  private researchAgent: ResearchAgent;
  private analysisAgent: AnalysisAgent;

  constructor(task: AgentTask) {
    this.researchAgent = new ResearchAgent(task);
    this.analysisAgent = new AnalysisAgent(task);

    // Set up the follow agent relationship
    this.researchAgent.agentProfile.followAgents = [
      this.analysisAgent.agentProfile,
    ];
  }

  async *execute(): AsyncGenerator<import("../agent.types").AgentMessage> {
    console.log("Starting Research Crew execution...");

    // Execute the research agent first
    for await (const message of this.researchAgent.execute()) {
      yield message;

      // If we get a delegation message, we could handle it here
      if (message.type === "notice" && message.content.includes("Delegating")) {
        console.log("Research agent is delegating to analysis agent");
      }
    }

    console.log("Research Crew execution completed.");
  }
}

// Example usage of the crew
async function runCrewExample() {
  console.log("Starting Research Crew example...");

  // Create a task
  const task: AgentTask = {
    taskName: "MarketAnalysis",
    taskDescription: "Analyze the current market trends for AI products",
  };

  console.log(`Task: ${task.taskName}\nDescription: ${task.taskDescription}\n`);

  try {
    // Create the crew
    const crew = new ResearchCrew(task);

    // Execute the crew
    for await (const message of crew.execute()) {
      console.log(
        `[${message.type}] ${message.task || "general"}: ${message.content}`,
      );
    }

    console.log("\nCrew execution completed.");
  } catch (error) {
    console.error("Error running crew:", error);
  }
}

// Enhanced AgentV3 with actual delegation implementation
class EnhancedResearchAgent extends ResearchAgent {
  // Override to provide actual delegation
  protected async createDelegateAgent(
    profile: AgentProfile,
  ): Promise<AgentV3 | null> {
    if (profile.agentName === "AnalysisAgent") {
      // Create a real analysis agent
      const analysisAgent = new AnalysisAgent(this.task);
      return analysisAgent;
    }
    return null;
  }
}

// Example with actual delegation
async function runDelegationExample() {
  console.log("Starting Delegation example...");

  // Create a task
  const task: AgentTask = {
    taskName: "TechnologyReview",
    taskDescription: "Review the latest developments in quantum computing",
  };

  console.log(`Task: ${task.taskName}\nDescription: ${task.taskDescription}\n`);

  try {
    // Create the enhanced research agent
    const agent = new EnhancedResearchAgent(task);

    // Execute the agent
    for await (const message of agent.execute()) {
      console.log(
        `[${message.type}] ${message.task || "general"}: ${message.content}`,
      );
    }

    console.log("\nDelegation example completed.");
  } catch (error) {
    console.error("Error running delegation example:", error);
  }
}

export {
  runCrewExample,
  runDelegationExample,
  ResearchCrew,
  EnhancedResearchAgent,
};
