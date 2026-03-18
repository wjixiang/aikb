/**
 * LLM Pool - Main Entry Point
 *
 * Load balancer for LLM APIs with OpenAI and Anthropic compatibility
 */

import { LLMPoolServer, loadConfig } from './server.js';

async function main() {
  // Load configuration
  const configPath = process.argv[2];
  const config = loadConfig(configPath);

  // Create server
  const server = new LLMPoolServer(config);

  // Initialize (register routes, etc.)
  await server.initialize();

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start server
  await server.start();
}

main().catch((error) => {
  console.error('Failed to start LLM Pool server:', error);
  process.exit(1);
});
