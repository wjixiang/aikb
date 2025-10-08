import { runEntityKnowledgeRelationshipValidation } from './entity-knowledge-relationship-validation';
import { runComplexScenarioTests } from './complex-scenario-test';
import { RelationshipVisualizer } from './relationship-visualizer';
import { MongodbKnowledgeContentStorage } from '../storage/mongodb-knowledge-content-storage';
import { MongodbKnowledgeVectorStorage } from '../storage/mongodb-knowledge-vector-storage';
import { MongoKnowledgeGraphStorage } from '../storage/mongodb-knowledge-graph-storage';
import { MongodbEntityContentStorage } from '../storage/mongodb-entity-content-storage';
import { MongoEntityGraphStorage } from '../storage/mongodb-entity-graph-storage';
import KnowledgeStorage from '../storage/knowledgeStorage';
import EntityStorage from '../storage/entityStorage';
import Entity from '../Entity';
import { KnowledgeCreationWorkflow } from '../knowledgeCreation/KnowledgeCreationWorkflow';
import createLoggerWithPrefix from '../lib/logger';

/**
 * 验证运行器
 * 统一运行所有验证测试并生成综合报告
 */
export class ValidationRunner {
  private logger = createLoggerWithPrefix('ValidationRunner');

  constructor() {
    this.logger.info('验证运行器初始化完成');
  }

  /**
   * 运行所有验证测试
   */
  async runAllValidations(): Promise<{
    entityKnowledgeRelationship: any;
    complexScenario: any;
    visualization: any;
    overall: boolean;
    summary: any;
  }> {
    this.logger.info('开始运行所有验证测试');

    const startTime = Date.now();

    try {
      // 1. 运行实体-知识关系验证
      this.logger.info('运行实体-知识关系验证...');
      const entityKnowledgeRelationshipResults =
        await runEntityKnowledgeRelationshipValidation();

      // 2. 运行复杂场景测试
      this.logger.info('运行复杂场景测试...');
      const complexScenarioResults = await runComplexScenarioTests();

      // 3. 运行可视化测试
      this.logger.info('运行可视化测试...');
      const visualizationResults = await this.runVisualizationTests();

      // 4. 计算总体结果
      const overall = this.calculateOverallResult(
        entityKnowledgeRelationshipResults,
        complexScenarioResults,
        visualizationResults,
      );

      // 5. 生成摘要
      const summary = this.generateSummary(
        entityKnowledgeRelationshipResults,
        complexScenarioResults,
        visualizationResults,
        Date.now() - startTime,
      );

      const results = {
        entityKnowledgeRelationship: entityKnowledgeRelationshipResults,
        complexScenario: complexScenarioResults,
        visualization: visualizationResults,
        overall,
        summary,
      };

      this.logger.info('所有验证测试完成', {
        overall,
        duration: Date.now() - startTime,
      });

      return results;
    } catch (error) {
      this.logger.error('运行验证测试失败', error);
      throw error;
    }
  }

