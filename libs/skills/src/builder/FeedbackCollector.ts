import { Skill } from '../core/Skill.interface';
import { TestResult } from '../testing/TestCase';

export interface FeedbackItem {
  id: string;
  skillName: string;
  skillVersion: string;
  type: 'bug' | 'improvement' | 'feature' | 'performance' | 'documentation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  context?: {
    testCase?: string;
    input?: any;
    output?: any;
    expectedOutput?: any;
  };
  reporter: string;
  timestamp: number;
  status: 'open' | 'in_progress' | 'resolved' | 'wont_fix';
  resolution?: string;
}

export interface FeedbackSummary {
  skillName: string;
  totalFeedback: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  recentFeedback: FeedbackItem[];
}

/**
 * Feedback Collector - collects and manages human feedback for skills
 */
export class FeedbackCollector {
  private feedback: Map<string, FeedbackItem[]> = new Map();

  /**
   * Add feedback for a skill
   */
  addFeedback(feedback: Omit<FeedbackItem, 'id' | 'timestamp' | 'status'>): FeedbackItem {
    const item: FeedbackItem = {
      ...feedback,
      id: this.generateId(),
      timestamp: Date.now(),
      status: 'open'
    };

    const skillFeedback = this.feedback.get(feedback.skillName) || [];
    skillFeedback.push(item);
    this.feedback.set(feedback.skillName, skillFeedback);

    return item;
  }

  /**
   * Add feedback from test results
   */
  addFeedbackFromTests(
    skill: Skill,
    testResults: TestResult[],
    reporter: string = 'automated'
  ): FeedbackItem[] {
    const items: FeedbackItem[] = [];

    for (const result of testResults) {
      if (!result.passed) {
        const item = this.addFeedback({
          skillName: skill.name,
          skillVersion: skill.version,
          type: 'bug',
          severity: this.determineSeverity(result),
          description: `Test "${result.testCase.name}" failed: ${result.error || 'Output mismatch'}`,
          context: {
            testCase: result.testCase.name,
            input: result.testCase.input,
            output: result.actual,
            expectedOutput: result.testCase.expected
          },
          reporter
        });
        items.push(item);
      }
    }

    return items;
  }

  /**
   * Get feedback for a skill
   */
  getFeedback(skillName: string, filters?: {
    type?: FeedbackItem['type'];
    severity?: FeedbackItem['severity'];
    status?: FeedbackItem['status'];
  }): FeedbackItem[] {
    let items = this.feedback.get(skillName) || [];

    if (filters) {
      if (filters.type) {
        items = items.filter(item => item.type === filters.type);
      }
      if (filters.severity) {
        items = items.filter(item => item.severity === filters.severity);
      }
      if (filters.status) {
        items = items.filter(item => item.status === filters.status);
      }
    }

    return items;
  }

  /**
   * Get feedback summary for a skill
   */
  getSummary(skillName: string): FeedbackSummary {
    const items = this.feedback.get(skillName) || [];

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const item of items) {
      byType[item.type] = (byType[item.type] || 0) + 1;
      bySeverity[item.severity] = (bySeverity[item.severity] || 0) + 1;
      byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    }

