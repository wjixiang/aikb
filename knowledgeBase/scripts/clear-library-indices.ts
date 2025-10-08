#!/usr/bin/env tsx

import { Client } from '@elastic/elasticsearch';

/**
 * 简单脚本：删除所有Library相关的Elasticsearch索引
 *
 * 使用方法:
 * npx tsx knowledgeBase/scripts/clear-library-indices.ts
 */

// Library相关的索引列表
const LIBRARY_INDICES = [
  'library_metadata',
  'library_collections',
  'library_citations',
];

async function clearLibraryIndices(): Promise<void> {
  const elasticsearchUrl =
    process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
  const apiKey = process.env.ELASTICSEARCH_URL_API_KEY || '';

  console.log(`连接到Elasticsearch: ${elasticsearchUrl}`);

  const client = new Client({
    node: elasticsearchUrl,
    auth: apiKey ? { apiKey } : undefined,
  });

  try {
    // 检查Elasticsearch连接
    await client.ping();
    console.log('成功连接到Elasticsearch服务器');

    // 获取所有索引
    const indicesResponse = await client.cat.indices({
      format: 'json',
    });

    const existingIndices = indicesResponse.map((index: any) => index.index);
    console.log(`现有索引: ${existingIndices.join(', ')}`);

    // 找出需要删除的Library索引
    const indicesToDelete = LIBRARY_INDICES.filter((index) =>
      existingIndices.includes(index),
    );

    if (indicesToDelete.length === 0) {
      console.log('没有找到Library相关的索引');
      return;
    }

    console.log(`将删除以下Library索引: ${indicesToDelete.join(', ')}`);

    // 删除索引
    for (const indexName of indicesToDelete) {
      try {
        await client.indices.delete({
          index: indexName,
        });
        console.log(`已删除索引: ${indexName}`);
      } catch (error) {
        console.error(`删除索引 ${indexName} 失败:`, error);
      }
    }

    console.log('Library索引删除完成');
  } catch (error) {
    console.error('删除Library索引时出错:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  clearLibraryIndices()
    .then(() => {
      console.log('脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

export { clearLibraryIndices };
