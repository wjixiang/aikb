import * as amqp from 'amqplib';
import { getValidatedRabbitMQConfig } from 'lib/rabbitmq/rabbitmq.config';
import createLoggerWithPrefix from '@aikb/log-management/logger';

const logger = createLoggerWithPrefix('RabbitMQConnectionVerify');

async function verifyConnection(): Promise<boolean> {
  logger.info('🔍 验证 RabbitMQ 连接...');

  const config = getValidatedRabbitMQConfig();
  if (!config) {
    logger.error('❌ 无效的 RabbitMQ 配置');
    return false;
  }

  logger.info('配置信息:', {
    hostname: config.hostname,
    port: config.port,
    username: config.username,
    vhost: config.vhost,
  });

  try {
    logger.info('正在连接到 RabbitMQ...');
    const connection = await amqp.connect(config);
    logger.info('✅ 连接成功！');

    const channel = await connection.createChannel();
    logger.info('✅ 通道创建成功！');

    // 测试基本操作
    await channel.assertQueue('verify-test-queue', { durable: false });
    logger.info('✅ 队列创建成功！');

    // 清理
    await channel.close();
    await connection.close();
    logger.info('✅ 连接关闭成功！');

    return true;
  } catch (error) {
    logger.error('❌ 连接失败:', error);
    return false;
  }
}

// 运行验证
verifyConnection()
  .then((success) => {
    if (success) {
      logger.info('🎉 RabbitMQ 连接验证成功！');
      process.exit(0);
    } else {
      logger.error('❌ RabbitMQ 连接验证失败！');
      process.exit(1);
    }
  })
  .catch((error) => {
    logger.error('验证脚本失败:', error);
    process.exit(1);
  });
