#!/usr/bin/env tsx

// 导入polyfills以解决Node.js兼容性问题
import './polyfills';

import { Client } from '@elastic/elasticsearch';
import createLoggerWithPrefix from 'lib/logManagement/logger';
import readline from 'readline';

/**
 * 测试辅助脚本：清空Elasticsearch数据库中的所有索引
 *
 * 使用方法:
 * npx tsx knowledgeBase/scripts/clear-elasticsearch.ts
 *
 * 环境变量:
 * ELASTICSEARCH_URL - Elasticsearch服务器地址 (默认: http://elasticsearch:9200)
 * ELASTICSEARCH_URL_API_KEY - Elasticsearch API密钥 (可选)
 * SKIP_CONFIRMATION - 跳过确认提示 (设置为'true'时跳过)
 */

const logger = createLoggerWithPrefix('ClearElasticsearch');

// 需要清空的索引列表
const INDICES_TO_CLEAR = [
  'entities', // 实体内容存储
  'knowledge_vectors', // 知识向量存储
  'entity_vectors', // 实体向量存储
  'library_metadata', // 文献元数据存储
  'library_collections', // 文献集合存储
  'library_citations', // 文献引用存储
];

// 索引信息接口
interface IndexInfo {
  name: string;
  docCount: number;
}

/**
 * 获取用户确认
 */
async function getConfirmation(message: string): Promise<boolean> {
  if (process.env.SKIP_CONFIRMATION === 'true') {
    logger.info('跳过确认提示 (SKIP_CONFIRMATION=true)');
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * 获取索引的文档数量
 */
async function getIndexDocCount(
  client: Client,
  indexName: string,
): Promise<number> {
  try {
    const response = await client.count({ index: indexName });
    return response.count;
  } catch (error) {
    // 如果索引不存在或其他错误，返回0
    return 0;
  }
}

async function clearElasticsearch(): Promise<void> {
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

    // 检查需要清空的索引
    const indicesToClear: IndexInfo[] = [];
    for (const indexName of INDICES_TO_CLEAR) {
      if (existingIndices.includes(indexName)) {
        const docCount = await getIndexDocCount(client, indexName);
        indicesToClear.push({ name: indexName, docCount });
        logger.info(`发现索引: ${indexName} (包含 ${docCount} 个文档)`);
      } else {
        logger.info(`索引 ${indexName} 不存在，跳过`);
      }
    }

    if (indicesToClear.length === 0) {
      logger.info('没有找到需要清空的索引');
      return;
    }

    // 显示将要清空的索引信息
    logger.warn('以下索引将被清空:');
    for (const index of indicesToClear) {
      logger.warn(`  - ${index.name} (${index.docCount} 个文档)`);
    }

    // 获取用户确认
    const confirmed = await getConfirmation(
      '确定要清空这些索引吗？此操作不可撤销！',
    );
    if (!confirmed) {
      logger.info('操作已取消');
      return;
    }

    // 清空指定的索引
    for (const index of indicesToClear) {
      try {
        logger.info(`正在清空索引: ${index.name}`);

        // 删除索引
        await client.indices.delete({
          index: index.name,
        });

        logger.info(`已删除索引: ${index.name} (${index.docCount} 个文档)`);
      } catch (error) {
        logger.error(`删除索引 ${index.name} 失败:`, error);
      }
    }

    logger.info('Elasticsearch数据库清空完成');
  } catch (error) {
    logger.error('清空Elasticsearch数据库时出错:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  clearElasticsearch()
    .then(() => {
      logger.info('脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('脚本执行失败:', error);
      process.exit(1);
    });
}

export { clearElasticsearch };
