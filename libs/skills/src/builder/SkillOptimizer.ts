import { Skill } from '../core/Skill.interface';
import { TestResult } from '../testing/TestCase';
import { SkillEvaluator, EvaluationReport } from './SkillEvaluator';
import { FeedbackCollector } from './FeedbackCollector';
import { SkillBuilder } from './SkillBuilder';

export interface OptimizationStrategy {
  name: string;
  description: string;
  apply: (skill: Skill, context: OptimizationContext) => Promise<Skill>;
}

export interface OptimizationContext {
  evaluation: EvaluationReport;
  feedback: any[];
  testResults: TestResult[];
  iterations: number;
}

export interface OptimizationResult {
  originalSkill: Skill;
  optimizedSkill: Skill;
  improvements: {
    metric: string;
    before: number;
    after: number;
    improvement: number;
  }[];
  iterations: number;
  strategies: string[];
}

/**
 * Skill Optimizer - iteratively improves skills based on feedback and test results
 */
export class SkillOptimizer {
  private strategies: OptimizationStrategy[] = [];

  constructor(
    private evaluator: SkillEvaluator,
    private feedbackCollector: FeedbackCollector,
    private builder: SkillBuilder
  ) {
    this.registerDefaultStrategies();
  }

  /**
   * Optimize a skill iteratively
   */
  async optimize(
    skill: Skill,
    testResults: TestResult[],
    options: {
      maxIterations?: number;
      targetScore?: number;
      strategies?: string[];
    } = {}
  ): Promise<OptimizationResult> {
    const maxIterations = options.maxIterations || 5;
    const targetScore = options.targetScore || 80;

    let currentSkill = skill;
    let currentEvaluation = await this.evaluator.evaluate(skill, testResults);
    const improvements: OptimizationResult['improvements'] = [];
    const appliedStrategies: string[] = [];

    for (let i = 0; i < maxIterations; i++) {
      // Check if target score reached
      if (currentEvaluation.metrics.overallScore >= targetScore) {
        console.log(`Target score ${targetScore} reached after ${i} iterations`);
        break;
      }

      // Collect feedback
      const feedback = this.feedbackCollector.getFeedback(skill.name, {
        status: 'open'
      });

      // Select and apply optimization strategy
      const strategy = this.selectStrategy(currentEvaluation, feedback, options.strategies);
      if (!strategy) {
        console.log('No applicable strategy found');
        break;
      }

      console.log(`Iteration ${i + 1}: Applying strategy "${strategy.name}"`);

      // Apply strategy
      const optimizedSkill = await strategy.apply(currentSkill, {
        evaluation: currentEvaluation,
        feedback,
        testResults,
        iterations: i
      });

      // Re-evaluate
      const newEvaluation = await this.evaluator.evaluate(optimizedSkill, testResults);

      // Track improvements
      this.trackImprovements(
        currentEvaluation,
        newEvaluation,
        improvements
      );

      appliedStrategies.push(strategy.name);
      currentSkill = optimizedSkill;
      currentEvaluation = newEvaluation;
    }

    return {
      originalSkill: skill,
      optimizedSkill: currentSkill,
      improvements,
      iterations: appliedStrategies.length,
      strategies: appliedStrategies
    };
  }

  /**
   * Register an optimization strategy
   */
  registerStrategy(strategy: OptimizationStrategy): void {
    this.strategies.push(strategy);
  }

  /**
   * Get all registered strategies
   */
  getStrategies(): OptimizationStrategy[] {
    return this.strategies;
  }

  // Private methods

