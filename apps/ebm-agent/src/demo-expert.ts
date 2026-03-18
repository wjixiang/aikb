import 'reflect-metadata';
import { ExpertExecutor, ExpertRegistry } from 'agent-lib';
import config from '../experts/pubmed-retrieve';
import { config as conf } from 'dotenv';
conf();

async function main() {
  const apiKey = process.env['MINIMAX_API_KEY'];
  const mailboxUrl = process.env['MAILBOX_URL'] || 'http://localhost:3000';

  if (!apiKey) {
    throw new Error('No API key found. Set MINIMAX_API_KEY');
  }

  // 1. Create ExpertExecutor with mail configuration
  const registry = new ExpertRegistry();
  const executor = new ExpertExecutor(registry, undefined);

  config.apiConfiguration = {
    apiProvider: 'minimax',
    apiKey: apiKey,
    apiModelId: 'Minimax-M2.5-highspeed',
  };

  // 2. Register ExpertConfig
  executor.registerExpert(config);

  // 2.5 Enable mail-driven mode for the expert
  config.mailConfig = {
    enabled: true,
    baseUrl: mailboxUrl,
    pollInterval: 10000,
  };

  // 3. Start Expert in message-driven mode
  // Expert will poll its inbox for tasks via email
  await executor.startExpert(config.expertId);

  console.log(`Expert ${config.expertId} started in message-driven mode`);
  console.log('Waiting for tasks...');

  // Handle graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down...`);
    executor
      .stopAll()
      .then(() => {
        console.log('Shutdown complete');
        process.exit(0);
      })
      .catch((err) => {
        console.error('Error during shutdown:', err);
        process.exit(1);
      });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(console.error);
