import { Skill } from '../core/Skill.interface';
import { TestResult } from '../testing/TestCase';

export interface EvaluationMetrics {
  // Functional metrics
  testPassRate: number;
  averageExecutionTime: number;
  errorRate: number;

  // Quality metrics
  codeQuality: number; // 0-1
  documentation: number; // 0-1
  maintainability: number; // 0-1

  // Performance metrics
  efficiency: number; // 0-1
  resourceUsage: number; // 0-1

  // Overall score
  overallScore: number; // 0-100
}

export interface EvaluationReport {
  skill: Skill;
  metrics: EvaluationMetrics;
  testResults: TestResult[];
  recommendations: string[];
  timestamp: number;
}

export class SkillEvaluator {
  /**
   * Evaluate skill quality
   */
  async evaluate(
    skill: Skill,
    testResults: TestResult[]
  ): Promise<EvaluationReport> {
    const metrics = this.calculateMetrics(skill, testResults);
    const recommendations = this.generateRecommendations(skill, metrics, testResults);

    return {
      skill,
      metrics,
      testResults,
      recommendations,
      timestamp: Date.now()
    };
  }

  private calculateMetrics(skill: Skill, testResults: TestResult[]): EvaluationMetrics {
    // 1. Test pass rate
    const passed = testResults.filter(r => r.passed).length;
    const testPassRate = testResults.length > 0 ? passed / testResults.length : 0;

    // 2. Average execution time
    const averageExecutionTime =
      testResults.length > 0
        ? testResults.reduce((sum, r) => sum + r.duration, 0) / testResults.length
        : 0;

    // 3. Error rate
    const errorRate =
      testResults.length > 0
        ? testResults.filter(r => r.error).length / testResults.length
        : 0;

    // 4. Code quality (static analysis)
    const codeQuality = this.assessCodeQuality(skill);

    // 5. Documentation completeness
    const documentation = this.assessDocumentation(skill);

    // 6. Maintainability
    const maintainability = this.assessMaintainability(skill);

    // 7. Efficiency
    const efficiency = this.assessEfficiency(skill, averageExecutionTime);

    // 8. Resource usage
    const resourceUsage = this.assessResourceUsage(skill);

    // 9. Overall score
    const overallScore = this.calculateOverallScore({
      testPassRate,
      codeQuality,
      documentation,
      maintainability,
      efficiency,
      resourceUsage
    });

    return {
      testPassRate,
      averageExecutionTime,
      errorRate,
      codeQuality,
      documentation,
      maintainability,
      efficiency,
      resourceUsage,
      overallScore
    };
  }

  private assessCodeQuality(skill: Skill): number {
    let score = 1.0;

    // Check if has tools or orchestration
    if (!skill.tools && !skill.orchestrate) {
      score -= 0.3;
    }

    // Check error handling
    const hasErrorHandling = this.checkErrorHandling(skill);
    if (!hasErrorHandling) {
      score -= 0.2;
    }

    // Check code complexity
    const complexity = this.calculateComplexity(skill);
    if (complexity > 10) {
      score -= 0.2;
    }

    return Math.max(0, score);
  }

  private assessDocumentation(skill: Skill): number {
    let score = 0;

    // Basic info
    if (skill.description) score += 0.2;
    if (skill.promptFragments?.capability) score += 0.2;
    if (skill.promptFragments?.direction) score += 0.2;

    // Tool documentation
    if (skill.tools) {
      const toolsWithDocs = Object.values(skill.tools).filter(
        t => t.description && t.description.length > 10
      ).length;
      score += (toolsWithDocs / Object.keys(skill.tools).length) * 0.2;
    } else {
      score += 0.2;
    }

    // Metadata
    if (skill.metadata) score += 0.2;

    return score;
  }

