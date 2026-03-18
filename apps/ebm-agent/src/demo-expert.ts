import 'reflect-metadata';
import { ExpertExecutor, ExpertRegistry } from 'agent-lib';
import type { ExpertTask } from 'agent-lib';
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
  const executor = new ExpertExecutor(registry, undefined, {
    mailConfig: {
      baseUrl: mailboxUrl,
    },
  });

  config.apiConfiguration = {
    apiProvider: 'minimax',
    apiKey: apiKey,
    apiModelId: 'Minimax-M2.5-highspeed',
  };

  // 2. Register ExpertConfig
  executor.registerExpert(config);

  // 3. Create Expert instance
  const expert = await executor.createExpert(config.expertId);

  // 4. Activate the expert
  await expert.activate();

  // 5. Define task
  const task: ExpertTask = {
    taskId: `task-${Date.now()}`,
    description: '搜索血管外科近几年的研究热点',
    input: {},
  };

  // 6. Execute task
  const result = await expert.execute(task);

  // 7. Check result
  console.log('Expert status:', expert.status);
  console.log('Task ID:', task.taskId);
  console.log('Result:', result);
}

main().catch(console.error);
