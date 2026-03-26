/**
 * A2A commands for agent-cli
 *
 * Commands for A2A communication testing.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { log } from '../lib/logger.js';
import { formatOutput, type OutputFormat } from '../lib/formatter.js';

/**
 * Register A2A commands
 */
export function a2aCommands(program: Command): void {
  const a2aCmd = program.command('a2a').description('A2A 通信测试');

  // ============================================================
  // a2a send-task
  // ============================================================
  a2aCmd
    .command('send-task <target-agent> <description>')
    .description('发送 A2A 任务到指定 Agent')
    .option('-i, --task-id <id>', '任务 ID', 'auto')
    .option('--input <json>', '输入数据 (JSON)', '{}')
    .option('-p, --priority <level>', '优先级 (low|normal|high|urgent)', 'normal')
    .option('-t, --timeout <ms>', '超时时间', '60000')
    .option('-o, --output <format>', '输出格式 (table|json|compact)')
    .option('--pid-file <file>', 'Runtime PID 文件', '.agent-runtime.pid')
    .action(async (targetAgent, description, options) => {
      await a2aSendTask(targetAgent, description, options);
    });

  // ============================================================
  // a2a send-query
  // ============================================================
  a2aCmd
    .command('send-query <target-agent> <query>')
    .description('发送 A2A 查询到指定 Agent')
    .option('-f, --format <format>', '期望的响应格式')
    .option('-t, --timeout <ms>', '超时时间', '30000')
    .option('-o, --output <format>', '输出格式 (table|json|compact)')
    .option('--pid-file <file>', 'Runtime PID 文件', '.agent-runtime.pid')
    .action(async (targetAgent, query, options) => {
      await a2aSendQuery(targetAgent, query, options);
    });

  // ============================================================
  // a2a send-event
  // ============================================================
  a2aCmd
    .command('send-event <target-agent> <event-type>')
    .description('发送 A2A 事件到指定 Agent')
    .option('-d, --data <json>', '事件数据 (JSON)', '{}')
    .option('-o, --output <format>', '输出格式 (table|json|compact)')
    .option('--pid-file <file>', 'Runtime PID 文件', '.agent-runtime.pid')
    .action(async (targetAgent, eventType, options) => {
      await a2aSendEvent(targetAgent, eventType, options);
    });

  // ============================================================
  // a2a conversations
  // ============================================================
  a2aCmd
    .command('conversations')
    .description('查看 A2A 会话列表')
    .option('-s, --status <status>', '过滤状态')
    .option('-a, --active-only', '仅显示活跃会话')
    .option('-o, --output <format>', '输出格式 (table|json|compact)')
    .option('--pid-file <file>', 'Runtime PID 文件', '.agent-runtime.pid')
    .action(async (options) => {
      await a2aConversations(options);
    });
}

/**
 * Send A2A task
 */
async function a2aSendTask(
  targetAgent: string,
  description: string,
  options: {
    taskId: string;
    input: string;
    priority: string;
    timeout: string;
    output?: OutputFormat;
    pidFile: string;
  },
): Promise<void> {
  log.info(`Sending A2A task to ${targetAgent}...`);

  // Parse input JSON
  let input: Record<string, unknown>;
  try {
    input = JSON.parse(options.input);
  } catch {
    console.error(chalk.red('Error: Invalid JSON in --input'));
    process.exit(1);
  }

  // Validate priority
  const validPriorities = ['low', 'normal', 'high', 'urgent'];
  if (!validPriorities.includes(options.priority)) {
    console.error(chalk.red(`Error: Invalid priority "${options.priority}"`));
    console.error(
      chalk.gray('Valid priorities: ') + validPriorities.join(', '),
    );
    process.exit(1);
  }

  // TODO: Implement actual A2A task sending
  // For now, display what would be sent
  const taskData = {
    targetAgent,
    taskId: options.taskId === 'auto' ? `task-${Date.now()}` : options.taskId,
    description,
    input,
    priority: options.priority,
    timeout: parseInt(options.timeout),
  };

  console.log('');
  console.log(chalk.bold('A2A Task:'));
  console.log(formatOutput(taskData, options.output || 'table'));
  console.log('');
  console.log(chalk.gray('Note: Actual A2A sending requires runtime integration'));
}

