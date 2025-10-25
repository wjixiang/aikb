/**
 * 示例：在 Next.js 应用中使用 @aikb/mineru-client
 * 这个文件展示了如何在 monorepo 中的另一个子项目里使用 mineru-client 包
 */

import { MinerUClient, MinerUDefaultConfig } from '@aikb/mineru-client';

// 创建客户端实例
export const createMinerUClient = () => {
  return new MinerUClient({
    ...MinerUDefaultConfig,
    token: process.env.NEXT_PUBLIC_MINERU_TOKEN || 'your-token-here',
  });
};

// 示例函数：处理单个文件
export const processDocument = async (fileUrl: string) => {
  const client = createMinerUClient();
  
  try {
    const result = await client.processSingleFile({
      url: fileUrl,
      is_ocr: true,
      language: 'ch',
    });
    
    return {
      success: true,
      taskId: result.result.task_id,
      message: '文档处理成功',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      message: '文档处理失败',
    };
  }
};

// 示例函数：验证令牌
export const validateToken = async () => {
  const client = createMinerUClient();
  
  try {
    const isValid = await client.validateToken();
    return {
      valid: isValid,
      message: isValid ? '令牌有效' : '令牌无效',
    };
  } catch (error) {
    return {
      valid: false,
      message: `令牌验证失败: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
};