  /**
   * 运行可视化测试
   */
  private async runVisualizationTests(): Promise<{
    htmlGeneration: boolean;
    dotGeneration: boolean;
    mermaidGeneration: boolean;
    statsGeneration: boolean;
    overall: boolean;
  }> {
    this.logger.info('开始运行可视化测试');

    try {
      // 初始化存储组件
      const knowledgeContentStorage = new MongodbKnowledgeContentStorage();
      const knowledgeVectorStorage = new MongodbKnowledgeVectorStorage();
      const knowledgeGraphStorage = new MongoKnowledgeGraphStorage();

      const entityContentStorage = new MongodbEntityContentStorage();
      const entityGraphStorage = new MongoEntityGraphStorage();

      // 创建存储实例
      const knowledgeStorage = new KnowledgeStorage(
        knowledgeContentStorage,
        knowledgeGraphStorage,
        knowledgeVectorStorage,
      );

      const mockVectorStorage = {
        store_vector: async () => {},
        get_vector: async () => null,
        update_vector: async () => {},
        delete_vector: async () => false,
        find_similar_vectors: async (
          vector: number[],
          limit?: number,
          threshold?: number,
        ) => {
          // 返回模拟的相似向量结果
          return [
            {
              entityId: 'mock_entity_1',
              similarity: 0.9,
              metadata: { name: 'Mock Entity 1' },
            },
            {
              entityId: 'mock_entity_2',
              similarity: 0.8,
              metadata: { name: 'Mock Entity 2' },
            },
          ].slice(0, limit);
        },
        batch_store_vectors: async () => {},
      };

      const entityStorage = new EntityStorage(
        entityContentStorage,
        entityGraphStorage,
        mockVectorStorage as any,
      );

      const visualizer = new RelationshipVisualizer(
        knowledgeStorage,
        entityStorage,
      );

      // 创建测试实体
      const testEntity = await Entity.create_entity_with_entity_data({
        name: ['可视化测试实体'],
        tags: ['测试', '可视化'],
        definition: '用于测试可视化功能的实体',
      }).save(entityStorage);

      // 创建测试知识
      const workflow = new KnowledgeCreationWorkflow(knowledgeStorage);
      const testKnowledge = await workflow.create_simple_knowledge_from_text(
        '这是用于测试可视化功能的示例知识内容。',
        testEntity,
        '测试知识',
      );

      // 测试各种可视化格式
      const htmlGeneration = await this.testVisualizationFormat(() =>
        visualizer.generateHtmlVisualization(testEntity.get_id()),
      );

      const dotGeneration = await this.testVisualizationFormat(() =>
        visualizer.generateDotGraph(testEntity.get_id()),
      );

      const mermaidGeneration = await this.testVisualizationFormat(() =>
        visualizer.generateMermaidDiagram(testEntity.get_id()),
      );

      const statsGeneration = await this.testVisualizationFormat(() =>
        visualizer.generateRelationshipStats(testEntity.get_id()),
      );

      const overall =
        htmlGeneration && dotGeneration && mermaidGeneration && statsGeneration;

      this.logger.info('可视化测试完成', {
        htmlGeneration,
        dotGeneration,
        mermaidGeneration,
        statsGeneration,
        overall,
      });

      return {
        htmlGeneration,
        dotGeneration,
        mermaidGeneration,
        statsGeneration,
        overall,
      };
    } catch (error) {
      this.logger.error('可视化测试失败', error);
      return {
        htmlGeneration: false,
        dotGeneration: false,
        mermaidGeneration: false,
        statsGeneration: false,
        overall: false,
      };
    }
  }

  /**
   * 测试可视化格式生成
   */
  private async testVisualizationFormat(
    generator: () => Promise<any>,
  ): Promise<boolean> {
    try {
      const result = await generator();
      return result !== null && result !== undefined;
    } catch (error) {
      this.logger.error('可视化格式生成测试失败', error);
      return false;
    }
  }

  /**
   * 计算总体结果
   */
  private calculateOverallResult(
    entityKnowledgeRelationship: any,
    complexScenario: any,
    visualization: any,
  ): boolean {
    return (
      entityKnowledgeRelationship.overall &&
      complexScenario.overall &&
      visualization.overall
    );
  }

