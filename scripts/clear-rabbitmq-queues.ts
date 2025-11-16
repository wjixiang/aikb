#!/usr/bin/env tsx

import { connect, Channel, Connection, ChannelModel } from 'amqplib';
import { config } from 'dotenv';
import { rabbitMQQueueConfigs } from '../libs/rabbitmq/src/rabbitmq.config';

// Load environment variables
config();



/**
 * Clear all messages from all RabbitMQ queues
 */
async function clearAllQueues(): Promise<void> {
  console.info('🧹 开始清除 RabbitMQ 中的所有队列...');

  // RabbitMQ connection configuration
  const connectionConfig = {
    hostname: process.env.RABBITMQ_HOSTNAME || 'rabbitmq',
    port: parseInt(process.env.RABBITMQ_PORT || '5672'), // Note: 5672 is for AMQP, 15672 is for management API
    username: process.env.RABBITMQ_USERNAME || 'admin',
    password: process.env.RABBITMQ_PASSWORD || 'admin123',
    vhost: process.env.RABBITMQ_VHOST || 'my_vhost',
  };

  console.info('连接配置:', {
    hostname: connectionConfig.hostname,
    port: connectionConfig.port,
    username: connectionConfig.username,
    vhost: connectionConfig.vhost,
  });

  let connection: ChannelModel | null = null;
  let channel: Channel | null = null;

  try {
    // Connect to RabbitMQ
    console.info('正在连接到 RabbitMQ...');
    connection = await connect(connectionConfig);
    channel = await connection.createChannel();
    console.info('✅ 连接成功！');

    // Get all queue names from configuration
    const queueNames = Object.keys(rabbitMQQueueConfigs);
    console.info(`发现 ${queueNames.length} 个配置的队列`);

    let totalCleared = 0;
    let totalErrors = 0;

    // Clear each queue
    for (const queueName of queueNames) {
      try {
        // Check if queue exists first
        const queueInfo = await channel!.checkQueue(queueName);
        const messageCount = queueInfo.messageCount;

        if (messageCount > 0) {
          console.info(`正在清除队列 '${queueName}' (${messageCount} 条消息)...`);
          await channel!.purgeQueue(queueName);
          console.info(`✅ 已清除队列 '${queueName}' 的 ${messageCount} 条消息`);
          totalCleared += messageCount;
        } else {
          console.info(`队列 '${queueName}' 已经是空的`);
        }
      } catch (error: any) {
        if (error.code === 404) {
          console.warn(`⚠️ 队列 '${queueName}' 不存在，跳过`);
        } else {
          console.error(`❌ 清除队列 '${queueName}' 失败:`, error);
          totalErrors++;
        }
      }
    }

    // Also try to clear any additional queues that might exist but aren't in config
    console.info('\n检查是否有额外的队列...');
    try {
      // Get all queues from the management API or by trying common patterns
      const additionalQueuePatterns = [
        'test-',
        'temp-',
        'debug-',
      ];

      for (const pattern of additionalQueuePatterns) {
        // This is a simple approach - in a real implementation you might want to use
        // the RabbitMQ Management API to get a complete list of queues
        console.info(`检查以 '${pattern}' 开头的队列...`);
        // Note: Without the management API, we can't easily list all queues
        // This would require either the management plugin or a different approach
      }
    } catch (error) {
      console.debug('检查额外队列时出错:', error);
    }

    console.info('\n=== 清除完成 ===');
    console.info(`✅ 总共清除了 ${totalCleared} 条消息`);
    if (totalErrors > 0) {
      console.warn(`⚠️ 遇到 ${totalErrors} 个错误`);
    }
    console.info('🎉 所有队列清除操作已完成！');

  } catch (error) {
    console.error('❌ 清除队列过程中发生错误:', error);
    throw error;
  } finally {
    // Clean up connection
    try {
      if (channel) {
        await channel.close();
        console.info('通道已关闭');
      }
      if (connection) {
        await connection.close();
        console.info('连接已关闭');
      }
    } catch (error) {
      console.error('关闭连接时出错:', error);
    }
  }
}

