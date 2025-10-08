#!/usr/bin/env tsx

// 导入polyfills以解决Node.js兼容性问题
import './polyfills';

import { Client } from '@elastic/elasticsearch';
import { connectToDatabase } from '../lib/mongodb';
import createLoggerWithPrefix from '../lib/logger';
import readline from 'readline';
import { config } from 'dotenv';
config();

/**
 * 测试辅助脚本：清空文献存储记录
 *
 * 使用方法:
 * npx tsx knowledgeBase/scripts/clear-library.ts [options]
 *
 * 选项:
 * --elasticsearch-only  仅清空Elasticsearch中的文献数据
 * --mongodb-only        仅清空MongoDB中的文献数据
 * --dry-run            预览将要删除的数据，不实际删除
 *
 * 环境变量:
 * ELASTICSEARCH_URL - Elasticsearch服务器地址 (默认: http://elasticsearch:9200)
 * ELASTICSEARCH_URL_API_KEY - Elasticsearch API密钥 (可选)
 * MONGODB_URI - MongoDB连接URI (可选)
 * SKIP_CONFIRMATION - 跳过确认提示 (设置为'true'时跳过)
 */

const logger = createLoggerWithPrefix('ClearLibrary');

// MongoDB集合名称
const MONGODB_COLLECTIONS = [
  'library_pdfs',
  'library_metadata',
  'library_collections',
  'library_citations',
];

// Elasticsearch索引名称
const ELASTICSEARCH_INDICES = [
  'library_metadata',
  'library_collections',
  'library_citations',
];

interface ClearOptions {
  elasticsearchOnly?: boolean;
  mongodbOnly?: boolean;
  dryRun?: boolean;
}

/**
 * 解析命令行参数
 */
function parseArguments(): ClearOptions {
  const args = process.argv.slice(2);
  const options: ClearOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--elasticsearch-only':
        options.elasticsearchOnly = true;
        break;
      case '--mongodb-only':
        options.mongodbOnly = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        console.log(`
用法: npx tsx knowledgeBase/scripts/clear-library.ts [options]

选项:
  --elasticsearch-only  仅清空Elasticsearch中的文献数据
  --mongodb-only        仅清空MongoDB中的文献数据
  --dry-run            预览将要删除的数据，不实际删除
  --help, -h           显示帮助信息

示例:
  # 清空所有文献数据
  npx tsx knowledgeBase/scripts/clear-library.ts

  # 仅清空Elasticsearch中的文献数据
  npx tsx knowledgeBase/scripts/clear-library.ts --elasticsearch-only

  # 仅清空MongoDB中的文献数据
  npx tsx knowledgeBase/scripts/clear-library.ts --mongodb-only

  # 预览将要删除的数据
  npx tsx knowledgeBase/scripts/clear-library.ts --dry-run
        `);
        process.exit(0);
    }
  }

  return options;
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
 * 获取MongoDB集合的文档数量
 */
async function getMongoCollectionCount(
  collectionName: string,
): Promise<number> {
  try {
    const { db } = await connectToDatabase();
    const count = await db.collection(collectionName).countDocuments();
    return count;
  } catch (error) {
    logger.error(`获取MongoDB集合 ${collectionName} 文档数量失败:`, error);
    return 0;
  }
}

/**
 * 获取Elasticsearch索引的文档数量
 */
