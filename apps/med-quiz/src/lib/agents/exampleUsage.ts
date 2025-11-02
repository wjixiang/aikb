import AgentV2 from "./AgentV2";
import { AgentMessage } from "./agent.types";
import * as dotenv from "dotenv";
import { runV3Example } from "./exampleUsageV3";
import { runCrewExample, runDelegationExample } from "./crews/exampleCrew";

dotenv.config();

/**
 * Example usage of the enhanced AgentV2 with tool calling
 */
async function runExample() {
  console.log("=== AgentV2 Example ===");

  // Create a new agent instance
  const agent = new AgentV2();

  // Example query that should trigger tool usage
  const query = "What's the weather like in Beijing today?";

  console.log(`Query: ${query}\n`);

  try {
    // Run the agent and process the results
    for await (const message of agent.start(query)) {
      console.log(
        `[${message.type}] ${message.task || "general"}: ${message.content}`,
      );

      // Handle different message types
      switch (message.type) {
        case "step":
          console.log(`  → Step: ${message.content}`);
          break;
        case "notice":
          console.log(`  → Notice: ${message.content}`);
          break;
        case "update":
          console.log(`  → Update: ${message.content}`);
          break;
        case "result":
          console.log(`  → Result: ${message.content}`);
          break;
        case "error":
          console.log(`  → Error: ${message.content}`);
          break;
      }
    }

    console.log("\nAgent execution completed.");
  } catch (error) {
    console.error("Error running agent:", error);
  }

  console.log("\n=== AgentV3 Example ===");
  await runV3Example();

  console.log("\n=== Research Crew Example ===");
  await runCrewExample();

  console.log("\n=== Delegation Example ===");
  await runDelegationExample();
}

// Run the example if this file is executed directly
if (require.main === module) {
  runExample().catch(console.error);
}

export { runExample };
