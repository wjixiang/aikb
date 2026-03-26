/**
 * Monitor commands for agent-cli
 *
 * Commands for real-time monitoring of Agents and Runtime.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'readline';
import { log } from '../lib/logger.js';
import { formatOutput, formatDuration, type OutputFormat } from '../lib/formatter.js';

/**
 * Register monitor commands
 */
export function monitorCommands(program: Command): void {
  const monitorCmd = program
    .command('monitor')
    .description('实时监控');

  // ============================================================
  // monitor runtime
  // ============================================================
  monitorCmd
    .command('runtime')
    .description('监控 Runtime 状态')
    .option('-r, --refresh <ms>', '刷新间隔 (ms)', '1000')
    .option('-c, --compact', '紧凑模式')
    .option('--pid-file <file>', 'Runtime PID 文件', '.agent-runtime.pid')
    .action(async (options) => {
      await monitorRuntime(options);
    });

  // ============================================================
  // monitor agent
  // ============================================================
  monitorCmd
    .command('agent <instanceId>')
    .description('监控单个 Agent')
    .option('-r, --refresh <ms>', '刷新间隔 (ms)', '500')
    .option('--show-tasks', '显示任务详情', 'true')
    .option('--show-a2a', '显示 A2A 消息', 'true')
    .option('--pid-file <file>', 'Runtime PID 文件', '.agent-runtime.pid')
    .action(async (instanceId, options) => {
      await monitorAgent(instanceId, options);
    });

  // ============================================================
  // monitor a2a
  // ============================================================
  monitorCmd
    .command('a2a')
    .description('监控 A2A 通信')
    .option('-r, --refresh <ms>', '刷新间隔 (ms)', '500')
    .option('-f, --follow <conv-id>', '跟踪特定会话')
    .option('--show-all', '显示所有消息（包括已完成的）')
    .option('--pid-file <file>', 'Runtime PID 文件', '.agent-runtime.pid')
    .action(async (options) => {
      await monitorA2A(options);
    });

  // ============================================================
  // monitor logs
  // ============================================================
  monitorCmd
    .command('logs')
    .description('监控所有 Agent 日志')
    .option('-l, --level <level>', '日志级别过滤', 'info')
    .option('-a, --agent <id>', '特定 Agent')
    .option('-p, --pattern <pattern>', '正则过滤')
    .option('--pid-file <file>', 'Runtime PID 文件', '.agent-runtime.pid')
    .action(async (options) => {
      await monitorLogs(options);
    });
}

/**
 * Monitor runtime
 */
async function monitorRuntime(options: {
  refresh: string;
  compact: boolean;
  pidFile: string;
}): Promise<void> {
  const refreshInterval = parseInt(options.refresh);
  let running = true;

  // Handle Ctrl+C
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);

  process.stdin.once('keypress', (_str, key) => {
    if (key.ctrl && key.name === 'c') {
      running = false;
      console.log('\n' + chalk.yellow('Monitoring stopped'));
      process.exit(0);
    }
  });

  console.log('');
  console.log(
    chalk.bold('Agent Runtime Monitor') +
      chalk.gray(` [Refresh: ${refreshInterval}ms | Ctrl+C to exit]`),
  );
  console.log('');

  while (running) {
    // Clear screen (optional, for cleaner output)
    // console.clear();

    // Display header
    const timestamp = new Date().toISOString().substring(11, 19);
    console.log(chalk.gray('─'.repeat(80)));
    console.log(chalk.bold(`Last update: ${timestamp}`));
    console.log(chalk.gray('─'.repeat(80)));

    // TODO: Get actual runtime data
    // For now, display placeholder data
    displayRuntimePlaceholder(options.compact);

    // Wait before next refresh
    await new Promise((resolve) => setTimeout(resolve, refreshInterval));
  }
}

/**
 * Monitor agent
 */
