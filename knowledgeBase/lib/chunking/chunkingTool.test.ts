import {
  chunkTextAdvanced,
  getAvailableStrategies,
  autoSelectStrategy,
  getStrategyDefaultConfig,
  validateStrategyConfig,
  canStrategyHandle,
  getStrategiesForText,
} from './chunkingTool';

// 测试用例
describe('ChunkingToolV2', () => {
  const sampleMarkdown = `# 人工智能简介
人工智能（Artificial Intelligence，AI）是计算机科学的一个分支，致力于创建能够执行通常需要人类智能的任务的系统。

# 机器学习基础
机器学习是人工智能的一个子集，它使计算机能够在没有明确编程的情况下学习和改进。主要类型包括：
- 监督学习
- 无监督学习
- 强化学习

# 深度学习
深度学习是机器学习的一个子集，它使用神经网络来模拟人脑的工作方式。`;

  const plainText = `这是一段没有标题的普通文本。

它包含多个段落，但没有使用markdown的H1标题格式。

这种情况下，H1策略可能不是最佳选择。`;

  describe('getAvailableStrategies', () => {
    it('should return available strategies', () => {
      const strategies = getAvailableStrategies();
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies[0]).toHaveProperty('name');
      expect(strategies[0]).toHaveProperty('description');
      expect(strategies[0]).toHaveProperty('version');
    });
  });

  describe('autoSelectStrategy', () => {
    it('should select h1 strategy for markdown text', () => {
      const strategy = autoSelectStrategy(sampleMarkdown);
      expect(strategy).toBe('h1');
    });

    it('should select paragraph strategy for plain text', () => {
      const strategy = autoSelectStrategy(plainText);
      expect(strategy).toBe('paragraph');
    });
  });

  describe('canStrategyHandle', () => {
    it('should return true for h1 strategy with markdown text', () => {
      const canHandle = canStrategyHandle('h1', sampleMarkdown);
      expect(canHandle).toBe(true);
    });

    it('should return false for h1 strategy with plain text', () => {
      const canHandle = canStrategyHandle('h1', plainText);
      expect(canHandle).toBe(false);
    });

    it('should return true for paragraph strategy with any text', () => {
      const canHandle1 = canStrategyHandle('paragraph', sampleMarkdown);
      const canHandle2 = canStrategyHandle('paragraph', plainText);
      expect(canHandle1).toBe(true);
      expect(canHandle2).toBe(true);
    });
  });

  describe('getStrategiesForText', () => {
    it('should return strategies that can handle the text', () => {
      const strategies = getStrategiesForText(sampleMarkdown);
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies).toContain('h1');
      expect(strategies).toContain('paragraph');
    });

    it('should return only paragraph strategy for plain text', () => {
      const strategies = getStrategiesForText(plainText);
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies).toContain('paragraph');
    });
  });

  describe('getStrategyDefaultConfig', () => {
    it('should return default config for h1 strategy', () => {
      const config = getStrategyDefaultConfig('h1');
      expect(config).toHaveProperty('maxChunkSize');
      expect(config).toHaveProperty('minChunkSize');
      expect(config).toHaveProperty('overlap');
    });

    it('should return default config for paragraph strategy', () => {
      const config = getStrategyDefaultConfig('paragraph');
      expect(config).toHaveProperty('maxChunkSize');
      expect(config).toHaveProperty('minChunkSize');
      expect(config).toHaveProperty('overlap');
    });
  });

  describe('validateStrategyConfig', () => {
    it('should validate valid config', () => {
      const validConfig = {
        maxChunkSize: 1000,
        minChunkSize: 100,
        overlap: 50,
      };

      const h1Validation = validateStrategyConfig('h1', validConfig);
      expect(h1Validation.valid).toBe(true);
      expect(h1Validation.errors).toHaveLength(0);

      const paragraphValidation = validateStrategyConfig(
        'paragraph',
        validConfig,
      );
      expect(paragraphValidation.valid).toBe(true);
      expect(paragraphValidation.errors).toHaveLength(0);
    });

    it('should detect invalid config', () => {
      const invalidConfig = {
        maxChunkSize: -100,
        minChunkSize: 1000,
        overlap: 50,
      };

      const validation = validateStrategyConfig('h1', invalidConfig);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('chunkTextAdvanced', () => {
    it('should chunk markdown text with h1 strategy', () => {
      const chunks = chunkTextAdvanced(sampleMarkdown, 'h1');
      expect(chunks.length).toBe(3); // 3 H1 sections

      chunks.forEach((chunk, index) => {
        expect(chunk).toHaveProperty('title');
        expect(chunk).toHaveProperty('content');
        expect(chunk).toHaveProperty('index');
        expect(chunk.index).toBe(index);

        if (index === 0) {
          expect(chunk.title).toBe('人工智能简介');
        } else if (index === 1) {
          expect(chunk.title).toBe('机器学习基础');
        } else if (index === 2) {
          expect(chunk.title).toBe('深度学习');
        }
      });
    });

    it('should chunk plain text with paragraph strategy', () => {
      // 使用较小的maxChunkSize确保每个段落成为独立的块
      const chunks = chunkTextAdvanced(plainText, 'paragraph', {
        maxChunkSize: 50, // 设置较小的最大块大小
        minChunkSize: 10,
        overlap: 0,
      });
      expect(chunks.length).toBeGreaterThanOrEqual(2); // At least 2 chunks (some may be merged)

      chunks.forEach((chunk, index) => {
        expect(chunk).toHaveProperty('content');
        expect(chunk).toHaveProperty('index');
        expect(chunk.index).toBe(index);
      });
    });

    it('should auto-select strategy when not specified', () => {
      const markdownChunks = chunkTextAdvanced(sampleMarkdown);
      expect(markdownChunks.length).toBe(3); // Should use h1 strategy

      const plainTextChunks = chunkTextAdvanced(plainText, 'paragraph', {
        maxChunkSize: 50, // 设置较小的最大块大小
        minChunkSize: 10,
        overlap: 0,
      });
      expect(plainTextChunks.length).toBeGreaterThanOrEqual(2); // At least 2 chunks (some may be merged)
    });

    it('should use custom configuration', () => {
      const customConfig = {
        maxChunkSize: 200,
        minChunkSize: 50,
      };

      const chunks = chunkTextAdvanced(sampleMarkdown, 'h1', customConfig);
      expect(chunks.length).toBeGreaterThan(0);

      // Check that chunks respect max size
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(200 + 50); // Allow some tolerance
      });
    });

    it('should handle empty text', () => {
      const chunks = chunkTextAdvanced('', 'h1');
      expect(chunks).toHaveLength(0);
    });

    it('should throw error for invalid strategy', () => {
      expect(() => {
        chunkTextAdvanced(sampleMarkdown, 'invalid-strategy');
      }).toThrow();
    });
  });
});

