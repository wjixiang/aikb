import React, { useState } from 'react';
import { MinerUClient, MinerUDefaultConfig } from '@aikb/mineru-client';

/**
 * 示例组件：展示如何在 Next.js 应用中使用 @aikb/mineru-client
 */
export default function MinerUExample() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleProcessDocument = async () => {
    setLoading(true);
    try {
      // 创建 MinerU 客户端实例
      const client = new MinerUClient({
        ...MinerUDefaultConfig,
        token: process.env.NEXT_PUBLIC_MINERU_TOKEN || 'your-token-here',
      });

      // 示例：处理一个文档
      const taskResult = await client.processSingleFile({
        url: 'https://example.com/document.pdf',
        is_ocr: true,
        language: 'ch',
      });

      setResult(`处理成功！任务ID: ${taskResult.result.task_id}`);
    } catch (error) {
      setResult(`处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">MinerU 文档处理示例</h2>
      
      <div className="space-y-4">
        <button
          onClick={handleProcessDocument}
          disabled={loading}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {loading ? '处理中...' : '处理文档'}
        </button>

        {result && (
          <div className="p-4 bg-gray-100 rounded">
            <h3 className="font-semibold mb-2">结果:</h3>
            <p className="text-sm">{result}</p>
          </div>
        )}
      </div>
    </div>
  );
}