async function monitorAgent(
  instanceId: string,
  options: {
    refresh: string;
    showTasks: string;
    showA2A: string;
    pidFile: string;
  },
): Promise<void> {
  const refreshInterval = parseInt(options.refresh);
  let running = true;

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);

  process.stdin.once('keypress', (_str, key) => {
    if (key.ctrl && key.name === 'c') {
      running = false;
      console.log('\n' + chalk.yellow('Monitoring stopped'));
      process.exit(0);
    }
  });

  console.log('');
  console.log(
    chalk.bold(`Agent Monitor: ${instanceId}`) +
      chalk.gray(` [Refresh: ${refreshInterval}ms | Ctrl+C to exit]`),
  );
  console.log('');

  while (running) {
    const timestamp = new Date().toISOString().substring(11, 19);
    console.log(chalk.gray('─'.repeat(80)));
    console.log(chalk.bold(`Last update: ${timestamp}`));
    console.log(chalk.gray('─'.repeat(80)));

    // TODO: Get actual agent data
    displayAgentPlaceholder(instanceId, options);

    await new Promise((resolve) => setTimeout(resolve, refreshInterval));
  }
}

/**
 * Monitor A2A communication
 */
async function monitorA2A(options: {
  refresh: string;
  follow?: string;
  showAll: boolean;
  pidFile: string;
}): Promise<void> {
  const refreshInterval = parseInt(options.refresh);
  let running = true;

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);

  process.stdin.once('keypress', (_str, key) => {
    if (key.ctrl && key.name === 'c') {
      running = false;
      console.log('\n' + chalk.yellow('Monitoring stopped'));
      process.exit(0);
    }
  });

  console.log('');
  console.log(
    chalk.bold('A2A Communication Monitor') +
      chalk.gray(` [Refresh: ${refreshInterval}ms | Ctrl+C to exit]`),
  );
  console.log('');

  if (options.follow) {
    console.log(chalk.gray('Following conversation: ') + chalk.cyan(options.follow));
  }

  while (running) {
    const timestamp = new Date().toISOString().substring(11, 19);
    console.log(chalk.gray('─'.repeat(80)));
    console.log(chalk.bold(`Last update: ${timestamp}`));
    console.log(chalk.gray('─'.repeat(80)));

    // TODO: Get actual A2A data
    displayA2APlaceholder(options);

    await new Promise((resolve) => setTimeout(resolve, refreshInterval));
  }
}

/**
 * Monitor logs
 */
async function monitorLogs(options: {
  level: string;
  agent?: string;
  pattern?: string;
  pidFile: string;
}): Promise<void> {
  let running = true;

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);

  process.stdin.once('keypress', (_str, key) => {
    if (key.ctrl && key.name === 'c') {
      running = false;
      console.log('\n' + chalk.yellow('Monitoring stopped'));
      process.exit(0);
    }
  });

  console.log('');
  console.log(
    chalk.bold('Log Monitor') + chalk.gray(' [Ctrl+C to exit]'),
  );
  console.log('');

  const filters: string[] = [];
  if (options.level) {
    filters.push(`level: ${options.level}`);
  }
  if (options.agent) {
    filters.push(`agent: ${options.agent}`);
  }
  if (options.pattern) {
    filters.push(`pattern: ${options.pattern}`);
  }

  if (filters.length > 0) {
    console.log(chalk.gray('Filters: ') + filters.join(', '));
    console.log('');
  }

  console.log(chalk.gray('─'.repeat(80)));

  // TODO: Stream actual logs
  console.log(chalk.gray('Waiting for logs...'));
  console.log('');

  // Simulate some logs for demo
  let count = 0;
  while (running && count < 10) {
    const timestamp = new Date().toISOString().substring(11, 19);
    const level = ['info', 'debug', 'warn'][Math.floor(Math.random() * 3)];
    const levelColor =
      level === 'info'
        ? chalk.green
        : level === 'warn'
          ? chalk.yellow
          : chalk.gray;

    console.log(
      `${chalk.gray(timestamp)} ${levelColor(level.padEnd(5))} ${chalk.cyan('[agent-xyz]')} Sample log message ${count + 1}`,
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));
    count++;
  }

  if (running) {
    console.log('');
    console.log(chalk.yellow('End of demo logs'));
  }
}

/**
 * Display placeholder runtime data
 */