    // Get recent feedback (last 10)
    const recentFeedback = items
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    return {
      skillName,
      totalFeedback: items.length,
      byType,
      bySeverity,
      byStatus,
      recentFeedback
    };
  }

  /**
   * Update feedback status
   */
  updateStatus(
    feedbackId: string,
    status: FeedbackItem['status'],
    resolution?: string
  ): boolean {
    for (const items of this.feedback.values()) {
      const item = items.find(i => i.id === feedbackId);
      if (item) {
        item.status = status;
        if (resolution) {
          item.resolution = resolution;
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Get high priority feedback (critical and high severity, open status)
   */
  getHighPriorityFeedback(skillName: string): FeedbackItem[] {
    const items = this.feedback.get(skillName) || [];
    return items.filter(
      item =>
        (item.severity === 'critical' || item.severity === 'high') &&
        item.status === 'open'
    );
  }

  /**
   * Generate improvement suggestions from feedback
   */
  generateImprovementSuggestions(skillName: string): string[] {
    const items = this.getFeedback(skillName, { status: 'open' });
    const suggestions: string[] = [];

    // Group by type
    const byType = new Map<string, FeedbackItem[]>();
    for (const item of items) {
      const group = byType.get(item.type) || [];
      group.push(item);
      byType.set(item.type, group);
    }

    // Generate suggestions for each type
    for (const [type, typeItems] of byType.entries()) {
      if (typeItems.length === 0) continue;

      switch (type) {
        case 'bug':
          suggestions.push(
            `Fix ${typeItems.length} bug(s): ${typeItems.map(i => i.description).join('; ')}`
          );
          break;

        case 'performance':
          suggestions.push(
            `Optimize performance: ${typeItems.length} performance issue(s) reported`
          );
          break;

        case 'documentation':
          suggestions.push(
            `Improve documentation: ${typeItems.length} documentation issue(s) reported`
          );
          break;

        case 'feature':
          suggestions.push(
            `Consider adding ${typeItems.length} requested feature(s)`
          );
          break;

        case 'improvement':
          suggestions.push(
            `Apply ${typeItems.length} suggested improvement(s)`
          );
          break;
      }
    }

    return suggestions;
  }

  /**
   * Export feedback to JSON
   */
  exportFeedback(skillName: string): string {
    const items = this.feedback.get(skillName) || [];
    return JSON.stringify(items, null, 2);
  }

  /**
   * Import feedback from JSON
   */
  importFeedback(skillName: string, json: string): void {
    const items = JSON.parse(json) as FeedbackItem[];
    this.feedback.set(skillName, items);
  }

  /**
   * Clear feedback for a skill
   */
  clearFeedback(skillName: string): void {
    this.feedback.delete(skillName);
  }

  /**
   * Get all feedback across all skills
   */
  getAllFeedback(): Map<string, FeedbackItem[]> {
    return new Map(this.feedback);
  }

  // Private helpers

  private generateId(): string {
    return `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineSeverity(result: TestResult): FeedbackItem['severity'] {
    // Determine severity based on test result
    if (result.error) {
      if (result.error.includes('timeout') || result.error.includes('crash')) {
        return 'critical';
      }
      if (result.error.includes('TypeError') || result.error.includes('ReferenceError')) {
        return 'high';
      }
      return 'medium';
    }

    // Output mismatch
    return 'medium';
  }

  /**
   * Generate feedback report
   */
  generateReport(skillName: string): string {
    const summary = this.getSummary(skillName);
    const highPriority = this.getHighPriorityFeedback(skillName);
    const suggestions = this.generateImprovementSuggestions(skillName);

    return `
# Feedback Report: ${skillName}

## Summary

- **Total Feedback**: ${summary.totalFeedback}
- **Open Issues**: ${summary.byStatus['open'] || 0}
- **In Progress**: ${summary.byStatus['in_progress'] || 0}
- **Resolved**: ${summary.byStatus['resolved'] || 0}

## By Type

${Object.entries(summary.byType)
  .map(([type, count]) => `- ${type}: ${count}`)
  .join('\n')}

## By Severity

${Object.entries(summary.bySeverity)
  .map(([severity, count]) => `- ${severity}: ${count}`)
  .join('\n')}

## High Priority Issues (${highPriority.length})

${highPriority
  .map(
    (item, i) => `
### ${i + 1}. [${item.severity.toUpperCase()}] ${item.description}
- **Type**: ${item.type}
- **Reporter**: ${item.reporter}
- **Date**: ${new Date(item.timestamp).toISOString()}
${item.context ? `- **Context**: ${JSON.stringify(item.context, null, 2)}` : ''}
`
  )
  .join('\n')}

## Improvement Suggestions

${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## Recent Feedback

${summary.recentFeedback
  .map(
    (item, i) => `
### ${i + 1}. [${item.type}] ${item.description}
- **Severity**: ${item.severity}
- **Status**: ${item.status}
- **Reporter**: ${item.reporter}
- **Date**: ${new Date(item.timestamp).toLocaleDateString()}
`
  )
  .join('\n')}

---
*Generated by FeedbackCollector*
    `;
  }
}
