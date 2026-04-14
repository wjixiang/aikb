/**
 * Runtime commands for agent-cli
 *
 * Commands for managing AgentRuntime instances.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { ClientPool } from 'llm-api-client';
import { createAgentRuntime } from '../../core/runtime/index.js';
import type { AgentRuntimeConfig } from '../../core/runtime/types.js';
import { PostgresPersistenceService } from '../../core/persistence/PostgresPersistenceService.js';
import { getApiKey, getEnv } from '../lib/config.js';
import { log } from '../lib/logger.js';
import {
  formatOutput,
  formatStats,
  formatDuration,
  createBox,
  type OutputFormat,
} from '../lib/formatter.js';
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';
import { resolve } from 'path';

const DEFAULT_PID_FILE = '.agent-runtime.pid';
const DEFAULT_RUNTIME_PORT = 9400;

// Runtime instance store (for non-detached mode)
const runtimes = new Map<
  string,
  Awaited<ReturnType<typeof createAgentRuntime>>
>();

/**
 * Register runtime commands
 */
export function runtimeCommands(program: Command): void {
  const runtimeCmd = program.command('runtime').description('Runtime 管理');

  // ============================================================
  // runtime start
  // ============================================================
  runtimeCmd
    .command('start')
    .description('启动 Agent Runtime')
    .option('-m, --message-bus <mode>', '消息总线模式', 'memory')
    .option('--message-bus <mode>', 'MessageBus 模式 (memory|redis)', 'memory')
    .option('--redis-url <url>', 'Redis 连接 URL', getEnv('REDIS_URL'))
    .option('--redis-host <host>', 'Redis 主机', 'localhost')
    .option('--redis-port <port>', 'Redis 端口', '6379')
    .option('--api-key <key>', 'API 密钥', getEnv('OPENAI_API_KEY'))
    .option('--api-url <url>', 'API 基础 URL')
    .option('--api-model <model>', '模型 ID')
    .option('-d, --detach', '后台运行')
    .option('--pid-file <file>', 'PID 文件路径', DEFAULT_PID_FILE)
    .option('--port <port>', 'Runtime API 端口', String(DEFAULT_RUNTIME_PORT))
    .action(async (options) => {
      try {
        await runtimeStart(options);
      } catch (error) {
        log.error('Failed to start runtime:', error);
        throw error;
      }
    });

  // ============================================================
  // runtime stop
  // ============================================================
  runtimeCmd
    .command('stop')
    .description('停止 Agent Runtime')
    .option('--pid-file <file>', 'PID 文件路径', DEFAULT_PID_FILE)
    .option('-f, --force', '强制停止')
    .action(async (options) => {
      try {
        await runtimeStop(options);
      } catch (error) {
        log.error('Failed to stop runtime:', error);
        throw error;
      }
    });

  // ============================================================
  // runtime status
  // ============================================================
  runtimeCmd
    .command('status')
    .description('查看 Runtime 状态')
    .option('--pid-file <file>', 'PID 文件路径', DEFAULT_PID_FILE)
    .option('-o, --output <format>', '输出格式 (table|json|compact)')
    .action(async (options) => {
      try {
        await runtimeStatus(options);
      } catch (error) {
        log.error('Failed to get runtime status:', error);
        throw error;
      }
    });

  // ============================================================
  // runtime list
  // ============================================================
  runtimeCmd
    .command('list')
    .description('列出所有运行中的 Runtime')
    .option('-o, --output <format>', '输出格式 (table|json|compact)')
    .action(async (options) => {
      await runtimeList(options);
    });
}

/**
 * Start runtime
 */