async function getElasticsearchIndexCount(
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

/**
 * 清空MongoDB集合
 */
async function clearMongoCollections(
  collections: string[],
  dryRun: boolean = false,
): Promise<void> {
  logger.info('开始清空MongoDB文献数据');
  const { db } = await connectToDatabase();

  for (const collectionName of collections) {
    try {
      const count = await getMongoCollectionCount(collectionName);

      if (count > 0) {
        logger.info(`MongoDB集合 ${collectionName} 包含 ${count} 个文档`);

        if (!dryRun) {
          await db.collection(collectionName).deleteMany({});
          logger.info(`已清空MongoDB集合: ${collectionName}`);
        } else {
          logger.info(
            `[预览] 将清空MongoDB集合: ${collectionName} (${count} 个文档)`,
          );
        }
      } else {
        logger.info(`MongoDB集合 ${collectionName} 为空，跳过`);
      }
    } catch (error) {
      logger.error(`清空MongoDB集合 ${collectionName} 失败:`, error);
    }
  }
}

/**
 * 清空Elasticsearch索引
 */
async function clearElasticsearchIndexes(
  client: Client,
  indexes: string[],
  dryRun: boolean = false,
): Promise<void> {
  logger.info('开始清空Elasticsearch文献数据');

  // 获取所有现有索引
  const indicesResponse = await client.cat.indices({
    format: 'json',
  });

  const existingIndices = indicesResponse.map((index: any) => index.index);
  logger.info(`现有索引: ${existingIndices.join(', ')}`);

  for (const indexName of indexes) {
    if (existingIndices.includes(indexName)) {
      try {
        const count = await getElasticsearchIndexCount(client, indexName);

        if (count > 0) {
          logger.info(`Elasticsearch索引 ${indexName} 包含 ${count} 个文档`);

          if (!dryRun) {
            await client.indices.delete({
              index: indexName,
            });
            logger.info(`已删除Elasticsearch索引: ${indexName}`);
          } else {
            logger.info(
              `[预览] 将删除Elasticsearch索引: ${indexName} (${count} 个文档)`,
            );
          }
        } else {
          logger.info(`Elasticsearch索引 ${indexName} 为空，跳过`);
        }
      } catch (error) {
        logger.error(`清空Elasticsearch索引 ${indexName} 失败:`, error);
      }
    } else {
      logger.info(`Elasticsearch索引 ${indexName} 不存在，跳过`);
    }
  }
}

async function clearLibraryData(options: ClearOptions): Promise<void> {
  const elasticsearchUrl =
    process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200';
  const apiKey = process.env.ELASTICSEARCH_URL_API_KEY || '';

  // 确定要清空的数据源
  const clearElasticsearch = !options.mongodbOnly;
  const clearMongoDB = !options.elasticsearchOnly;

  logger.info(
    `清空选项: Elasticsearch=${clearElasticsearch}, MongoDB=${clearMongoDB}`,
  );

  // 统计将要删除的数据
  let totalMongoDocs = 0;
  let totalElasticDocs = 0;

  // 统计MongoDB数据
  if (clearMongoDB) {
    for (const collectionName of MONGODB_COLLECTIONS) {
      const count = await getMongoCollectionCount(collectionName);
      totalMongoDocs += count;
    }
    logger.info(`MongoDB中总计 ${totalMongoDocs} 个文档待删除`);
  }

  // 统计Elasticsearch数据
  if (clearElasticsearch) {
    const client = new Client({
      node: elasticsearchUrl,
      auth: apiKey ? { apiKey } : undefined,
    });

    try {
      await client.ping();
      logger.info('成功连接到Elasticsearch服务器');

      for (const indexName of ELASTICSEARCH_INDICES) {
        const count = await getElasticsearchIndexCount(client, indexName);
        totalElasticDocs += count;
      }
      logger.info(`Elasticsearch中总计 ${totalElasticDocs} 个文档待删除`);
    } catch (error) {
      logger.error('连接Elasticsearch失败:', error);
      if (options.elasticsearchOnly) {
        throw error;
      }
    } finally {
      await client.close();
    }
  }

  if (totalMongoDocs === 0 && totalElasticDocs === 0) {
    logger.info('没有找到需要清空的数据');
    return;
  }

  // 显示将要清空的数据
  logger.warn('以下数据将被清空:');
  if (clearMongoDB) {
    logger.warn(`  MongoDB: ${totalMongoDocs} 个文档`);
  }
  if (clearElasticsearch) {
    logger.warn(`  Elasticsearch: ${totalElasticDocs} 个文档`);
  }

  if (options.dryRun) {
    logger.info('预览模式，不实际删除数据');
    return;
  }

  // 获取用户确认
  const confirmed = await getConfirmation(
    '确定要清空这些文献数据吗？此操作不可撤销！',
  );
  if (!confirmed) {
    logger.info('操作已取消');
    return;
  }

  // 清空数据
  if (clearMongoDB) {
    await clearMongoCollections(MONGODB_COLLECTIONS, options.dryRun);
  }

  if (clearElasticsearch) {
    const client = new Client({
      node: elasticsearchUrl,
      auth: apiKey ? { apiKey } : undefined,
    });

    try {
      await clearElasticsearchIndexes(
        client,
        ELASTICSEARCH_INDICES,
        options.dryRun,
      );
    } finally {
      await client.close();
    }
  }

  logger.info('文献数据清空完成');
}

// 如果直接运行此脚本
if (require.main === module) {
  const options = parseArguments();
  clearLibraryData(options)
    .then(() => {
      logger.info('脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('脚本执行失败:', error);
      process.exit(1);
    });
}

export { clearLibraryData };
