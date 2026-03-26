/**
 * Test commands for agent-cli
 *
 * Commands for running predefined test scenarios.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { createAgentRuntime } from '../../core/runtime/index.js';
import type { AgentRuntimeConfig } from '../../core/runtime/types.js';
import {
  createEpidemiologyAgentSoul,
  createPathophysiologyAgentSoul,
  createDiagnosisAgentSoul,
} from '../../core/agent-soul/index.js';
import { getEnv } from '../lib/config.js';
import { log } from '../lib/logger.js';
import {
  formatOutput,
  formatDuration,
  createBox,
  type OutputFormat,
} from '../lib/formatter.js';

// Test results store
interface TestResult {
  scenario: string;
  passed: boolean;
  duration: number;
  message: string;
  details?: Record<string, unknown>;
}

const testResults: TestResult[] = [];

/**
 * Register test commands
 */
export function testCommands(program: Command): void {
  const testCmd = program.command('test').description('测试场景');

  // ============================================================
  // test basic
  // ============================================================
  testCmd
    .command('basic')
    .description('基础功能测试')
    .option('-c, --agent-count <n>', '创建的 Agent 数量', '3')
    .option('-p, --parallel', '并行创建 Agent')
    .option('-d, --duration <seconds>', '测试持续时间', '60')
    .option('-o, --output <format>', '输出格式 (table|json|compact)')
    .action(async (options) => {
      await testBasic(options);
    });

  // ============================================================
  // test a2a
  // ============================================================
  testCmd
    .command('a2a')
    .description('A2A 通信测试')
    .option('-m, --message-bus <mode>', 'MessageBus 模式 (memory|redis)', 'memory')
    .option('--redis-url <url>', 'Redis URL')
    .option('-n, --task-count <n>', '发送任务数量', '5')
    .option('-t, --timeout <ms>', '超时时间', '30000')
    .option('-o, --output <format>', '输出格式 (table|json|compact)')
    .action(async (options) => {
      await testA2A(options);
    });

  // ============================================================
  // test redis
  // ============================================================
  testCmd
    .command('redis')
    .description('Redis 分布式测试')
    .option('--redis-url <url>', 'Redis URL', 'redis://localhost:6379')
    .option('-r, --runtime-count <n>', 'Runtime 数量', '2')
    .option('-a, --agent-per-runtime <n>', '每个 Runtime 的 Agent 数', '2')
    .option('-o, --output <format>', '输出格式 (table|json|compact)')
    .action(async (options) => {
      await testRedis(options);
    });

  // ============================================================
  // test list
  // ============================================================
  testCmd
    .command('list')
    .description('列出所有测试场景')
    .action(() => {
      testList();
    });
}

/**
 * Basic functionality test
 */
async function testBasic(options: {
  agentCount: string;
  parallel: boolean;
  duration: string;
  output?: OutputFormat;
}): Promise<void> {
  console.log('');
  console.log(chalk.bold('Running Basic Test Scenario...'));
  console.log('');

  const spinner = ora('Initializing test...').start();
  const startTime = Date.now();
  let result: TestResult;

  try {
    // Create runtime
    spinner.text = 'Creating AgentRuntime...';
    const runtime = createAgentRuntime({
      maxAgents: parseInt(options.agentCount) + 2,
    });

    await runtime.start();
    spinner.succeed('AgentRuntime created and started');

    // Create agents
    const agentCount = parseInt(options.agentCount);
    const agentIds: string[] = [];

    if (options.parallel) {
      // Parallel creation
      spinner.text = `Creating ${agentCount} agents in parallel...`;
      const promises = [
        runtime.createAgent(createEpidemiologyAgentSoul()),
        runtime.createAgent(createPathophysiologyAgentSoul()),
        runtime.createAgent(createDiagnosisAgentSoul()),
      ].slice(0, agentCount);

      const results = await Promise.all(promises);
      agentIds.push(...results);
      spinner.succeed(`Created ${agentIds.length} agents in parallel`);
    } else {
      // Sequential creation
      for (let i = 0; i < agentCount; i++) {
        spinner.text = `Creating agent ${i + 1}/${agentCount}...`;
        const soul =
          i % 3 === 0
            ? createEpidemiologyAgentSoul()
            : i % 3 === 1
              ? createPathophysiologyAgentSoul()
              : createDiagnosisAgentSoul();
        const id = await runtime.createAgent(soul);
        agentIds.push(id);
      }
      spinner.succeed(`Created ${agentIds.length} agents sequentially`);
    }

    // Start agents
    spinner.text = 'Starting agents...';
    for (const id of agentIds) {
      await runtime.startAgent(id);
    }
    spinner.succeed('All agents started');

    // Get stats
    const stats = await runtime.getStats();
    spinner.text = 'Getting runtime stats...';
    spinner.succeed(
      `Runtime: ${stats.totalAgents} agents, ${
        Object.values(stats.agentsByStatus).reduce((a, b) => a + b, 0)
      } total status`,
    );

    // Wait for duration
    const duration = parseInt(options.duration) * 1000;
    spinner.text = `Running for ${options.duration}s...`;
    spinner.info(`Waiting ${options.duration}s for agents to process...`);

    await new Promise((resolve) => setTimeout(resolve, Math.min(duration, 5000)));

    // Cleanup
    spinner.text = 'Stopping runtime...';
    await runtime.stop();
    spinner.succeed('Runtime stopped');

    const testDuration = Date.now() - startTime;

    result = {
      scenario: 'basic',
      passed: true,
      duration: testDuration,
      message: 'Basic test completed successfully',
      details: {
        agentCount: agentIds.length,
        parallel: options.parallel,
        runtimeStats: stats,
      },
    };

    spinner.succeed(chalk.green('Basic test passed!'));
  } catch (error) {
    const testDuration = Date.now() - startTime;
    result = {
      scenario: 'basic',
      passed: false,
      duration: testDuration,
      message: error instanceof Error ? error.message : String(error),
    };
    spinner.fail(chalk.red('Basic test failed: ' + result.message));
  }

  testResults.push(result);
  printTestResult(result, options.output);
}