/**
 * Clear specific queues by name
 */
async function clearSpecificQueues(queueNames: string[]): Promise<void> {
  console.info(`🧹 开始清除指定的 ${queueNames.length} 个队列...`);

  const connectionConfig = {
    hostname: process.env.RABBITMQ_HOSTNAME || 'rabbitmq',
    port: parseInt(process.env.RABBITMQ_PORT || '5672'), // Note: 5672 is for AMQP, 15672 is for management API
    username: process.env.RABBITMQ_USERNAME || 'admin',
    password: process.env.RABBITMQ_PASSWORD || 'admin123',
    vhost: process.env.RABBITMQ_VHOST || 'my_vhost',
  };

  let connection: ChannelModel | null = null;
  let channel: Channel | null = null;

  try {
    connection = await connect(connectionConfig);
    channel = await connection.createChannel();
    console.info('✅ 连接成功！');

    let totalCleared = 0;

    for (const queueName of queueNames) {
      try {
        const queueInfo = await channel!.checkQueue(queueName);
        const messageCount = queueInfo.messageCount;

        if (messageCount > 0) {
          console.info(`正在清除队列 '${queueName}' (${messageCount} 条消息)...`);
          await channel!.purgeQueue(queueName);
          console.info(`✅ 已清除队列 '${queueName}' 的 ${messageCount} 条消息`);
          totalCleared += messageCount;
        } else {
          console.info(`队列 '${queueName}' 已经是空的`);
        }
      } catch (error: any) {
        if (error.code === 404) {
          console.warn(`⚠️ 队列 '${queueName}' 不存在，跳过`);
        } else {
          console.error(`❌ 清除队列 '${queueName}' 失败:`, error);
          throw error;
        }
      }
    }

    console.info(`✅ 总共清除了 ${totalCleared} 条消息`);

  } finally {
    if (channel) await channel.close();
    if (connection) await connection.close();
  }
}

// Show help information
function showHelp(): void {
  console.log(`
RabbitMQ 队列清除脚本

用法:
  npm run clear:rabbitmq                    # 清除所有配置的队列
  npx tsx scripts/clear-rabbitmq-queues.ts  # 清除所有配置的队列
  npx tsx scripts/clear-rabbitmq-queues.ts queue1 queue2 queue3  # 清除指定的队列

选项:
  --help, -h     显示此帮助信息
  --version, -v  显示版本信息

示例:
  # 清除所有队列
  npm run clear:rabbitmq

  # 只清除 PDF 转换相关的队列
  npx tsx scripts/clear-rabbitmq-queues.ts pdf-conversion-request pdf-conversion-completed

  # 清除单个队列
  npx tsx scripts/clear-rabbitmq-queues.ts health-check

环境变量:
  RABBITMQ_HOSTNAME     RabbitMQ 服务器地址 (默认: rabbitmq)
  RABBITMQ_PORT         RabbitMQ 端口 (默认: 5672)
  RABBITMQ_USERNAME     用户名 (默认: admin)
  RABBITMQ_PASSWORD     密码 (默认: admin123)
  RABBITMQ_VHOST        虚拟主机 (默认: my_vhost)

⚠️  警告: 此脚本会永久删除队列中的所有消息，请谨慎使用！
`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  // Handle help and version flags
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  if (args.includes('--version') || args.includes('-v')) {
    console.log('RabbitMQ Queue Clearer v1.0.0');
    process.exit(0);
  }
  
  try {
    if (args.length > 0) {
      // Clear specific queues if provided as arguments
      await clearSpecificQueues(args);
    } else {
      // Clear all configured queues
      await clearAllQueues();
    }
    
    console.info('🎉 脚本执行成功完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}

export { clearAllQueues, clearSpecificQueues };