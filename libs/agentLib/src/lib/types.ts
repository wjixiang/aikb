// 决策规则接口
interface DecisionRule {
  token: string;
  description: string;
  condition: string;
  priority?: number;
}

// 决策上下文
interface DecisionContext {
  input: string;
  metadata?: Record<string, any>;
  variables?: Record<string, any>;
}

// 决策结果
interface DecisionResult {
  token: string;
  confidence: number;
  reasoning: string;
  source: 'rule' | 'llm' | 'default';
}

// 简化的LLM服务接口
interface LLMService {
  decide(
    input: string,
    options: string[],
  ): Promise<{
    token: string;
    confidence: number;
    reasoning: string;
  }>;
}

// 简化的决策树类
class DecisionTree {
  private rules: DecisionRule[];
  private llmService?: LLMService;
  private defaultToken: string;

  constructor(
    rules: DecisionRule[],
    llmService?: LLMService,
    defaultToken: string = 'default-workflow',
  ) {
    this.rules = rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    this.llmService = llmService;
    this.defaultToken = defaultToken;
  }

  async decide(context: DecisionContext): Promise<DecisionResult> {
    console.log(`🤔 决策树开始分析: "${context.input}"`);

    // 1. 尝试规则匹配
    for (const rule of this.rules) {
      if (this.evaluateCondition(rule.condition, context)) {
        console.log(`✅ 规则匹配成功: ${rule.description} -> ${rule.token}`);
        return {
          token: rule.token,
          confidence: 0.9,
          reasoning: `规则匹配: ${rule.description}`,
          source: 'rule',
        };
      }
    }

    // 2. 如果没有规则匹配，使用LLM决策
    if (this.llmService) {
      console.log(`🤖 规则未匹配，使用LLM决策...`);
      const availableTokens = this.rules.map((r) => r.token);
      const llmDecision = await this.llmService.decide(
        context.input,
        availableTokens,
      );

      console.log(
        `🤖 LLM决策结果: ${llmDecision.token} (置信度: ${llmDecision.confidence})`,
      );
      return {
        token: llmDecision.token,
        confidence: llmDecision.confidence,
        reasoning: llmDecision.reasoning,
        source: 'llm',
      };
    }

    // 3. 默认决策
    console.log(`⚠️ 使用默认决策: ${this.defaultToken}`);
    return {
      token: this.defaultToken,
      confidence: 0.1,
      reasoning: '无匹配规则，使用默认决策',
      source: 'default',
    };
  }

  private evaluateCondition(
    condition: string,
    context: DecisionContext,
  ): boolean {
    try {
      // 简单的条件评估器
      const evaluator = new Function(
        'input',
        'metadata',
        'variables',
        `
        const contains = (str, substr) => str.toLowerCase().includes(substr.toLowerCase());
        const startsWith = (str, prefix) => str.toLowerCase().startsWith(prefix.toLowerCase());
        const endsWith = (str, suffix) => str.toLowerCase().endsWith(suffix.toLowerCase());
        return ${condition};
      `,
      );

      return evaluator(
        context.input,
        context.metadata || {},
        context.variables || {},
      );
    } catch (error) {
      console.warn(`条件评估失败: ${condition}`, error);
      return false;
    }
  }
}

// 简单的LLM服务实现（用于演示）
class SimpleLLMService implements LLMService {
  async decide(
    input: string,
    options: string[],
  ): Promise<{
    token: string;
    confidence: number;
    reasoning: string;
  }> {
    // 模拟LLM决策逻辑
    const lowerInput = input.toLowerCase();

    if (
      lowerInput.includes('查询') ||
      lowerInput.includes('搜索') ||
      lowerInput.includes('找')
    ) {
      return {
        token: 'search-workflow',
        confidence: 0.8,
        reasoning: '用户想要查询或搜索信息',
      };
    }

    if (
      lowerInput.includes('创建') ||
      lowerInput.includes('新建') ||
      lowerInput.includes('添加')
    ) {
      return {
        token: 'create-workflow',
        confidence: 0.8,
        reasoning: '用户想要创建新的内容',
      };
    }

    if (
      lowerInput.includes('更新') ||
      lowerInput.includes('修改') ||
      lowerInput.includes('编辑')
    ) {
      return {
        token: 'update-workflow',
        confidence: 0.8,
        reasoning: '用户想要更新现有内容',
      };
    }

    // 默认返回第一个可用选项
    return {
      token: options[0] || 'default-workflow',
      confidence: 0.5,
      reasoning: '基于关键词分析的默认决策',
    };
  }
}

// 导出接口和类
export type { DecisionRule, DecisionContext, DecisionResult, LLMService };