  private registerDefaultStrategies(): void {
    // Strategy 1: Fix failing tests
    this.registerStrategy({
      name: 'fix-failing-tests',
      description: 'Fix implementation to pass failing tests',
      apply: async (skill, context) => {
        const failedTests = context.testResults.filter(r => !r.passed);
        if (failedTests.length === 0) return skill;

        const feedback = failedTests
          .map(t => `Test "${t.testCase.name}" failed: ${t.error}`)
          .join('\n');

        return await this.builder.refineSkill(skill, feedback, context.testResults);
      }
    });

    // Strategy 2: Improve documentation
    this.registerStrategy({
      name: 'improve-documentation',
      description: 'Enhance documentation and descriptions',
      apply: async (skill, context) => {
        if (context.evaluation.metrics.documentation >= 0.8) return skill;

        const feedback = `
Improve documentation:
- Add detailed descriptions for all tools
- Document parameters and return values
- Add usage examples
- Improve capability and direction sections
        `;

        return await this.builder.refineSkill(skill, feedback, context.testResults);
      }
    });

    // Strategy 3: Optimize performance
    this.registerStrategy({
      name: 'optimize-performance',
      description: 'Improve execution efficiency',
      apply: async (skill, context) => {
        if (context.evaluation.metrics.efficiency >= 0.7) return skill;

        const feedback = `
Optimize performance:
- Reduce unnecessary tool calls
- Use parallel execution where possible
- Cache intermediate results
- Optimize algorithms
Average execution time: ${context.evaluation.metrics.averageExecutionTime}ms
        `;

        return await this.builder.refineSkill(skill, feedback, context.testResults);
      }
    });

    // Strategy 4: Improve error handling
    this.registerStrategy({
      name: 'improve-error-handling',
      description: 'Add robust error handling',
      apply: async (skill, context) => {
        if (context.evaluation.metrics.errorRate === 0) return skill;

        const feedback = `
Improve error handling:
- Add try-catch blocks
- Validate inputs
- Provide meaningful error messages
- Handle edge cases
Error rate: ${(context.evaluation.metrics.errorRate * 100).toFixed(1)}%
        `;

        return await this.builder.refineSkill(skill, feedback, context.testResults);
      }
    });

    // Strategy 5: Refactor for maintainability
    this.registerStrategy({
      name: 'refactor-maintainability',
      description: 'Improve code structure and maintainability',
      apply: async (skill, context) => {
        if (context.evaluation.metrics.maintainability >= 0.8) return skill;

        const feedback = `
Refactor for maintainability:
- Break down large functions
- Extract helper functions
- Reduce complexity
- Improve code organization
        `;

        return await this.builder.refineSkill(skill, feedback, context.testResults);
      }
    });
  }

  private selectStrategy(
    evaluation: EvaluationReport,
    feedback: any[],
    allowedStrategies?: string[]
  ): OptimizationStrategy | null {
    // Priority order based on evaluation metrics
    const priorities: Array<{ condition: boolean; strategyName: string }> = [
      {
        condition: evaluation.metrics.testPassRate < 1.0,
        strategyName: 'fix-failing-tests'
      },
      {
        condition: evaluation.metrics.errorRate > 0.1,
        strategyName: 'improve-error-handling'
      },
      {
        condition: evaluation.metrics.efficiency < 0.6,
        strategyName: 'optimize-performance'
      },
      {
        condition: evaluation.metrics.documentation < 0.7,
        strategyName: 'improve-documentation'
      },
      {
        condition: evaluation.metrics.maintainability < 0.7,
        strategyName: 'refactor-maintainability'
      }
    ];

    for (const priority of priorities) {
      if (priority.condition) {
        const strategy = this.strategies.find(s => s.name === priority.strategyName);
        if (strategy && (!allowedStrategies || allowedStrategies.includes(strategy.name))) {
          return strategy;
        }
      }
    }

    return null;
  }

  private trackImprovements(
    before: EvaluationReport,
    after: EvaluationReport,
    improvements: OptimizationResult['improvements']
  ): void {
    const metrics = [
      'testPassRate',
      'codeQuality',
      'documentation',
      'maintainability',
      'efficiency',
      'resourceUsage',
      'overallScore'
    ];

    for (const metric of metrics) {
      const beforeValue = before.metrics[metric as keyof typeof before.metrics];
      const afterValue = after.metrics[metric as keyof typeof after.metrics];

      if (beforeValue !== afterValue) {
        const improvement = afterValue - beforeValue;
        improvements.push({
          metric,
          before: beforeValue,
          after: afterValue,
          improvement
        });
      }
    }
  }

  /**
   * Generate optimization report
   */
  generateReport(result: OptimizationResult): string {
    return `
# Skill Optimization Report

## Skill: ${result.originalSkill.name}

**Iterations**: ${result.iterations}
**Strategies Applied**: ${result.strategies.join(', ')}

## Improvements

${result.improvements
  .map(
    imp => `
### ${imp.metric}
- **Before**: ${imp.before.toFixed(2)}
- **After**: ${imp.after.toFixed(2)}
- **Improvement**: ${imp.improvement > 0 ? '+' : ''}${imp.improvement.toFixed(2)} (${((imp.improvement / imp.before) * 100).toFixed(1)}%)
`
  )
  .join('\n')}

## Summary

The skill has been optimized through ${result.iterations} iteration(s).
Overall score improved from ${result.improvements.find(i => i.metric === 'overallScore')?.before || 'N/A'}
to ${result.improvements.find(i => i.metric === 'overallScore')?.after || 'N/A'}.

---
*Generated by SkillOptimizer*
    `;
  }
}
