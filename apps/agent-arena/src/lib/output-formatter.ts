import chalk from 'chalk';
import Table from 'cli-table3';
import type { AgentRunResult, TestSuiteResult } from '../types.js';

export function formatRunResult(result: AgentRunResult, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('');
  console.log(chalk.bold('Agent Run Result'));
  console.log(chalk.gray('─'.repeat(50)));

  const statusColor =
    result.status === 'sleeping'
      ? chalk.green
      : result.status === 'aborted'
        ? chalk.red
        : chalk.yellow;
  console.log(`  Status:    ${statusColor(result.status)}`);
  console.log(`  Duration:  ${result.duration}ms`);
  console.log(`  LLM Calls: ${result.llmCalls}`);
  console.log(
    `  Tokens:    ${result.tokenUsage.totalTokens} (prompt: ${result.tokenUsage.promptTokens}, completion: ${result.tokenUsage.completionTokens})`,
  );

  if (result.error) {
    console.log(`  Error:     ${chalk.red(result.error)}`);
  }

  if (result.toolCalls.length > 0) {
    console.log('');
    console.log(chalk.bold('  Tool Calls:'));
    const table = new Table({
      head: ['#', 'Tool', 'Success', 'Arguments'],
      style: { head: ['cyan'] },
      wordWrap: true,
    });
    result.toolCalls.forEach((tc, i) => {
      table.push([
        String(i + 1),
        tc.name,
        tc.success ? chalk.green('OK') : chalk.red('FAIL'),
        JSON.stringify(tc.arguments),
      ]);
    });
    console.log(table.toString());
  }

  if (result.messages.length > 0) {
    console.log('');
    console.log(chalk.bold('  Messages:'));
    for (const msg of result.messages) {
      const prefix =
        msg.role === 'user'
          ? chalk.blue('  [user]')
          : msg.role === 'assistant'
            ? chalk.green('  [assistant]')
            : chalk.gray(`  [${msg.role}]`);
      console.log(`${prefix} ${msg.content}`);
    }
  }

  console.log('');
}

export function formatTestSuiteResult(
  result: TestSuiteResult,
  json: boolean,
): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const allPassed = result.failed === 0;
  const status = allPassed
    ? chalk.green.bold('PASS')
    : chalk.red.bold('FAIL');

  console.log('');
  console.log(`${status}  ${result.suiteName}`);
  console.log(
    chalk.gray(
      `     Agent: ${result.agentToken} | ${result.passed}/${result.total} passed | ${result.duration}ms`,
    ),
  );
  console.log('');

  for (const r of result.results) {
    const icon = r.passed ? chalk.green('  ✓') : chalk.red('  ✗');
    const time = chalk.gray(`(${r.duration}ms)`);
    console.log(`${icon}  ${r.testCase.name}  ${time}`);
    if (!r.passed) {
      for (const failure of r.failures) {
        console.log(chalk.red(`       → ${failure}`));
      }
    }
  }

  console.log('');
}
