import { ExampleAgent } from "./exampleAgent";
import { AgentTask } from "./AgentV3";

async function testAgentV3() {
  console.log("Testing AgentV3 functionality...");

  // Create a task
  const task: AgentTask = {
    taskName: "TestTask",
    taskDescription: "A test task to demonstrate AgentV3 functionality",
  };

  // Create an agent
  const agent = new ExampleAgent(task);

  console.log(`Created agent for task: ${task.taskName}`);

  // Execute the agent
  console.log("\nExecuting agent...");
  for await (const message of agent.execute()) {
    console.log(`[${message.type}] ${message.task}: ${message.content}`);
  }

  console.log("\nAgent execution completed.");
}

if (require.main === module) {
  testAgentV3().catch(console.error);
}

export { testAgentV3 };