function displayRuntimePlaceholder(compact: boolean): void {
  if (compact) {
    console.log(
      `${chalk.bold('Status:')} ${chalk.green('Running')} │ ${chalk.bold('Agents:')} 6 │ ${chalk.bold('Uptime:')} ${formatDuration(900000)}`,
    );
    return;
  }

  console.log('');
  console.log(chalk.bold('Runtime Status'));
  console.log(`  Status:    ${chalk.green('Running')}`);
  console.log(`  Uptime:    ${formatDuration(900000)}`);
  console.log(`  MessageBus: ${chalk.cyan('memory')}`);
  console.log(`  Max Agents: ${chalk.cyan('10')}`);
  console.log('');

  console.log(chalk.bold('Agents (6)'));
  console.log(
    `  ${chalk.green('●')} ${chalk.cyan('epidemiology-abc')}    │ ${chalk.yellow('○')} ${chalk.cyan('diagnosis-def')}`,
  );
  console.log(
    `  ${chalk.green('●')} ${chalk.cyan('pathophysiology-ghi')} │ ${chalk.yellow('○')} ${chalk.cyan('management-jkl')}`,
  );
  console.log(
    `  ${chalk.green('●')} ${chalk.cyan('quality-mno')}        │ ${chalk.yellow('○')} ${chalk.cyan('emerging-pqr')}`,
  );
  console.log('');

  console.log(chalk.bold('Statistics'));
  console.log(`  Total Tasks:     ${chalk.cyan('235')}`);
  console.log(`  Completed:       ${chalk.green('220')} (93.6%)`);
  console.log(`  Failed:          ${chalk.red('10')} (4.3%)`);
  console.log(`  Pending:         ${chalk.yellow('5')} (2.1%)`);
  console.log(`  Avg Duration:    ${chalk.cyan('2.3s')}`);
  console.log('');
}

/**
 * Display placeholder agent data
 */
function displayAgentPlaceholder(instanceId: string, options: any): void {
  console.log('');
  console.log(chalk.bold('Agent Status'));
  console.log(`  Instance ID:  ${chalk.cyan(instanceId)}`);
  console.log(`  Name:         ${chalk.cyan('Epidemiology Agent')}`);
  console.log(`  Type:         ${chalk.cyan('literature')}`);
  console.log(`  Status:       ${chalk.green('●') + ' ' + chalk.green('Running')}`);
  console.log(`  Created:      ${chalk.gray('15m ago')}`);
  console.log(`  Last Active:  ${chalk.gray('5s ago')}`);
  console.log('');

  if (options.showTasks === 'true') {
    console.log(chalk.bold('Recent Tasks'));
    console.log(`  ${chalk.cyan('task-001')}  │ ${chalk.green('completed')} │ ${chalk.gray('2s ago')}`);
    console.log(`  ${chalk.cyan('task-002')}  │ ${chalk.yellow('processing')} │ ${chalk.gray('5s ago')}`);
    console.log(`  ${chalk.cyan('task-003')}  │ ${chalk.green('completed')} │ ${chalk.gray('12s ago')}`);
    console.log('');
  }

  if (options.showA2A === 'true') {
    console.log(chalk.bold('A2A Messages'));
    console.log(`  ${chalk.gray('→')} Received:  ${chalk.cyan('15')} messages`);
    console.log(`  ${chalk.gray('←')} Sent:      ${chalk.cyan('8')} messages`);
    console.log(`  ${chalk.gray('⇄')} Active:    ${chalk.yellow('3')} conversations`);
    console.log('');
  }
}

/**
 * Display placeholder A2A data
 */
function displayA2APlaceholder(options: {
  follow?: string;
  showAll: boolean;
}): void {
  console.log('');
  console.log(chalk.bold('A2A Statistics'));
  console.log(`  Total Conversations:  ${chalk.cyan('42')}`);
  console.log(`  Active:              ${chalk.yellow('3')}`);
  console.log(`  Completed:           ${chalk.green('35')}`);
  console.log(`  Failed:              ${chalk.red('4')}`);
  console.log('');

  console.log(chalk.bold('Active Conversations'));
  console.log(
    `  ${chalk.cyan('conv-abc-123')} │ ${chalk.cyan('epidemiology')} → ${chalk.cyan('diagnosis')} │ ${chalk.yellow('processing')}`,
  );
  console.log(
    `  ${chalk.cyan('conv-def-456')} │ ${chalk.cyan('pathophysiology')} → ${chalk.cyan('management')} │ ${chalk.yellow('acknowledged')}`,
  );
  console.log(
    `  ${chalk.cyan('conv-ghi-789')} │ ${chalk.cyan('quality')} → ${chalk.cyan('emerging')} │ ${chalk.yellow('pending')}`,
  );
  console.log('');

  if (!options.showAll) {
    console.log(chalk.gray('Use --show-all to view all conversations'));
  }
}
