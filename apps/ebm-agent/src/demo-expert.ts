import 'reflect-metadata';
import { ExpertAgentFactory } from 'agent-lib';
import config from '../experts/pubmed-retrieve';
import { config as conf } from 'dotenv';
conf();

async function main() {
  const apiKey = process.env['GLM_API_KEY'];
  const mailboxUrl = process.env['MAILBOX_URL'] || 'http://localhost:3000';

  if (!apiKey) {
    throw new Error('No API key found. Set MINIMAX_API_KEY');
  }

  // Apply runtime configuration
  config.apiConfiguration = {
    apiProvider: 'zai',
    apiKey: apiKey,
    apiModelId: 'glm-4.5',
    zaiApiLine: 'china_coding'
  };

  // Enable mail-driven mode
  config.mailConfig = {
    enabled: true,
    baseUrl: mailboxUrl,
    pollInterval: 10000,
  };

  // Create and start expert agent directly
  const agent = await ExpertAgentFactory.createExpertAgent(config);
  await ExpertAgentFactory.startExpertAgent(agent, config.mailConfig);

  console.log(`Expert ${config.expertId} started in message-driven mode`);
  console.log('Waiting for tasks...');

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down...`);
    agent.stopMailDrivenMode();
    console.log('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(console.error);
