import { MongoDBMarkdownPartCache } from './markdown-part-cache-mongodb';

/**
 * 使用示例：MongoDBMarkdownPartCache
 */
async function example() {
  // 创建缓存实例
  const cache = new MongoDBMarkdownPartCache();
  
  try {
    // 初始化缓存
    await cache.initialize();
    console.log('MongoDB Markdown Part Cache 初始化完成');
    
    // 测试数据
    const itemId = 'example-pdf-123';
    
    // 存储多个markdown部分
    await cache.storePartMarkdown(itemId, 0, '# 第一章\n\n这是第一章的内容。');
    console.log('存储第0部分完成');
    
    await cache.storePartMarkdown(itemId, 1, '# 第二章\n\n这是第二章的内容。');
    console.log('存储第1部分完成');
    
    await cache.storePartMarkdown(itemId, 2, '# 第三章\n\n这是第三章的内容。');
    console.log('存储第2部分完成');
    
    // 获取特定部分
    const part1 = await cache.getPartMarkdown(itemId, 1);
    console.log('第1部分内容:', part1);
    
    // 获取所有部分
    const allParts = await cache.getAllParts(itemId);
    console.log(`获取到 ${allParts.length} 个部分`);
    
    // 合并所有部分
    const mergedContent = await cache.mergeAllParts(itemId);
    console.log('合并后的内容:');
    console.log('---');
    console.log(mergedContent);
    console.log('---');
    
    // 更新部分状态
    await cache.updatePartStatus(itemId, 0, 'processing');
    console.log('更新第0部分状态为 processing');
    
    // 获取部分状态
    const status = await cache.getPartStatus(itemId, 0);
    console.log('第0部分状态:', status);
    
    // 获取元数据
    const metadata = await cache.getMetadata(itemId);
    console.log('项目元数据:', {
      itemId: metadata.itemId,
      totalParts: metadata.totalParts,
      completedParts: metadata.completedParts,
      status: metadata.status
    });
    
    // 清理测试数据
    await cache.cleanup(itemId);
    console.log('清理完成');
    
    // 关闭连接
    await cache.close();
    console.log('连接已关闭');
    
  } catch (error) {
    console.error('示例执行失败:', error);
    await cache.close();
  }
}

// 如果直接运行此文件，则执行示例
if (require.main === module) {
  example();
}

export { example };