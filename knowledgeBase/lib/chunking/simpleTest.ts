import { h1Chunking, paragraphChunking, chunkText } from './chunkingTool';
import { ChunkingStrategyType } from './chunkingStrategy';

// 测试向后兼容性
console.log('=== 测试向后兼容性 ===\n');

// 示例markdown文本
const markdownText = `# 人工智能简介
人工智能（Artificial Intelligence，AI）是计算机科学的一个分支。

# 机器学习基础
机器学习是人工智能的一个子集，它使计算机能够学习和改进。`;

// 示例普通文本
const plainText = `这是第一段。

这是第二段。

这是第三段。`;

console.log('1. 测试h1Chunking函数:');
const h1Chunks = h1Chunking(markdownText);
console.log(`生成了 ${h1Chunks.length} 个H1块`);
h1Chunks.forEach((chunk, index) => {
  console.log(
    `块 ${index + 1}: "${chunk.title}" (${chunk.content.length} 字符)`,
  );
});

console.log('\n2. 测试paragraphChunking函数:');
const paragraphs = paragraphChunking(plainText);
console.log(`生成了 ${paragraphs.length} 个段落`);
paragraphs.forEach((para, index) => {
  console.log(
    `段落 ${index + 1}: "${para.substring(0, 20)}..." (${para.length} 字符)`,
  );
});

console.log('\n3. 测试chunkText函数:');
const h1Results = chunkText(markdownText, ChunkingStrategyType.H1) as any[];
console.log(`H1策略生成了 ${h1Results.length} 个块`);

const paragraphResults = chunkText(plainText, ChunkingStrategyType.PARAGRAPH) as string[];
console.log(`段落策略生成了 ${paragraphResults.length} 个块`);

console.log('\n4. 测试自动策略选择:');
const autoResults = chunkText(markdownText) as any[];
console.log(`自动策略生成了 ${autoResults.length} 个块`);

console.log('\n=== 向后兼容性测试完成 ===');