  /**
   * 生成测试摘要
   */
  private generateSummary(
    entityKnowledgeRelationship: any,
    complexScenario: any,
    visualization: any,
    duration: number,
  ): any {
    const totalTests =
      this.countTotalTests(entityKnowledgeRelationship) +
      this.countTotalTests(complexScenario) +
      this.countTotalTests(visualization);

    const passedTests =
      this.countPassedTests(entityKnowledgeRelationship) +
      this.countPassedTests(complexScenario) +
      this.countPassedTests(visualization);

    return {
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      successRate:
        totalTests > 0
          ? ((passedTests / totalTests) * 100).toFixed(2) + '%'
          : '0%',
      duration: `${duration}ms`,
      categories: {
        entityKnowledgeRelationship: {
          total: this.countTotalTests(entityKnowledgeRelationship),
          passed: this.countPassedTests(entityKnowledgeRelationship),
          failed:
            this.countTotalTests(entityKnowledgeRelationship) -
            this.countPassedTests(entityKnowledgeRelationship),
        },
        complexScenario: {
          total: this.countTotalTests(complexScenario),
          passed: this.countPassedTests(complexScenario),
          failed:
            this.countTotalTests(complexScenario) -
            this.countPassedTests(complexScenario),
        },
        visualization: {
          total: this.countTotalTests(visualization),
          passed: this.countPassedTests(visualization),
          failed:
            this.countTotalTests(visualization) -
            this.countPassedTests(visualization),
        },
      },
    };
  }

  /**
   * 计算总测试数量
   */
  private countTotalTests(results: any): number {
    if (!results) return 0;

    let count = 0;
    for (const key in results) {
      if (typeof results[key] === 'boolean') {
        count++;
      } else if (
        typeof results[key] === 'object' &&
        !Array.isArray(results[key])
      ) {
        count += this.countTotalTests(results[key]);
      }
    }
    return count;
  }

  /**
   * 计算通过的测试数量
   */
  private countPassedTests(results: any): number {
    if (!results) return 0;

    let count = 0;
    for (const key in results) {
      if (typeof results[key] === 'boolean' && results[key] === true) {
        count++;
      } else if (
        typeof results[key] === 'object' &&
        !Array.isArray(results[key])
      ) {
        count += this.countPassedTests(results[key]);
      }
    }
    return count;
  }

  /**
   * 生成详细的验证报告
   */
  async generateDetailedReport(results: any): Promise<string> {
    const reportLines: string[] = [];

    reportLines.push('# 实体-知识关系验证报告');
    reportLines.push('');
    reportLines.push(`生成时间: ${new Date().toISOString()}`);
    reportLines.push(`测试持续时间: ${results.summary.duration}`);
    reportLines.push('');

    // 摘要
    reportLines.push('## 测试摘要');
    reportLines.push('');
    reportLines.push(`- 总测试数: ${results.summary.totalTests}`);
    reportLines.push(`- 通过测试: ${results.summary.passedTests}`);
    reportLines.push(`- 失败测试: ${results.summary.failedTests}`);
    reportLines.push(`- 成功率: ${results.summary.successRate}`);
    reportLines.push(`- 总体结果: ${results.overall ? '✅ 通过' : '❌ 失败'}`);
    reportLines.push('');

    // 分类结果
    reportLines.push('## 分类测试结果');
    reportLines.push('');

    // 实体-知识关系验证
    reportLines.push('### 1. 实体-知识关系验证');
    reportLines.push('');
    const ekResults = results.entityKnowledgeRelationship;
    reportLines.push(
      `- 实体-知识创建流程: ${ekResults.entityKnowledgeCreation ? '✅ 通过' : '❌ 失败'}`,
    );
    reportLines.push(
      `- 知识层次结构: ${ekResults.knowledgeHierarchy ? '✅ 通过' : '❌ 失败'}`,
    );
    reportLines.push(
      `- 向量相似性搜索: ${ekResults.vectorSimilaritySearch ? '✅ 通过' : '❌ 失败'}`,
    );
    reportLines.push('');

    // 复杂场景测试
    reportLines.push('### 2. 复杂场景测试');
    reportLines.push('');
    const csResults = results.complexScenario;
    reportLines.push(
      `- 多实体关联: ${csResults.multiEntity ? '✅ 通过' : '❌ 失败'}`,
    );
    reportLines.push(
      `- 深度层次结构: ${csResults.deepHierarchy ? '✅ 通过' : '❌ 失败'}`,
    );
    reportLines.push(
      `- 复杂查询: ${csResults.complexQuery ? '✅ 通过' : '❌ 失败'}`,
    );
    reportLines.push(
      `- 并发操作: ${csResults.concurrentOperation ? '✅ 通过' : '❌ 失败'}`,
    );
    reportLines.push(
      `- 大数据量: ${csResults.bigData ? '✅ 通过' : '❌ 失败'}`,
    );
    reportLines.push('');

    // 可视化测试
    reportLines.push('### 3. 可视化测试');
    reportLines.push('');
    const vizResults = results.visualization;
    reportLines.push(
      `- HTML生成: ${vizResults.htmlGeneration ? '✅ 通过' : '❌ 失败'}`,
    );
    reportLines.push(
      `- DOT图生成: ${vizResults.dotGeneration ? '✅ 通过' : '❌ 失败'}`,
    );
    reportLines.push(
      `- Mermaid图生成: ${vizResults.mermaidGeneration ? '✅ 通过' : '❌ 失败'}`,
    );
    reportLines.push(
      `- 统计信息生成: ${vizResults.statsGeneration ? '✅ 通过' : '❌ 失败'}`,
    );
    reportLines.push('');

    // 建议
    reportLines.push('## 建议');
    reportLines.push('');

    if (results.overall) {
      reportLines.push('🎉 所有测试均通过！实体-知识关系系统运行正常。');
      reportLines.push('');
      reportLines.push('建议：');
      reportLines.push('- 定期运行验证测试以确保系统稳定性');
      reportLines.push('- 监控系统性能，特别是在大数据量场景下');
      reportLines.push('- 考虑添加更多边界条件测试用例');
    } else {
      reportLines.push('⚠️ 部分测试失败，需要进一步检查。');
      reportLines.push('');
      reportLines.push('建议：');
      reportLines.push('- 检查失败的测试用例，分析失败原因');
      reportLines.push('- 验证数据库连接和配置');
      reportLines.push('- 检查相关依赖项是否正确安装');
      reportLines.push('- 查看详细日志以获取更多信息');
    }

    reportLines.push('');
    reportLines.push('---');
    reportLines.push('*报告由验证运行器自动生成*');

    return reportLines.join('\n');
  }

