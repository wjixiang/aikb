import {
  ChunkingStrategy,
  ChunkingStrategyCategory,
  ChunkingStrategyType,
  ChunkingStrategyUtils,
  ChunkingStrategyCompatibility,
  chunkTextWithEnum,
  chunkTextEnhanced,
  getAvailableStrategyEnums,
  getStrategiesByCategory,
  autoSelectStrategyEnum,
} from './chunkingTool';

// Sample markdown text for testing
const sampleMarkdown = `# 人工智能简介
人工智能（Artificial Intelligence，AI）是计算机科学的一个分支，致力于创建能够执行通常需要人类智能的任务的系统。

# 机器学习基础
机器学习是人工智能的一个子集，它使计算机能够在没有明确编程的情况下学习和改进。主要类型包括监督学习、无监督学习和强化学习。

# 深度学习
深度学习是机器学习的一个子集，它使用神经网络来模拟人脑的工作方式。深度学习在图像识别、自然语言处理等领域取得了突破性进展。`;

console.log('=== 测试新的枚举系统 ===\n');

// 1. 测试枚举值
console.log('1. 测试枚举值:');
console.log('H1:', ChunkingStrategy.H1);
console.log('PARAGRAPH:', ChunkingStrategy.PARAGRAPH);
console.log('AUTO:', ChunkingStrategy.AUTO);
console.log('');

// 2. 测试策略类别
console.log('2. 测试策略类别:');
console.log('结构化策略:', getStrategiesByCategory(ChunkingStrategyCategory.STRUCTURE_BASED));
console.log('内容化策略:', getStrategiesByCategory(ChunkingStrategyCategory.CONTENT_BASED));
console.log('系统策略:', getStrategiesByCategory(ChunkingStrategyCategory.SYSTEM));
console.log('');

// 3. 测试可用策略
console.log('3. 测试可用策略:');
const availableStrategies = getAvailableStrategyEnums();
console.log('可用策略:', availableStrategies);
console.log('');

// 4. 测试工具函数
console.log('4. 测试工具函数:');
console.log('H1需要标题:', ChunkingStrategyUtils.requiresTitle(ChunkingStrategy.H1));
console.log('PARAGRAPH需要标题:', ChunkingStrategyUtils.requiresTitle(ChunkingStrategy.PARAGRAPH));
console.log('H1的默认配置:', ChunkingStrategyUtils.getDefaultConfig(ChunkingStrategy.H1));
console.log('');

// 5. 测试自动选择
console.log('5. 测试自动选择:');
const autoSelected = autoSelectStrategyEnum(sampleMarkdown);
console.log('自动选择的策略:', autoSelected);
console.log('');

// 6. 测试兼容性转换
console.log('6. 测试兼容性转换:');
const legacyH1 = ChunkingStrategyCompatibility.fromLegacy(ChunkingStrategyType.H1);
const legacyParagraph = ChunkingStrategyCompatibility.fromLegacy(ChunkingStrategyType.PARAGRAPH);
console.log('旧版H1转新版:', legacyH1);
console.log('旧版PARAGRAPH转新版:', legacyParagraph);
console.log('新版H1转旧版:', ChunkingStrategyCompatibility.toLegacy(ChunkingStrategy.H1));
console.log('新版PARAGRAPH转旧版:', ChunkingStrategyCompatibility.toLegacy(ChunkingStrategy.PARAGRAPH));
console.log('');

// 7. 测试切片功能
console.log('7. 测试切片功能:');
console.log('使用H1策略切片:');
const h1Chunks = chunkTextWithEnum(sampleMarkdown, ChunkingStrategy.H1);
console.log(`生成了 ${h1Chunks.length} 个块`);
h1Chunks.forEach((chunk, index) => {
  console.log(`块 ${index + 1}: "${chunk.title}" (${chunk.content.length} 字符)`);
});

console.log('\n使用PARAGRAPH策略切片:');
const paragraphChunks = chunkTextWithEnum(sampleMarkdown, ChunkingStrategy.PARAGRAPH);
console.log(`生成了 ${paragraphChunks.length} 个块`);
paragraphChunks.slice(0, 3).forEach((chunk, index) => {
  console.log(`块 ${index + 1}: ${chunk.content.substring(0, 50)}... (${chunk.content.length} 字符)`);
});

console.log('\n使用增强函数（自动选择）:');
const enhancedChunks = chunkTextEnhanced(sampleMarkdown);
console.log(`生成了 ${enhancedChunks.length} 个块`);
enhancedChunks.slice(0, 2).forEach((chunk, index) => {
  console.log(`块 ${index + 1}: "${chunk.title}" (${chunk.content.length} 字符)`);
});

console.log('\n=== 测试完成 ===');