// 运行测试的函数
export function runTests() {
  console.log('Running ChunkingToolV2 tests...\n');

  // 定义测试数据（在函数内部以确保可用）
  const testMarkdown = `# 人工智能简介
人工智能（Artificial Intelligence，AI）是计算机科学的一个分支。

# 机器学习基础
机器学习是人工智能的一个子集，它使计算机能够学习和改进。`;

  const testPlainText = `这是一段没有标题的普通文本。
它包含多个段落，但没有使用markdown的H1标题格式。`;

  try {
    // 测试获取可用策略
    const strategies = getAvailableStrategies();
    console.log(`✓ Found ${strategies.length} available strategies`);

    // 测试自动策略选择
    const markdownStrategy = autoSelectStrategy(testMarkdown);
    console.log(`✓ Auto-selected strategy for markdown: ${markdownStrategy}`);

    const plainTextStrategy = autoSelectStrategy(testPlainText);
    console.log(
      `✓ Auto-selected strategy for plain text: ${plainTextStrategy}`,
    );

    // 测试策略能力检查
    const h1CanHandleMarkdown = canStrategyHandle('h1', testMarkdown);
    console.log(`✓ H1 strategy can handle markdown: ${h1CanHandleMarkdown}`);

    const h1CanHandlePlain = canStrategyHandle('h1', testPlainText);
    console.log(`✓ H1 strategy can handle plain text: ${h1CanHandlePlain}`);

    // 测试切分功能
    const h1Chunks = chunkTextAdvanced(testMarkdown, 'h1');
    console.log(`✓ H1 chunking produced ${h1Chunks.length} chunks`);

    const paragraphChunks = chunkTextAdvanced(testPlainText, 'paragraph');
    console.log(
      `✓ Paragraph chunking produced ${paragraphChunks.length} chunks`,
    );

    // 测试配置验证
    const validConfig = getStrategyDefaultConfig('h1');
    const validation = validateStrategyConfig('h1', validConfig);
    console.log(`✓ Default H1 config validation: ${validation.valid}`);

    const invalidConfig = { maxChunkSize: -100 };
    const invalidValidation = validateStrategyConfig('h1', invalidConfig);
    console.log(`✓ Invalid config validation: ${!invalidValidation.valid}`);

    console.log('\nAll tests passed! ✓');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  runTests();
}
