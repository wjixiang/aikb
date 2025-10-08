#!/usr/bin/env tsx

// 导入polyfills以解决Node.js兼容性问题
import './polyfills';

import { Client } from '@elastic/elasticsearch';
import createLoggerWithPrefix from '../lib/logger';

/**
 * 测试脚本：创建测试索引并验证清空脚本功能
 *
 * 使用方法:
 * npx tsx knowledgeBase/scripts/test-clear-elasticsearch.ts
 */

const logger = createLoggerWithPrefix('TestClearElasticsearch');

// 测试索引列表
const TEST_INDICES = [
  'test_entities',
  'test_knowledge_vectors',
  'test_entity_vectors',
  'test_other_index',
];

async function createTestIndices(): Promise<void> {
  const elasticsearchUrl =
    process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200';
  const apiKey = process.env.ELASTICSEARCH_URL_API_KEY || '';

  logger.info(`连接到Elasticsearch: ${elasticsearchUrl}`);

  const client = new Client({
    node: elasticsearchUrl,
    auth: apiKey ? { apiKey } : undefined,
  });

  try {
    // 检查Elasticsearch连接
    const ping = await client.ping();
    if (!ping) {
      throw new Error('无法连接到Elasticsearch服务器');
    }
    logger.info('成功连接到Elasticsearch服务器');

    // 创建测试索引
    for (const indexName of TEST_INDICES) {
      try {
        // 检查索引是否存在
        const exists = await client.indices.exists({
          index: indexName,
        });

        if (!exists) {
          // 创建索引
          await client.indices.create({
            index: indexName,
            mappings: {
              properties: {
                title: {
                  type: 'text',
                },
                content: {
                  type: 'text',
                },
                timestamp: {
                  type: 'date',
                },
              },
            },
          });

          // 添加一些测试文档
          for (let i = 1; i <= 5; i++) {
            await client.index({
              index: indexName,
              body: {
                title: `测试文档 ${i}`,
                content: `这是索引 ${indexName} 的测试文档 ${i}`,
                timestamp: new Date().toISOString(),
              },
            });
          }

          // 刷新索引以确保文档可见
          await client.indices.refresh({
            index: indexName,
          });

          logger.info(`已创建测试索引: ${indexName} (包含 5 个文档)`);
        } else {
          logger.info(`测试索引 ${indexName} 已存在，跳过创建`);
        }
      } catch (error) {
        logger.error(`创建测试索引 ${indexName} 失败:`, error);
      }
    }

    logger.info('测试索引创建完成');
  } catch (error) {
    logger.error('创建测试索引时出错:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

async function verifyClearedIndices(): Promise<void> {
  const elasticsearchUrl =
    process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200';
  const apiKey = process.env.ELASTICSEARCH_URL_API_KEY || '';

  logger.info(`连接到Elasticsearch: ${elasticsearchUrl}`);

  const client = new Client({
    node: elasticsearchUrl,
    auth: apiKey ? { apiKey } : undefined,
  });

  try {
    // 检查Elasticsearch连接
    const ping = await client.ping();
    if (!ping) {
      throw new Error('无法连接到Elasticsearch服务器');
    }
    logger.info('成功连接到Elasticsearch服务器');

    // 获取所有索引
    const indicesResponse = await client.cat.indices({
      format: 'json',
    });

    const existingIndices = indicesResponse.map((index: any) => index.index);
    logger.info(`现有索引: ${existingIndices.join(', ')}`);

    // 检查测试索引是否还存在
    const remainingTestIndices = TEST_INDICES.filter((indexName) =>
      existingIndices.includes(indexName),
    );

    if (remainingTestIndices.length === 0) {
      logger.info('✅ 所有测试索引已成功清空');
    } else {
      logger.warn(
        `⚠️ 仍有 ${remainingTestIndices.length} 个测试索引未清空: ${remainingTestIndices.join(', ')}`,
      );
    }
  } catch (error) {
    logger.error('验证清空结果时出错:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

async function runTest(): Promise<void> {
  logger.info('开始测试Elasticsearch清空脚本');

  // 步骤1: 创建测试索引
  logger.info('步骤1: 创建测试索引');
  await createTestIndices();

  // 步骤2: 提示用户运行清空脚本
  logger.info('步骤2: 请在另一个终端运行以下命令来清空测试索引:');
  logger.info(
    '  pnpm run clear:elasticsearch:advanced --pattern "test_*" --dry-run',
  );
  logger.info('  # 查看将要删除的索引');
  logger.info('');
  logger.info('  pnpm run clear:elasticsearch:advanced --pattern "test_*"');
  logger.info('  # 实际删除索引');
  logger.info('');
  logger.info('或者运行:');
  logger.info(
    '  pnpm run clear:elasticsearch:advanced --indices "test_entities,test_knowledge_vectors,test_entity_vectors,test_other_index" --dry-run',
  );
  logger.info('  # 查看将要删除的索引');
  logger.info('');
  logger.info(
    '  pnpm run clear:elasticsearch:advanced --indices "test_entities,test_knowledge_vectors,test_entity_vectors,test_other_index"',
  );
  logger.info('  # 实际删除索引');

  // 步骤3: 等待用户确认
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await new Promise<void>((resolve) => {
    rl.question('完成清空操作后，按回车键继续验证...', () => {
      rl.close();
      resolve();
    });
  });

  // 步骤4: 验证清空结果
  logger.info('步骤3: 验证清空结果');
  await verifyClearedIndices();

  logger.info('测试完成');
}

// 如果直接运行此脚本
if (require.main === module) {
  runTest()
    .then(() => {
      logger.info('测试脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('测试脚本执行失败:', error);
      process.exit(1);
    });
}

export { runTest };