async function runtimeStart(options: {
  messageBus: 'memory' | 'redis';
  redisUrl?: string;
  redisHost?: string;
  redisPort?: string;
  apiKey?: string;
  apiUrl?: string;
  apiModel?: string;
  detach: boolean;
  pidFile: string;
  port: string;
}): Promise<void> {
  log.info('Starting Agent Runtime...');

  // Check if already running
  const pidFile = resolve(options.pidFile);
  if (existsSync(pidFile)) {
    const pid = parseInt(readFileSync(pidFile, 'utf-8'));
    if (isProcessRunning(pid)) {
      console.log(chalk.yellow(`Runtime is already running (PID: ${pid})`));
      return;
    }
    // Stale PID file, remove it
    unlinkSync(pidFile);
  }

  // Build config
  const config: AgentRuntimeConfig = {};

  // Configure message bus
  if (options.messageBus === 'redis') {
    log.warn('Redis message bus is deprecated, using in-memory message bus');
  }
  config.messageBus = {
    mode: 'memory',
  };
  log.info('Using in-memory message bus');

  // Create persistence service
  const persistenceService = new PostgresPersistenceService({
    databaseUrl: getEnv('AGENT_DATABASE_URL'),
  });

  // Create runtime with apiClient and persistenceService in config
  const runtime = createAgentRuntime({
    ...config,
    apiClient: ClientPool.getInstance(),
    persistenceService,
  });

  // Subscribe to events
  runtime.on('agent:created', (event) => {
    log.debug(`Agent created: ${event.payload}`);
  });

  runtime.on('agent:started', (event) => {
    log.info(`Agent started: ${event.payload}`);
  });

  runtime.on('agent:sleeping', (event) => {
    log.debug(`Agent sleeping: ${event.payload}`);
  });

  runtime.on('agent:error', (event) => {
    log.error(`Agent error: ${event.payload}`);
  });

  await runtime.start();

  // Store runtime reference
  runtimes.set(pidFile, runtime);

  // Write PID file
  writeFileSync(pidFile, String(process.pid));

  console.log(chalk.green('✓') + ' Agent Runtime started');
  console.log(chalk.gray('  PID: ') + process.pid);
  console.log(chalk.gray('  Mode: ') + options.messageBus);

  if (options.detach) {
    // In detached mode, keep running in background
    console.log(chalk.gray('  Detached: ') + 'yes');
    console.log('');
    console.log(
      chalk.gray('Use ') +
        chalk.cyan('agent-cli runtime stop') +
        chalk.gray(' to stop'),
    );
    console.log(
      chalk.gray('Use ') +
        chalk.cyan('agent-cli runtime status') +
        chalk.gray(' to check status'),
    );

    // Keep process alive
    process.on('SIGINT', () => {
      console.log('\n' + chalk.yellow('Received SIGINT, stopping runtime...'));
      cleanupAndExit(pidFile, runtime);
    });

    process.on('SIGTERM', () => {
      console.log('\n' + chalk.yellow('Received SIGTERM, stopping runtime...'));
      cleanupAndExit(pidFile, runtime);
    });

    // Keep alive
    await new Promise(() => {});
  } else {
    // In foreground mode, run for a bit then stop
    console.log('');
    console.log(chalk.gray('Runtime running... Press Ctrl+C to stop'));

    process.on('SIGINT', () => {
      console.log('\n' + chalk.yellow('Stopping runtime...'));
      cleanupAndExit(pidFile, runtime);
    });

    await new Promise(() => {});
  }
}

/**
 * Stop runtime
 */
async function runtimeStop(options: {
  pidFile: string;
  force: boolean;
}): Promise<void> {
  const pidFile = resolve(options.pidFile);

  if (!existsSync(pidFile)) {
    console.log(chalk.yellow('Runtime is not running (no PID file found)'));
    return;
  }

  const pid = parseInt(readFileSync(pidFile, 'utf-8'));

  if (options.force || isProcessRunning(pid)) {
    try {
      // Clean up local runtime reference if exists
      const runtime = runtimes.get(pidFile);
      if (runtime) {
        await runtime.stop();
        runtimes.delete(pidFile);
      }

      // Kill process
      process.kill(pid, 'SIGTERM');
      console.log(chalk.green('✓') + ' Runtime stopped');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
        console.log(chalk.yellow('Runtime process not found'));
      } else {
        throw error;
      }
    }
  }

  // Remove PID file
  if (existsSync(pidFile)) {
    unlinkSync(pidFile);
  }
}

