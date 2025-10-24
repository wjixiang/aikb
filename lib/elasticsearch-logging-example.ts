import createLoggerWithPrefix from 'lib/logManagement/logger';

/**
 * 示例脚本：演示 Elasticsearch 日志功能
 *
 * 使用方法：
 * 1. 设置环境变量 ELASTICSEARCH_LOGGING_ENABLED=true
 * 2. 运行此脚本：npx tsx knowledgeBase/lib/elasticsearch-logging-example.ts
 */

async function demonstrateElasticsearchLogging() {
  console.log('=== Elasticsearch 日志功能演示 ===\n');

  // 创建不同服务的日志记录器
  const userServiceLogger = createLoggerWithPrefix('UserService');
  const paymentServiceLogger = createLoggerWithPrefix('PaymentService');
  const apiGatewayLogger = createLoggerWithPrefix('APIGateway');

  // 模拟不同级别的日志
  console.log('1. 记录信息级别日志...');
  userServiceLogger.info('用户登录成功', {
    userId: '12345',
    ip: '192.168.1.100',
  });

  console.log('2. 记录警告级别日志...');
  paymentServiceLogger.warn('支付处理延迟', {
    paymentId: 'pay_67890',
    delay: 1500,
    currency: 'USD',
  });

  console.log('3. 记录错误级别日志...');
  apiGatewayLogger.error('API 请求失败', {
    endpoint: '/api/v1/users',
    method: 'POST',
    statusCode: 500,
    error: 'Database connection timeout',
  });

  console.log('4. 记录调试级别日志...');
  userServiceLogger.debug('查询用户详细信息', {
    userId: '12345',
    fields: ['profile', 'preferences', 'history'],
  });

  // 演示复杂对象支持
  console.log('\n5. 记录复杂嵌套对象...');
  userServiceLogger.info('用户操作完成', {
    user: {
      id: '12345',
      profile: {
        name: '张三',
        email: 'zhangsan@example.com',
        preferences: {
          language: 'zh-CN',
          timezone: 'Asia/Shanghai',
        },
      },
    },
    operation: {
      type: 'profile_update',
      duration: 1250,
      success: true,
    },
    request: {
      id: 'req_abc123',
      method: 'PUT',
      endpoint: '/api/v1/users/12345/profile',
      headers: {
        'user-agent': 'Mozilla/5.0',
        'content-type': 'application/json',
      },
    },
    tags: ['user', 'profile', 'update', 'success'],
  });

  // 演示数组处理
  console.log('\n6. 记录包含数组的对象...');
  apiGatewayLogger.info('批量处理完成', {
    batchId: 'batch_789',
    processedItems: [101, 102, 103, 104, 105],
    errors: ['Item 106 validation failed', 'Item 107 permission denied'],
    statistics: {
      total: 7,
      successful: 5,
      failed: 2,
      processingTime: 3500,
    },
  });

  // 模拟批量日志记录
  console.log('\n7. 批量记录日志...');
  for (let i = 0; i < 5; i++) {
    userServiceLogger.info(`处理用户请求 ${i + 1}`, {
      requestId: `req_${Date.now()}_${i}`,
      processingTime: Math.random() * 1000,
    });
  }

  // 等待一段时间以确保日志被发送到 Elasticsearch
  console.log('\n等待日志发送到 Elasticsearch...');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log('\n=== 演示完成 ===');
  console.log(
    '如果启用了 Elasticsearch 日志记录，您现在可以在 Kibana 中查看这些日志。',
  );
  console.log('检查以下索引：logs 或 logs-YYYY.MM.DD');
  console.log('\n新功能特性：');
  console.log('- 支持任意复杂的嵌套对象作为第二个参数');
  console.log('- 自动扁平化对象结构以便在 Elasticsearch 中搜索');
  console.log('- 数组会自动转换为逗号分隔的字符串');
  console.log('- 控制台输出会显示完整的 JSON 格式的元数据');
}

// 检查环境配置
function checkEnvironment() {
  const isEnabled = process.env.ELASTICSEARCH_LOGGING_ENABLED === 'true';
  const elasticsearchUrl =
    process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

  console.log('环境配置：');
  console.log(`- Elasticsearch 日志记录: ${isEnabled ? '启用' : '禁用'}`);
  console.log(`- Elasticsearch URL: ${elasticsearchUrl}`);
  console.log(`- 日志级别: ${process.env.ELASTICSEARCH_LOG_LEVEL || 'info'}`);
  console.log(`- 日志索引: ${process.env.ELASTICSEARCH_LOG_INDEX || 'logs'}`);
  console.log(
    `- 索引模式: ${process.env.ELASTICSEARCH_LOG_INDEX_PATTERN || 'logs-YYYY.MM.DD'}`,
  );

  if (!isEnabled) {
    console.log('\n注意：Elasticsearch 日志记录当前已禁用。');
    console.log('要启用，请设置环境变量：ELASTICSEARCH_LOGGING_ENABLED=true');
  }

  return isEnabled;
}

// 主函数
async function main() {
  try {
    checkEnvironment();
    console.log();
    await demonstrateElasticsearchLogging();
  } catch (error) {
    console.error('演示过程中发生错误:', error);
    process.exit(1);
  }
}

// 运行演示
if (require.main === module) {
  main();
}

export { demonstrateElasticsearchLogging, checkEnvironment };
