import * as amqp from 'amqplib';
import { ChannelModel } from 'amqplib';

/**
 * Simple test runner for RabbitMQ connection tests
 * Usage: npx tsx knowledgeBase/lib/rabbitmq/__tests__/run-rabbitmq-connection-test.ts
 */

import { execSync } from 'child_process';

async function main() {
  console.log('🚀 Running RabbitMQ connection tests...\n');

  try {
    // Run the test using pnpm test command
    const channelModel = await amqp.connect({
      hostname: 'rabbitmq',
      port: 5672,
      username: 'admin',
      password: 'admin123',
      vhost: 'my_vhost',
    });
    const chanel = await channelModel.createChannel();
    chanel.assertQueue('hello', {
      durable: false,
    });
    chanel.sendToQueue('hello', Buffer.from('hi!'));

    console.log('\n✅ All RabbitMQ connection tests passed!');
  } catch (error: any) {
    console.error(error);
    console.error('Exit code:', error.status);
    process.exit(error.status || 1);
  }
}

main();