/**
 * Send A2A query
 */
async function a2aSendQuery(
  targetAgent: string,
  query: string,
  options: {
    format?: string;
    timeout: string;
    output?: OutputFormat;
    pidFile: string;
  },
): Promise<void> {
  log.info(`Sending A2A query to ${targetAgent}...`);

  const queryData = {
    targetAgent,
    query,
    expectedFormat: options.format,
    timeout: parseInt(options.timeout),
  };

  console.log('');
  console.log(chalk.bold('A2A Query:'));
  console.log(formatOutput(queryData, options.output || 'table'));
  console.log('');
  console.log(chalk.gray('Note: Actual A2A sending requires runtime integration'));
}

/**
 * Send A2A event
 */
async function a2aSendEvent(
  targetAgent: string,
  eventType: string,
  options: {
    data: string;
    output?: OutputFormat;
    pidFile: string;
  },
): Promise<void> {
  log.info(`Sending A2A event to ${targetAgent}...`);

  // Parse data JSON
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(options.data);
  } catch {
    console.error(chalk.red('Error: Invalid JSON in --data'));
    process.exit(1);
  }

  const eventData = {
    targetAgent,
    eventType,
    data,
  };

  console.log('');
  console.log(chalk.bold('A2A Event (fire-and-forget):'));
  console.log(formatOutput(eventData, options.output || 'table'));
  console.log('');
  console.log(chalk.gray('Note: Actual A2A sending requires runtime integration'));
}

/**
 * List A2A conversations
 */
async function a2aConversations(options: {
  status?: string;
  activeOnly: boolean;
  output?: OutputFormat;
  pidFile: string;
}): Promise<void> {
  // TODO: Get actual conversations from runtime
  const conversations = [
    {
      conversationId: 'conv-abc-123',
      from: 'epidemiology-xyz',
      to: 'diagnosis-abc',
      status: 'processing',
      createdAt: new Date(Date.now() - 5000),
      messageType: 'task',
    },
    {
      conversationId: 'conv-def-456',
      from: 'pathophysiology-def',
      to: 'management-ghi',
      status: 'acknowledged',
      createdAt: new Date(Date.now() - 15000),
      messageType: 'task',
    },
    {
      conversationId: 'conv-ghi-789',
      from: 'quality-jkl',
      to: 'emerging-mno',
      status: 'pending',
      createdAt: new Date(Date.now() - 30000),
      messageType: 'task',
    },
  ];

  // Filter
  let filtered = conversations;
  if (options.status) {
    filtered = filtered.filter((c) => c.status === options.status);
  }
  if (options.activeOnly) {
    filtered = filtered.filter(
      (c) => !['completed', 'failed', 'timeout'].includes(c.status),
    );
  }

  console.log('');
  console.log(chalk.bold(`A2A Conversations (${filtered.length}):`));
  console.log('');

  if (options.output === 'json') {
    console.log(formatOutput(filtered, 'json'));
    return;
  }

  if (filtered.length === 0) {
    console.log(chalk.gray('No conversations found'));
    return;
  }

  for (const conv of filtered) {
    const statusColor =
      conv.status === 'completed'
        ? chalk.green
        : conv.status === 'failed'
          ? chalk.red
          : conv.status === 'processing'
            ? chalk.yellow
            : chalk.gray;

    const timeAgo = Math.floor((Date.now() - conv.createdAt.getTime()) / 1000);
    const timeStr =
      timeAgo < 60
        ? `${timeAgo}s ago`
        : timeAgo < 3600
          ? `${Math.floor(timeAgo / 60)}m ago`
          : `${Math.floor(timeAgo / 3600)}h ago`;

    console.log(
      `  ${chalk.cyan(conv.conversationId)} │ ${statusColor(conv.status.padEnd(12))} │ ${timeStr}`,
    );
    console.log(
      `    ${chalk.gray(conv.from)} → ${chalk.gray(conv.to)} │ ${chalk.gray(conv.messageType)}`,
    );
    console.log('');
  }
}
