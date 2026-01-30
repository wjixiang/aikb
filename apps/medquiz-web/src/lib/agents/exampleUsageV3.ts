import { ExampleAgent, runExample } from './exampleAgent';
import { AgentMessage } from './agent.types';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Example usage of the enhanced AgentV3 with self-iteration and delegation
 */
async function runV3Example() {
  console.log('Starting AgentV3 example...');

  // Example task
  const task = {
    taskName: 'ResearchTask',
    taskDescription: 'Research and analyze the latest trends in AI',
  };

  console.log(`Task: ${task.taskName}\nDescription: ${task.taskDescription}\n`);

  try {
    // Create an example agent
    const agent = new ExampleAgent(task);

    // Run the agent and process the results
    for await (const message of agent.execute()) {
      console.log(
        `[${message.type}] ${message.task || 'general'}: ${message.content}`,
      );

      // Handle different message types
      switch (message.type) {
        case 'step':
          console.log(`  → Step: ${message.content}`);
          break;
        case 'notice':
          console.log(`  → Notice: ${message.content}`);
          break;
        case 'update':
          console.log(`  → Update: ${message.content}`);
          break;
        case 'done':
          console.log(`  → Done: ${message.content}`);
          break;
        case 'error':
          console.log(`  → Error: ${message.content}`);
          break;
      }
    }

    console.log('\nAgentV3 execution completed.');
  } catch (error) {
    console.error('Error running AgentV3:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runV3Example().catch(console.error);
}

export { runV3Example };
