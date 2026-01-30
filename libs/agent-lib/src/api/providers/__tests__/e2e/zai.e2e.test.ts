import { ProviderSettings } from '@/libs/llm-types/src';
import { ZAiHandler } from '../../zai';
import type {
  ApiStream,
  ApiStreamChunk,
  ApiStreamTextChunk,
  ApiStreamUsageChunk,
  ApiStreamReasoningChunk,
  ApiStreamToolCallChunk,
  ApiStreamError,
} from '../../../transform/stream';
// import { config } from 'dotenv'
// config()

describe.skip(ZAiHandler, () => {
  const testApiConfig: ProviderSettings = {
    apiProvider: 'zai',
    apiKey: process.env['GLM_API_KEY'],
    apiModelId: 'glm-4.6',
    zaiApiLine: 'china_coding',
  };
  console.log(testApiConfig);

  let handler = new ZAiHandler(testApiConfig);

  it('get response from provider', async () => {
    console.log(handler.getModel());
    const stream = handler.createMessage('', [
      {
        content: 'hello!',
        role: 'user',
      },
    ]);

    // 方法1: 使用 for await...of 循环解析 stream
    console.log('=== 方法1: 使用 for await...of 循环 ===');
    let fullResponse = '';

    for await (const chunk of stream) {
      switch (chunk.type) {
        case 'text':
          console.log('文本块:', (chunk as ApiStreamTextChunk).text);
          fullResponse += (chunk as ApiStreamTextChunk).text;
          break;
        case 'reasoning':
          console.log('推理块:', (chunk as ApiStreamReasoningChunk).text);
          break;
        case 'usage':
          const usage = chunk as ApiStreamUsageChunk;
          console.log('使用统计:', {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalCost: usage.totalCost,
          });
          break;
        case 'tool_call':
          const toolCall = chunk as ApiStreamToolCallChunk;
          console.log('工具调用:', {
            id: toolCall.id,
            name: toolCall.name,
            arguments: toolCall.arguments,
          });
          break;
        case 'error':
          console.error('错误:', (chunk as ApiStreamError).error);
          break;
        default:
          console.log('其他类型块:', chunk);
      }
    }

    console.log('完整响应:', fullResponse);
  }, 30000);

  // it('方法2: 使用数组收集所有 chunks', async () => {
  //     const stream = handler.createMessage('', [{
  //         content: "请用中文回答：什么是人工智能？",
  //         role: "user"
  //     }]);

  //     console.log("=== 方法2: 收集所有 chunks 后处理 ===");
  //     const chunks: ApiStreamChunk[] = [];

  //     // 收集所有 chunks
  //     for await (const chunk of stream) {
  //         chunks.push(chunk);
  //     }

  //     // 分类处理不同类型的 chunks
  //     const textChunks = chunks.filter(chunk => chunk.type === 'text') as ApiStreamTextChunk[];
  //     const reasoningChunks = chunks.filter(chunk => chunk.type === 'reasoning') as ApiStreamReasoningChunk[];
  //     const usageChunks = chunks.filter(chunk => chunk.type === 'usage') as ApiStreamUsageChunk[];
  //     const toolCallChunks = chunks.filter(chunk => chunk.type === 'tool_call') as ApiStreamToolCallChunk[];

  //     // 组合文本响应
  //     const fullText = textChunks.map(chunk => chunk.text).join('');
  //     console.log("组合的文本响应:", fullText);

  //     // 输出推理内容（如果有）
  //     if (reasoningChunks.length > 0) {
  //         const fullReasoning = reasoningChunks.map(chunk => chunk.text).join('');
  //         console.log("推理内容:", fullReasoning);
  //     }

  //     // 输出使用统计
  //     if (usageChunks.length > 0) {
  //         console.log("API 使用统计:", usageChunks[usageChunks.length - 1]);
  //     }

  //     // 输出工具调用（如果有）
  //     if (toolCallChunks.length > 0) {
  //         console.log("工具调用:", toolCallChunks);
  //     }
  // }, 30000);

  // it('方法3: 实时处理 stream 并输出到控制台', async () => {
  //     const stream = handler.createMessage('', [{
  //         content: "写一个简短的故事，包含开头、发展和结尾",
  //         role: "user"
  //     }]);

  //     console.log("=== 方法3: 实时处理 stream ===");
  //     console.log("AI 响应:");

  //     let currentText = "";
  //     let reasoningText = "";

  //     for await (const chunk of stream) {
  //         switch (chunk.type) {
  //             case 'text':
  //                 const textChunk = chunk as ApiStreamTextChunk;
  //                 currentText += textChunk.text;
  //                 // 实时输出文本（模拟打字机效果）
  //                 process.stdout.write(textChunk.text);
  //                 break;
  //             case 'reasoning':
  //                 const reasoningChunk = chunk as ApiStreamReasoningChunk;
  //                 reasoningText += reasoningChunk.text;
  //                 console.log("\n[推理]:", reasoningChunk.text);
  //                 break;
  //             case 'usage':
  //                 console.log("\n[使用统计]:", chunk);
  //                 break;
  //             case 'tool_call':
  //                 console.log("\n[工具调用]:", chunk);
  //                 break;
  //             case 'error':
  //                 console.error("\n[错误]:", chunk);
  //                 break;
  //         }
  //     }

  //     console.log("\n\n最终完整响应:");
  //     console.log(currentText);

  //     if (reasoningText) {
  //         console.log("\n完整推理内容:");
  //         console.log(reasoningText);
  //     }
  // }, 30000);
});