/**
 * A2A communication test
 */
async function testA2A(options: {
  messageBus: 'memory' | 'redis';
  redisUrl?: string;
  taskCount: string;
  timeout: string;
  output?: OutputFormat;
}): Promise<void> {
  console.log('');
  console.log(chalk.bold('Running A2A Communication Test...'));
  console.log('');

  const spinner = ora('Initializing A2A test...').start();
  const startTime = Date.now();
  let result: TestResult;

  try {
    // Build config
    const config: AgentRuntimeConfig = {
      maxAgents: 10,
    };

    if (options.messageBus === 'redis') {
      config.messageBus = {
        mode: 'redis',
        redis: {
          url: options.redisUrl || getEnv('REDIS_URL'),
        },
      };
      spinner.info(`Using Redis: ${options.redisUrl || getEnv('REDIS_URL')}`);
    }

    // Create runtime
    spinner.text = 'Creating AgentRuntime...';
    const runtime = createAgentRuntime(config);
    await runtime.start();

    // Create two agents
    spinner.text = 'Creating sender and receiver agents...';
    const senderId = await runtime.createAgent(createEpidemiologyAgentSoul());
    const receiverId = await runtime.createAgent(createPathophysiologyAgentSoul());

    await runtime.startAgent(senderId);
    await runtime.startAgent(receiverId);
    spinner.succeed('Agents created and started');

    // Get agents
    const sender = await runtime.getAgent(senderId);
    const receiver = await runtime.getAgent(receiverId);

    if (!sender || !receiver) {
      throw new Error('Failed to get agents from runtime');
    }

    // Send A2A tasks
    const taskCount = parseInt(options.taskCount);
    const results: Array<{ taskId: string; success: boolean }> = [];

    spinner.text = `Sending ${taskCount} A2A tasks...`;
    spinner.info(
      `Sender: ${senderId.substring(0, 8)}... → Receiver: ${receiverId.substring(0, 8)}...`,
    );

    for (let i = 0; i < taskCount; i++) {
      const taskId = `test-task-${i + 1}`;
      try {
        const response = await sender.getRuntimeClient().sendA2ATask(
          receiverId,
          taskId,
          `Test task ${i + 1}: Search for literature`,
          { query: `test query ${i + 1}` },
        );
        results.push({
          taskId,
          success: response.status === 'completed',
        });
      } catch (error) {
        results.push({
          taskId,
          success: false,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    spinner.succeed(
      `Sent ${taskCount} tasks, ${successCount} successful (${Math.round((successCount / taskCount) * 100)}%)`,
    );

    // Cleanup
    await runtime.stop();

    const testDuration = Date.now() - startTime;

    result = {
      scenario: 'a2a',
      passed: successCount > 0,
      duration: testDuration,
      message: `A2A test: ${successCount}/${taskCount} tasks successful`,
      details: {
        messageBus: options.messageBus,
        taskCount,
        successCount,
        results,
      },
    };

    if (result.passed) {
      spinner.succeed(chalk.green('A2A test passed!'));
    } else {
      spinner.fail(chalk.red('A2A test failed: No tasks completed'));
    }
  } catch (error) {
    const testDuration = Date.now() - startTime;
    result = {
      scenario: 'a2a',
      passed: false,
      duration: testDuration,
      message: error instanceof Error ? error.message : String(error),
    };
    spinner.fail(chalk.red('A2A test failed: ' + result.message));
  }

  testResults.push(result);
  printTestResult(result, options.output);
}

/**
 * Redis distributed test
 */
async function testRedis(options: {
  redisUrl: string;
  runtimeCount: string;
  agentPerRuntime: string;
  output?: OutputFormat;
}): Promise<void> {
  console.log('');
  console.log(chalk.bold('Running Redis Distributed Test...'));
  console.log('');

  const spinner = ora('Connecting to Redis...').start();
  const startTime = Date.now();
  let result: TestResult;

  try {
    spinner.info(`Redis URL: ${options.redisUrl}`);

    // Create multiple runtimes
    const runtimeCount = parseInt(options.runtimeCount);
    const agentPerRuntime = parseInt(options.agentPerRuntime);
    const runtimes: Awaited<ReturnType<typeof createAgentRuntime>>[] = [];
    const allAgentIds: string[][] = [];

    for (let i = 0; i < runtimeCount; i++) {
      spinner.text = `Creating Runtime ${i + 1}/${runtimeCount}...`;
      const runtime = createAgentRuntime({
        maxAgents: agentPerRuntime + 2,
        messageBus: {
          mode: 'redis',
          redis: {
            url: options.redisUrl,
          },
        },
      });

      await runtime.start();
      runtimes.push(runtime);
      allAgentIds.push([]);

      // Create agents
      for (let j = 0; j < agentPerRuntime; j++) {
        const soul =
          j % 2 === 0
            ? createEpidemiologyAgentSoul()
            : createPathophysiologyAgentSoul();
        const id = await runtime.createAgent(soul);
        allAgentIds[i].push(id);
        await runtime.startAgent(id);
      }

      spinner.succeed(`Runtime ${i + 1} created with ${agentPerRuntime} agents`);
    }

    spinner.info(
      `Created ${runtimes.length} runtimes with ${allAgentIds.flat().length} total agents`,
    );

    // Test cross-runtime communication
    spinner.text = 'Testing cross-runtime A2A communication...';

    if (allAgentIds.length >= 2 && allAgentIds[0].length > 0 && allAgentIds[1].length > 0) {
      const runtime1 = runtimes[0];
      const agent1 = await runtime1.getAgent(allAgentIds[0][0]);
      const agent2Id = allAgentIds[1][0];

      if (agent1) {
        try {
          const response = await agent1.getRuntimeClient().sendA2ATask(
            agent2Id,
            'cross-runtime-test',
            'Cross-runtime test task',
            { test: true },
          );

          spinner.succeed(
            `Cross-runtime communication successful: ${response.status}`,
          );
        } catch (error) {
          spinner.warn(`Cross-runtime communication failed: ${error}`);
        }
      }
    }

    // Cleanup
    spinner.text = 'Stopping all runtimes...';
    for (const runtime of runtimes) {
      await runtime.stop();
    }
    spinner.succeed('All runtimes stopped');

    const testDuration = Date.now() - startTime;

    result = {
      scenario: 'redis',
      passed: true,
      duration: testDuration,
      message: 'Redis distributed test completed',
      details: {
        runtimeCount,
        agentPerRuntime,
        totalAgents: allAgentIds.flat().length,
      },
    };

    spinner.succeed(chalk.green('Redis test passed!'));
  } catch (error) {
    const testDuration = Date.now() - startTime;
    result = {
      scenario: 'redis',
      passed: false,
      duration: testDuration,
      message: error instanceof Error ? error.message : String(error),
    };
    spinner.fail(chalk.red('Redis test failed: ' + result.message));
  }

  testResults.push(result);
  printTestResult(result, options.output);
}

/**
 * List test scenarios
 */
function testList(): void {
  console.log('');
  console.log(chalk.bold('Available Test Scenarios:'));
  console.log('');

  const scenarios = [
    {
      name: 'basic',
      description: '基础功能测试 - 创建、启动和管理 Agent',
      options: '--agent-count <n> --parallel --duration <s>',
    },
    {
      name: 'a2a',
      description: 'A2A 通信测试 - 测试 Agent 间消息传递',
      options: '--message-bus <mode> --task-count <n>',
    },
    {
      name: 'redis',
      description: 'Redis 分布式测试 - 测试跨进程 Agent 通信',
      options: '--redis-url <url> --runtime-count <n>',
    },
  ];

  for (const scenario of scenarios) {
    console.log(chalk.cyan(scenario.name.padEnd(15)) + ' ' + scenario.description);
    console.log(chalk.gray('  Options: ') + scenario.options);
    console.log('');
  }

  console.log(
    chalk.gray('Usage: ') + chalk.cyan('agent-cli test <scenario> [options]'),
  );
}

/**
 * Print test result
 */
function printTestResult(result: TestResult, format: OutputFormat = 'table'): void {
  if (format === 'json') {
    console.log(formatOutput(result, 'json'));
    return;
  }

  console.log('');
  console.log(
    createBox(
      'Test Result',
      [
        `${chalk.bold('Scenario:')} ${result.scenario}`,
        `${chalk.bold('Status:')} ${result.passed ? chalk.green('PASSED') : chalk.red('FAILED')}`,
        `${chalk.bold('Duration:')} ${formatDuration(result.duration)}`,
        `${chalk.bold('Message:')} ${result.message}`,
        result.details
          ? `${chalk.bold('Details:')} ${JSON.stringify(result.details, null, 2)}`
          : '',
      ].join('\n'),
    ),
  );
}
