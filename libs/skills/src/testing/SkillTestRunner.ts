import { VirtualWorkspace } from 'stateful-context';
import type { Skill, ToolRegistry } from '../core/Skill.interface.js';
import type { TestCase, TestResult, TestSuite } from './TestCase.js';
import { assert } from './assertions.js';

export interface TestRunnerConfig {
  verbose?: boolean;
  stopOnFailure?: boolean;
  timeout?: number;
}

class SkillTestRunner {
  constructor(
    private workspace: VirtualWorkspace,
    private config: TestRunnerConfig = {}
  ) { }

  /**
   * Run a single test case
   */
  async runTest(skill: Skill, testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Execute setup
      if (testCase.setup) {
        await testCase.setup(this.workspace);
      }

      // Execute test
      let actual: any;
      const timeout = testCase.timeout || this.config.timeout || 30000;

      if (testCase.type === 'orchestration') {
        // Test orchestration function
        if (!skill.orchestrate) {
          throw new Error('Skill does not have orchestration function');
        }

        const toolRegistry = this.createToolRegistry();
        actual = await this.withTimeout(
          skill.orchestrate(toolRegistry, testCase.input, {
            workspace: this.workspace,
            tools: toolRegistry,
            state: {}
          }),
          timeout
        );
      } else if (testCase.type === 'tool') {
        // Test individual tool
        if (!testCase.toolName) {
          throw new Error('Tool name not specified for tool test');
        }

        const toolName = `${skill.name}__${testCase.toolName}`;
        actual = await this.withTimeout(
          this.workspace.handleToolCall(toolName, testCase.input),
          timeout
        );
      } else if (testCase.type === 'integration') {
        // Integration test
        actual = await this.runIntegrationTest(skill, testCase, timeout);
      }

      // Execute assertions
      let passed = false;
      if (testCase.customAssert) {
        passed = await testCase.customAssert(actual, testCase.expected);
      } else {
        try {
          assert.deepEqual(actual, testCase.expected);
          passed = true;
        } catch (error) {
          passed = false;
        }
      }

      // Execute teardown
      if (testCase.teardown) {
        await testCase.teardown(this.workspace);
      }

      const duration = Date.now() - startTime;

      return {
        testCase,
        passed,
        actual,
        duration,
        timestamp: Date.now()
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        testCase,
        passed: false,
        actual: null,
        error: error instanceof Error ? error.message : String(error),
        duration,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Run test suite
   */
  async runSuite(skill: Skill, suite: TestSuite): Promise<TestResult[]> {
    const results: TestResult[] = [];

    if (this.config.verbose) {
      console.log(`\n🧪 Running test suite: ${suite.name}`);
      console.log(`   ${suite.description}\n`);
    }

    // Execute beforeAll
    if (suite.beforeAll) {
      await suite.beforeAll();
    }

    // Run all tests
    for (const testCase of suite.testCases) {
      if (this.config.verbose) {
        console.log(`   ▶ ${testCase.name}...`);
      }

      const result = await this.runTest(skill, testCase);
      results.push(result);

      if (this.config.verbose) {
        if (result.passed) {
          console.log(`   ✓ ${testCase.name} (${result.duration}ms)`);
        } else {
          console.log(`   ✗ ${testCase.name} (${result.duration}ms)`);
          console.log(`     Error: ${result.error}`);
          console.log(`     Expected: ${JSON.stringify(testCase.expected)}`);
          console.log(`     Actual: ${JSON.stringify(result.actual)}`);
        }
      }

      // Stop on failure if configured
      if (!result.passed && this.config.stopOnFailure) {
        break;
      }
    }

    // Execute afterAll
    if (suite.afterAll) {
      await suite.afterAll();
    }

    // Print summary
    if (this.config.verbose) {
      const passed = results.filter(r => r.passed).length;
      const total = results.length;
      console.log(`\n   Summary: ${passed}/${total} tests passed\n`);
    }

    return results;
  }

  /**
   * Extract test cases from markdown
   */
  extractTestsFromMarkdown(skillMarkdown: string): TestCase[] {
    const testCases: TestCase[] = [];

    const testSection = skillMarkdown.match(
      /## Test Cases\n([\s\S]*?)(?=\n##|\n---|\n$)/
    );
    if (!testSection || !testSection[1]) return testCases;

    // Extract each test case
    const testMatches = testSection[1].matchAll(
      /### Test Case \d+: (.+?)\n\n\*\*Input:\*\*\n```json\n([\s\S]*?)\n```\n\n\*\*Expected Output:\*\*\n```json\n([\s\S]*?)\n```/g
    );

    for (const match of testMatches) {
      const name = match[1];
      const inputJson = match[2];
      const expectedJson = match[3];

      // Skip if any required capture groups are missing
      if (!name || !inputJson || !expectedJson) {
        continue;
      }

      try {
        const input = JSON.parse(inputJson);
        const expected = JSON.parse(expectedJson);

        testCases.push({
          name,
          description: name,
          input,
          expected,
          type: 'orchestration'
        });
      } catch (error) {
        // Skip test cases with malformed JSON
        console.warn(`Skipping test case "${name}" due to malformed JSON:`, error);
        continue;
      }
    }

    return testCases;
  }

  /**
   * Generate test report
   */
  generateReport(results: TestResult[]): string {
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;
    const passRate = total > 0 ? (passed / total * 100).toFixed(2) : '0.00';

    const report = `
# Test Report

## Summary
- **Total Tests**: ${total}
- **Passed**: ${passed}
- **Failed**: ${failed}
- **Pass Rate**: ${passRate}%

## Details

${results
        .map(
          (result, i) => `
### Test ${i + 1}: ${result.testCase.name}
- **Status**: ${result.passed ? '✓ PASSED' : '✗ FAILED'}
- **Duration**: ${result.duration}ms
${result.error ? `- **Error**: ${result.error}` : ''}
${!result.passed
              ? `
- **Expected**:
\`\`\`json
${JSON.stringify(result.testCase.expected, null, 2)}
\`\`\`
- **Actual**:
\`\`\`json
${JSON.stringify(result.actual, null, 2)}
\`\`\`
`
              : ''
            }
`
        )
        .join('\n')}
    `;

    return report;
  }

  /**
   * Run tests and generate comprehensive report
   */
  async runAndReport(skill: Skill, suite: TestSuite): Promise<{
    results: TestResult[];
    report: string;
  }> {
    const results = await this.runSuite(skill, suite);
    const report = this.generateReport(results);

    return { results, report };
  }

  // Helper methods

  private createToolRegistry(): ToolRegistry {
    return {
      call: async (toolName: string, params: any) => {
        return await this.workspace.handleToolCall(toolName, params);
      },
      has: (toolName: string) => {
        return this.workspace
          .getAllTools()
          .some((t: { tool: { toolName: string; }; }) => t.tool.toolName === toolName);
      },
      get: (toolName: string) => {
        return this.workspace
          .getAllTools()
          .find((t: { tool: { toolName: string; }; }) => t.tool.toolName === toolName)?.tool;
      },
      list: () => {
        return this.workspace.getAllTools().map((t: { tool: any; }) => t.tool);
      }
    };
  }

  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Test timeout after ${timeout}ms`)),
          timeout
        )
      )
    ]);
  }

  private async runIntegrationTest(
    skill: Skill,
    testCase: TestCase,
    timeout: number
  ): Promise<any> {
    // Integration test implementation
    // This would require creating a temporary Agent and executing
    throw new Error('Integration test not fully implemented yet');
  }
}

export type { TestCase, TestSuite };
