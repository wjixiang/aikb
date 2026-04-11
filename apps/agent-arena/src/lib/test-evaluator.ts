import type { TestCaseExpectation, AgentRunResult } from '../types.js';

/**
 * TestEvaluator — compares agent run results against test expectations.
 */
export class TestEvaluator {
  evaluate(expect: TestCaseExpectation, result: AgentRunResult): string[] {
    const failures: string[] = [];

    if (expect.toolCalls) {
      for (const expected of expect.toolCalls) {
        const found = result.toolCalls.find((tc) => tc.name === expected.name);
        if (!found) {
          failures.push(
            `Expected tool call "${expected.name}" but it was not executed. ` +
              `Actual: [${result.toolCalls.map((tc) => tc.name).join(', ')}]`,
          );
          continue;
        }
        if (expected.arguments) {
          for (const [key, value] of Object.entries(expected.arguments)) {
            const actual = found.arguments[key];
            if (JSON.stringify(actual) !== JSON.stringify(value)) {
              failures.push(
                `Tool "${expected.name}" arg "${key}": expected ${JSON.stringify(value)}, got ${JSON.stringify(actual)}`,
              );
            }
          }
        }
      }
    }

    if (expect.textContains) {
      const allText = result.messages
        .filter((m) => m.role === 'assistant')
        .map((m) => m.content)
        .join('\n');
      if (!allText.includes(expect.textContains)) {
        failures.push(
          `Expected text to contain "${expect.textContains}" but not found in assistant messages`,
        );
      }
    }

    if (expect.status) {
      const statusMap: Record<string, string> = {
        completed: 'sleeping',
        aborted: 'aborted',
        error: 'aborted',
      };
      const expectedStatus = statusMap[expect.status] ?? expect.status;
      if (result.status !== expectedStatus) {
        failures.push(
          `Expected status "${expectedStatus}" but got "${result.status}"`,
        );
      }
    }

    if (expect.maxRounds !== undefined) {
      if (result.llmCalls > expect.maxRounds) {
        failures.push(
          `Expected max ${expect.maxRounds} LLM rounds but got ${result.llmCalls}`,
        );
      }
    }

    return failures;
  }
}
