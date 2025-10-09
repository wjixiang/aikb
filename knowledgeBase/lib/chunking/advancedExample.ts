import { 
  chunkTextAdvanced, 
  getAvailableStrategies, 
  autoSelectStrategy,
  getStrategyDefaultConfig,
  validateStrategyConfig,
  chunkingManager 
} from './chunkingToolV2';

// 示例markdown文本，所有大纲均为H1
const sampleMarkdown = `# 人工智能简介
人工智能（Artificial Intelligence，AI）是计算机科学的一个分支，致力于创建能够执行通常需要人类智能的任务的系统。人工智能的研究包括机器学习、计算机视觉、自然语言处理等多个领域。

# 机器学习基础
机器学习是人工智能的一个子集，它使计算机能够在没有明确编程的情况下学习和改进。主要类型包括：
- 监督学习：使用标记的训练数据来学习模式
- 无监督学习：从未标记的数据中发现隐藏的模式
- 强化学习：通过与环境交互来学习最优行为

机器学习算法可以分为分类算法、回归算法、聚类算法等。每种算法都有其适用的场景和局限性。

# 深度学习
深度学习是机器学习的一个子集，它使用神经网络来模拟人脑的工作方式。深度学习在图像识别、自然语言处理等领域取得了突破性进展。

深度神经网络通常包含多个隐藏层，每一层都会对输入数据进行变换，从而提取更高层次的特征。这种层次化的特征表示使得深度学习能够处理非常复杂的模式识别任务。

卷积神经网络（CNN）特别适用于图像处理任务，而循环神经网络（RNN）和Transformer则更适合处理序列数据，如文本和时间序列。

# 自然语言处理
自然语言处理（NLP）是人工智能的一个分支，专注于计算机与人类语言之间的交互。NLP的应用包括：
- 机器翻译：将一种语言自动翻译成另一种语言
- 情感分析：判断文本中表达的情感倾向
- 文本摘要：自动生成长文本的简短摘要
- 问答系统：根据问题自动生成答案

现代NLP系统大多基于Transformer架构，其中BERT、GPT等模型在各种NLP任务中都取得了最好的性能。`;

console.log('=== 高级文本切片示例 ===\n');

// 1. 获取所有可用的切片策略
console.log('1. 可用的切片策略:');
const strategies = getAvailableStrategies();
strategies.forEach((strategy, index) => {
  console.log(`${index + 1}. ${strategy.name} (v${strategy.version}): ${strategy.description}`);
});

// 2. 自动选择最适合的策略
console.log('\n2. 自动选择策略:');
const selectedStrategy = autoSelectStrategy(sampleMarkdown);
console.log(`自动选择的策略: ${selectedStrategy}`);

// 3. 使用不同策略进行切片
console.log('\n3. 使用H1策略切片:');
const h1Chunks = chunkTextAdvanced(sampleMarkdown, 'h1');
console.log(`H1策略产生了 ${h1Chunks.length} 个块`);
h1Chunks.forEach((chunk, index) => {
  console.log(`块 ${index + 1}: "${chunk.title}" (${chunk.content.length} 字符)`);
});

console.log('\n4. 使用段落策略切片:');
const paragraphChunks = chunkTextAdvanced(sampleMarkdown, 'paragraph');
console.log(`段落策略产生了 ${paragraphChunks.length} 个块`);
paragraphChunks.forEach((chunk, index) => {
  console.log(`块 ${index + 1}: ${chunk.content.substring(0, 50)}... (${chunk.content.length} 字符)`);
});

// 5. 使用自定义配置
console.log('\n5. 使用自定义配置:');
const customConfig = getStrategyDefaultConfig('paragraph');
customConfig.maxChunkSize = 200; // 限制最大块大小
customConfig.minChunkSize = 50;  // 限制最小块大小

const customChunks = chunkTextAdvanced(sampleMarkdown, 'paragraph', customConfig);
console.log(`自定义配置的段落策略产生了 ${customChunks.length} 个块`);
customChunks.forEach((chunk, index) => {
  console.log(`块 ${index + 1}: ${chunk.content.substring(0, 50)}... (${chunk.content.length} 字符)`);
});

// 6. 验证配置
console.log('\n6. 配置验证:');
const invalidConfig = {
  maxChunkSize: -100, // 无效值
  minChunkSize: 1000, // 大于maxChunkSize
  overlap: 50
};

const validation = validateStrategyConfig('paragraph', invalidConfig);
console.log(`配置验证结果: ${validation.valid ? '有效' : '无效'}`);
if (!validation.valid) {
  console.log('错误信息:');
  validation.errors.forEach(error => console.log(`- ${error}`));
}

// 7. 直接使用chunkingManager进行高级操作
console.log('\n7. 直接使用chunkingManager:');
const manager = chunkingManager;

// 注册自定义策略（示例）
manager.registerStrategy({
  name: 'sentence',
  description: '基于句子的切片策略',
  version: '1.0.0',
  canHandle: (text: string) => typeof text === 'string' && text.length > 0,
  getDefaultConfig: () => ({
    maxChunkSize: 300,
    minChunkSize: 50,
    overlap: 20
  }),
  validateConfig: (config) => {
    const errors: string[] = [];
    if (config.maxChunkSize && config.maxChunkSize <= 0) {
      errors.push('maxChunkSize must be positive');
    }
    return { valid: errors.length === 0, errors };
  },
  chunk: (text: string, config) => {
    const maxChunkSize = config?.maxChunkSize || 300;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks: Array<{ content: string; index: number }> = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.trim() + '.',
          index: chunks.length
        });
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim() + '.',
        index: chunks.length
      });
    }
    
    return chunks;
  }
});

console.log('注册了新的句子策略');

// 使用自定义策略
const sentenceChunks = chunkTextAdvanced(sampleMarkdown, 'sentence');
console.log(`句子策略产生了 ${sentenceChunks.length} 个块`);
sentenceChunks.slice(0, 3).forEach((chunk, index) => {
  console.log(`块 ${index + 1}: ${chunk.content.substring(0, 50)}... (${chunk.content.length} 字符)`);
});

// 8. 检查哪些策略可以处理特定文本
console.log('\n8. 策略兼容性检查:');
const strategiesForText = manager.getStrategiesForText(sampleMarkdown);
console.log(`可以处理示例文本的策略: ${strategiesForText.map(s => s.name).join(', ')}`);

// 测试没有H1标题的文本
const plainText = `这是一段没有标题的普通文本。
它包含多个段落，但没有使用markdown的H1标题格式。
这种情况下，H1策略可能不是最佳选择。
我们可以使用段落策略或句子策略来处理这种文本。`;

console.log(`可以处理普通文本的策略: ${manager.getStrategiesForText(plainText).map(s => s.name).join(', ')}`);

console.log('\n=== 示例完成 ===');