  private assessMaintainability(skill: Skill): number {
    let score = 1.0;

    // Check function length
    if (skill.orchestrate) {
      const funcLength = skill.orchestrate.toString().split('\n').length;
      if (funcLength > 100) score -= 0.2;
    }

    // Check dependency count
    if (skill.requiredTools && skill.requiredTools.length > 10) {
      score -= 0.2;
    }

    // Check for helper functions (modularity)
    if (skill.helpers && Object.keys(skill.helpers).length > 0) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  private assessEfficiency(skill: Skill, avgTime: number): number {
    // Based on average execution time
    if (avgTime < 1000) return 1.0;
    if (avgTime < 5000) return 0.8;
    if (avgTime < 10000) return 0.6;
    if (avgTime < 30000) return 0.4;
    return 0.2;
  }

  private assessResourceUsage(skill: Skill): number {
    // Simplified: based on tool call count
    let toolCallCount = 0;

    if (skill.orchestrate) {
      const code = skill.orchestrate.toString();
      toolCallCount = (code.match(/tools\.call/g) || []).length;
    }

    if (toolCallCount < 5) return 1.0;
    if (toolCallCount < 10) return 0.8;
    if (toolCallCount < 20) return 0.6;
    return 0.4;
  }

  private calculateOverallScore(metrics: Partial<EvaluationMetrics>): number {
    const weights = {
      testPassRate: 0.3,
      codeQuality: 0.2,
      documentation: 0.15,
      maintainability: 0.15,
      efficiency: 0.1,
      resourceUsage: 0.1
    };

    let score = 0;
    for (const [key, weight] of Object.entries(weights)) {
      score += (metrics[key as keyof EvaluationMetrics] || 0) * weight;
    }

    return Math.round(score * 100);
  }

  private generateRecommendations(
    skill: Skill,
    metrics: EvaluationMetrics,
    testResults: TestResult[]
  ): string[] {
    const recommendations: string[] = [];

    // Test-related
    if (metrics.testPassRate < 0.8) {
      recommendations.push(
        `Improve test pass rate (currently ${(metrics.testPassRate * 100).toFixed(1)}%). ` +
          `Review failing tests and fix implementation.`
      );
    }

    // Code quality
    if (metrics.codeQuality < 0.7) {
      recommendations.push(
        'Improve code quality by adding error handling, reducing complexity, and following best practices.'
      );
    }

    // Documentation
    if (metrics.documentation < 0.7) {
      recommendations.push(
        'Enhance documentation: add detailed descriptions, parameter documentation, and usage examples.'
      );
    }

    // Maintainability
    if (metrics.maintainability < 0.7) {
      recommendations.push(
        'Improve maintainability by breaking down large functions, reducing dependencies, and adding helper functions.'
      );
    }

    // Performance
    if (metrics.efficiency < 0.6) {
      recommendations.push(
        `Optimize performance. Average execution time is ${metrics.averageExecutionTime.toFixed(0)}ms. ` +
          `Consider caching, parallel execution, or algorithm improvements.`
      );
    }

    // Resource usage
    if (metrics.resourceUsage < 0.6) {
      recommendations.push(
        'Reduce resource usage by minimizing tool calls, batching operations, or optimizing data flow.'
      );
    }

    // Specific test failures
    const failedTests = testResults.filter(r => !r.passed);
    if (failedTests.length > 0) {
      recommendations.push(
        `Fix ${failedTests.length} failing test(s): ${failedTests.map(t => t.testCase.name).join(', ')}`
      );
    }

    return recommendations;
  }

  private checkErrorHandling(skill: Skill): boolean {
    if (skill.orchestrate) {
      const code = skill.orchestrate.toString();
      return code.includes('try') || code.includes('catch') || code.includes('throw');
    }

    if (skill.tools) {
      return Object.values(skill.tools).some(tool => {
        const code = tool.handler.toString();
        return code.includes('try') || code.includes('catch') || code.includes('throw');
      });
    }

    return false;
  }

  private calculateComplexity(skill: Skill): number {
    let complexity = 0;

    if (skill.orchestrate) {
      const code = skill.orchestrate.toString();
      // Count control flow statements
      complexity += (code.match(/if\s*\(/g) || []).length;
      complexity += (code.match(/for\s*\(/g) || []).length;
      complexity += (code.match(/while\s*\(/g) || []).length;
      complexity += (code.match(/switch\s*\(/g) || []).length;
    }

    return complexity;
  }

  /**
   * Generate detailed evaluation report
   */
  generateReport(evaluation: EvaluationReport): string {
    const { skill, metrics, testResults, recommendations } = evaluation;

    return `
# Skill Evaluation Report: ${skill.name}

**Version**: ${skill.version}
**Category**: ${skill.metadata?.category || 'N/A'}
**Evaluated**: ${new Date(evaluation.timestamp).toISOString()}

## Overall Score: ${metrics.overallScore}/100

## Metrics

| Metric | Score | Status |
|--------|-------|--------|
| Test Pass Rate | ${(metrics.testPassRate * 100).toFixed(1)}% | ${this.getStatus(metrics.testPassRate)} |
| Code Quality | ${(metrics.codeQuality * 100).toFixed(1)}% | ${this.getStatus(metrics.codeQuality)} |
| Documentation | ${(metrics.documentation * 100).toFixed(1)}% | ${this.getStatus(metrics.documentation)} |
| Maintainability | ${(metrics.maintainability * 100).toFixed(1)}% | ${this.getStatus(metrics.maintainability)} |
| Efficiency | ${(metrics.efficiency * 100).toFixed(1)}% | ${this.getStatus(metrics.efficiency)} |
| Resource Usage | ${(metrics.resourceUsage * 100).toFixed(1)}% | ${this.getStatus(metrics.resourceUsage)} |

**Average Execution Time**: ${metrics.averageExecutionTime.toFixed(0)}ms
**Error Rate**: ${(metrics.errorRate * 100).toFixed(1)}%

## Test Results

- **Total Tests**: ${testResults.length}
- **Passed**: ${testResults.filter(r => r.passed).length}
- **Failed**: ${testResults.filter(r => !r.passed).length}

${testResults
  .map(
    (r, i) => `
### Test ${i + 1}: ${r.testCase.name}
- Status: ${r.passed ? '✓ PASSED' : '✗ FAILED'}
- Duration: ${r.duration}ms
${r.error ? `- Error: ${r.error}` : ''}
`
  )
  .join('\n')}

## Recommendations

${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

---
*Generated by SkillEvaluator*
    `;
  }

  private getStatus(score: number): string {
    if (score >= 0.8) return '✓ Good';
    if (score >= 0.6) return '⚠ Fair';
    return '✗ Poor';
  }
}
