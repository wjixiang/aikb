#!/usr/bin/env tsx

// 导入polyfills以解决Node.js兼容性问题
import './polyfills';

import { Client } from '@elastic/elasticsearch';
import createLoggerWithPrefix from '../lib/logger';
import readline from 'readline';
import { config } from 'dotenv';
config();

/**
 * 高级测试辅助脚本：清空Elasticsearch数据库中的索引
 *
 * 使用方法:
 * npx tsx knowledgeBase/scripts/clear-elasticsearch-advanced.ts [options]
 *
 * 选项:
 * --all                   清空所有索引
 * --pattern <pattern>     清空匹配模式的索引 (支持通配符)
 * --indices <indices>     清空指定的索引 (逗号分隔)
 * --exclude <indices>     排除指定的索引 (逗号分隔)
 * --dry-run              预览将要删除的索引，不实际删除
 *
 * 环境变量:
 * ELASTICSEARCH_URL - Elasticsearch服务器地址 (默认: http://elasticsearch:9200)
 * ELASTICSEARCH_URL_API_KEY - Elasticsearch API密钥 (可选)
 * SKIP_CONFIRMATION - 跳过确认提示 (设置为'true'时跳过)
 */

const logger = createLoggerWithPrefix('ClearElasticsearchAdvanced');

// 默认需要清空的索引列表
const DEFAULT_INDICES_TO_CLEAR = [
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

// 系统索引，默认情况下不会删除
const SYSTEM_INDICES = [
  '.kibana',
  '.security',
  '.monitoring',
  '.watcher',
  '.ml',
  '.transform',
  '.tasks',
  '.async-search',
  '.data-streams',
  '.geoip_databases',
  '.apm-custom-link',
  '.apm-agent-configuration',
  '.apm-oss-indices',
];

interface ClearOptions {
  all?: boolean;
  pattern?: string;
  indices?: string[];
  exclude?: string[];
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
      case '--all':
        options.all = true;
        break;
      case '--pattern':
        options.pattern = args[++i];
        break;
      case '--indices':
        options.indices = args[++i].split(',').map((s) => s.trim());
        break;
      case '--exclude':
        options.exclude = args[++i].split(',').map((s) => s.trim());
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        console.log(`
用法: npx tsx knowledgeBase/scripts/clear-elasticsearch-advanced.ts [options]

选项:
  --all                   清空所有索引
  --pattern <pattern>     清空匹配模式的索引 (支持通配符)
  --indices <indices>     清空指定的索引 (逗号分隔)
  --exclude <indices>     排除指定的索引 (逗号分隔)
  --dry-run              预览将要删除的索引，不实际删除
  --help, -h             显示帮助信息

示例:
  # 清空默认索引
  npx tsx knowledgeBase/scripts/clear-elasticsearch-advanced.ts

  # 清空所有索引
  npx tsx knowledgeBase/scripts/clear-elasticsearch-advanced.ts --all

  # 清空匹配模式的索引
  npx tsx knowledgeBase/scripts/clear-elasticsearch-advanced.ts --pattern "test_*"

  # 清空指定索引
  npx tsx knowledgeBase/scripts/clear-elasticsearch-advanced.ts --indices "index1,index2"

  # 清空所有索引但排除系统索引
  npx tsx knowledgeBase/scripts/clear-elasticsearch-advanced.ts --all --exclude ".kibana,.security"

  # 预览将要删除的索引
  npx tsx knowledgeBase/scripts/clear-elasticsearch-advanced.ts --dry-run
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

/**
 * 检查索引是否匹配模式
 */
function matchesPattern(indexName: string, pattern: string): boolean {
  // 简单的通配符匹配
  const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${regexPattern}$`).test(indexName);
}

/**
 * 确定要清空的索引列表
 */
function determineIndicesToClear(
  existingIndices: string[],
  options: ClearOptions,
): string[] {
  let indicesToClear: string[] = [];

  if (options.all) {
    // 清空所有索引
    indicesToClear = [...existingIndices];
  } else if (options.pattern) {
    // 清空匹配模式的索引
    indicesToClear = existingIndices.filter((index) =>
      matchesPattern(index, options.pattern!),
    );
  } else if (options.indices && options.indices.length > 0) {
    // 清空指定的索引
    indicesToClear = options.indices.filter((index) =>
      existingIndices.includes(index),
    );
  } else {
    // 使用默认索引列表
    indicesToClear = DEFAULT_INDICES_TO_CLEAR.filter((index) =>
      existingIndices.includes(index),
    );
  }

  // 排除指定的索引
  if (options.exclude && options.exclude.length > 0) {
    indicesToClear = indicesToClear.filter(
      (index) => !options.exclude!.includes(index),
    );
  }

  // 默认排除系统索引
  indicesToClear = indicesToClear.filter(
    (index) => !SYSTEM_INDICES.includes(index),
  );

  return indicesToClear;
}

async function clearElasticsearch(options: ClearOptions): Promise<void> {
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

    // 确定要清空的索引
    const indicesToClear = determineIndicesToClear(existingIndices, options);

    if (indicesToClear.length === 0) {
      logger.info('没有找到需要清空的索引');
      return;
    }

    // 获取索引的文档数量
    const indexInfos: IndexInfo[] = [];
    for (const indexName of indicesToClear) {
      const docCount = await getIndexDocCount(client, indexName);
      indexInfos.push({ name: indexName, docCount });
      logger.info(`发现索引: ${indexName} (包含 ${docCount} 个文档)`);
    }

    // 显示将要清空的索引信息
    logger.warn('以下索引将被清空:');
    for (const index of indexInfos) {
      logger.warn(`  - ${index.name} (${index.docCount} 个文档)`);
    }

    if (options.dryRun) {
      logger.info('预览模式，不实际删除索引');
      return;
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
    for (const index of indexInfos) {
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
  const options = parseArguments();
  clearElasticsearch(options)
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
