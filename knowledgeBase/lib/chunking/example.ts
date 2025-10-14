import { h1Chunking, paragraphChunking, chunkText } from './chunkingTool';
import { ChunkingStrategyType } from './chunkingStrategy';

// 示例markdown文本，所有大纲均为H1
const sampleMarkdown = `# 人工智能简介
人工智能（Artificial Intelligence，AI）是计算机科学的一个分支，致力于创建能够执行通常需要人类智能的任务的系统。

# 机器学习基础
机器学习是人工智能的一个子集，它使计算机能够在没有明确编程的情况下学习和改进。主要类型包括：
- 监督学习
- 无监督学习
- 强化学习

# 深度学习
深度学习是机器学习的一个子集，它使用神经网络来模拟人脑的工作方式。深度学习在图像识别、自然语言处理等领域取得了突破性进展。

# 自然语言处理
自然语言处理（NLP）是人工智能的一个分支，专注于计算机与人类语言之间的交互。NLP的应用包括：
- 机器翻译
- 情感分析
- 文本摘要
- 问答系统

# 计算机视觉
计算机视觉是使计算机能够从数字图像或视频中获取有意义信息的领域。应用包括：
- 图像分类
- 物体检测
- 人脸识别
- 医学图像分析`;

console.log('=== 基于H1大纲的文本切片示例 ===\n');

// 使用h1Chunking函数
const h1Chunks = h1Chunking(sampleMarkdown);
console.log(`找到 ${h1Chunks.length} 个H1大纲:\n`);

h1Chunks.forEach((chunk, index) => {
  console.log(`大纲 ${index + 1}: ${chunk.title}`);
  console.log(`内容长度: ${chunk.content.length} 字符`);
  console.log(`内容预览: ${chunk.content.substring(0, 50)}...\n`);
});

console.log('=== 使用通用chunkText函数 ===\n');

// 使用通用chunkText函数，默认使用h1策略
const defaultChunks = chunkText(sampleMarkdown) as any[];
console.log(`默认策略 (h1) 找到 ${defaultChunks.length} 个块\n`);

// 使用paragraph策略
const paragraphChunks = chunkText(
  sampleMarkdown,
  ChunkingStrategyType.PARAGRAPH,
) as string[];
console.log(`段落策略找到 ${paragraphChunks.length} 个段落:`);
paragraphChunks.forEach((paragraph, index) => {
  console.log(`段落 ${index + 1}: ${paragraph.substring(0, 50)}...`);
});

// 处理没有H1标题的文本
const plainText = `这是一段没有标题的普通文本。
它包含多个段落，但没有使用markdown的H1标题格式。
这种情况下，h1Chunking函数会将整个文本作为一个块返回。`;

console.log('\n=== 处理没有H1标题的文本 ===\n');
const plainTextChunks = h1Chunking(plainText);
console.log(`找到 ${plainTextChunks.length} 个块:`);
console.log(`标题: ${plainTextChunks[0].title}`);
console.log(`内容: ${plainTextChunks[0].content}`);