  /**
   * 保存验证报告到文件
   */
  async saveReportToFile(
    results: any,
    outputPath: string = './validation-report.md',
  ): Promise<void> {
    try {
      const report = await this.generateDetailedReport(results);

      // 在实际应用中，这里应该调用文件系统API
      // await fs.writeFile(outputPath, report, 'utf8');

      this.logger.info(`验证报告已生成，可保存到: ${outputPath}`);
      console.log('\n=== 验证报告 ===');
      console.log(report);

      // 显示报告的前几行作为预览
      const previewLines = report.split('\n').slice(0, 20);
      console.log('\n=== 报告预览 ===');
      console.log(previewLines.join('\n'));
      console.log('...\n');
    } catch (error) {
      this.logger.error('保存验证报告失败', error);
      throw error;
    }
  }
}

/**
 * 运行所有验证测试的主函数
 */
export async function runAllValidations() {
  const runner = new ValidationRunner();

  try {
    console.log('🚀 开始运行实体-知识关系验证测试...\n');

    const results = await runner.runAllValidations();

    // 显示简要结果
    console.log('=== 验证结果摘要 ===');
    console.log(`总体结果: ${results.overall ? '✅ 通过' : '❌ 失败'}`);
    console.log(`总测试数: ${results.summary.totalTests}`);
    console.log(`通过测试: ${results.summary.passedTests}`);
    console.log(`失败测试: ${results.summary.failedTests}`);
    console.log(`成功率: ${results.summary.successRate}`);
    console.log(`持续时间: ${results.summary.duration}`);

    // 生成详细报告
    await runner.saveReportToFile(results);

    return results;
  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error);
    throw error;
  }
}

// 如果直接运行此文件，执行所有验证
if (require.main === module) {
  runAllValidations()
    .then((results) => {
      process.exit(results.overall ? 0 : 1);
    })
    .catch((error) => {
      console.error('验证运行失败:', error);
      process.exit(1);
    });
}
