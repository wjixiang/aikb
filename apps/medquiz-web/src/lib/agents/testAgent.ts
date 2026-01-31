import Agent from './Agent';
import { toolRegistry } from './toolRegistry';

/**
 * Test the enhanced Agent with tool calling
 */
async function testAgent() {
  console.log('Testing enhanced agent...');

  // Check available tools
  console.log(
    'Available tools:',
    toolRegistry.listTools().map((t) => t.name),
  );

  // Create a new agent instance
  const agent = new Agent();

  // Simple query that should trigger tool usage
  const query = "What's the weather like in Beijing?";

  console.log(`\nQuery: ${query}`);

  try {
    let messageCount = 0;
    // Run the agent and process the results
    for await (const message of agent.start(query)) {
      messageCount++;
      console.log(`\n[${messageCount}] Message:`);
      console.log(`  Type: ${message.type}`);
      console.log(`  Task: ${message.task || 'N/A'}`);
      console.log(`  Content: ${message.content}`);

      // Limit output for readability
      if (messageCount > 10) {
        console.log('... (output limited)');
        break;
      }
    }

    console.log('\nTest completed.');
  } catch (error) {
    console.error('Error testing agent:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testAgent().catch(console.error);
}

export { testAgent };