/**
 * Get runtime status
 */
async function runtimeStatus(options: {
  pidFile: string;
  output?: OutputFormat;
}): Promise<void> {
  const pidFile = resolve(options.pidFile);

  if (!existsSync(pidFile)) {
    const status = {
      running: false,
      message: 'Runtime is not running',
    };
    console.log(formatOutput(status, options.output || 'table'));
    return;
  }

  const pid = parseInt(readFileSync(pidFile, 'utf-8'));
  const running = isProcessRunning(pid);

  // Get runtime stats if available locally
  let stats = null;
  const runtime = runtimes.get(pidFile);
  if (runtime && running) {
    stats = await runtime.getStats();
  }

  const status = {
    running,
    pid,
    uptime: running ? 'unknown' : 'N/A',
    messageBus: 'unknown',
    stats,
  };

  const output = options.output || 'table';

  if (output === 'table') {
    console.log('');
    console.log(
      createBox('Agent Runtime Status', formatRuntimeStatus(status, running)),
    );
  } else {
    console.log(formatOutput(status, output));
  }
}

/**
 * List all runtimes
 */
async function runtimeList(options: { output?: OutputFormat }): Promise<void> {
  // For now, just list local runtimes
  const runtimesList = Array.from(runtimes.entries()).map(([pidFile, _]) => {
    const pidFileResolved = resolve(pidFile);
    const pid = existsSync(pidFileResolved)
      ? parseInt(readFileSync(pidFileResolved, 'utf-8'))
      : null;

    return {
      pidFile: pidFileResolved,
      pid,
      running: pid ? isProcessRunning(pid) : false,
    };
  });

  const output = options.output || 'table';

  if (output === 'table') {
    if (runtimesList.length === 0) {
      console.log(chalk.gray('No runtimes found'));
      return;
    }

    console.log('');
    console.log(chalk.bold('Active Runtimes:'));
    console.log('');

    for (const rt of runtimesList) {
      const status = rt.running
        ? chalk.green('Running')
        : chalk.gray('Stopped');
      console.log(`  ${rt.pidFile}`);
      console.log(`    PID: ${rt.pid || 'N/A'} | Status: ${status}`);
    }
  } else {
    console.log(formatOutput(runtimesList, output));
  }
}

/**
 * Helper: Format runtime status for display
 */
function formatRuntimeStatus(status: any, running: boolean): string {
  const lines = [
    formatStats([
      {
        label: 'Status',
        value: running ? chalk.green('Running') : chalk.red('Stopped'),
      },
      { label: 'PID', value: status.pid },
      { label: 'Uptime', value: status.uptime },
      { label: 'MessageBus', value: status.messageBus },
    ]),
  ] as string[];

  if (status.stats) {
    lines.push('');
    lines.push(chalk.bold('Agents:'));
    lines.push(
      formatStats([
        { label: 'Total', value: status.stats.totalAgents },
        { label: 'Running', value: status.stats.agentsByStatus.running || 0 },
        { label: 'Idle', value: status.stats.agentsByStatus.idle || 0 },
        { label: 'Stopped', value: status.stats.agentsByStatus.stopped || 0 },
      ]),
    );
  }

  return lines.join('\n');
}

/**
 * Helper: Check if process is running
 */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper: Cleanup and exit
 */
async function cleanupAndExit(
  pidFile: string,
  runtime: Awaited<ReturnType<typeof createAgentRuntime>>,
): Promise<void> {
  try {
    await runtime.stop();
  } catch (error) {
    log.error('Error stopping runtime:', error);
  }

  if (existsSync(pidFile)) {
    unlinkSync(pidFile);
  }

  process.exit(0);
}
