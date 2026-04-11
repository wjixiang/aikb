/**
 * Agent commands for agent-cli
 *
 * Commands for managing individual Agents in a Runtime.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import type { AgentMetadata, AgentFilter } from '../../core/runtime/types.js';
import {
  createEpidemiologyAgentSoul as _createEpidemiologyAgentSoul,
  createPathophysiologyAgentSoul as _createPathophysiologyAgentSoul,
  createDiagnosisAgentSoul as _createDiagnosisAgentSoul,
  createManagementAgentSoul as _createManagementAgentSoul,
  createQualityOfLifeAgentSoul as _createQualityOfLifeAgentSoul,
  createEmergingTreatmentsAgentSoul as _createEmergingTreatmentsAgentSoul,
} from 'agent-soul-hub';

// Re-wrap with local AgentBlueprint type to avoid duplicate type declarations
// between source and dist
const createEpidemiologyAgentSoul = () => _createEpidemiologyAgentSoul();
const createPathophysiologyAgentSoul = () => _createPathophysiologyAgentSoul();
const createDiagnosisAgentSoul = () => _createDiagnosisAgentSoul();
const createManagementAgentSoul = () => _createManagementAgentSoul();
const createQualityOfLifeAgentSoul = () => _createQualityOfLifeAgentSoul();
const createEmergingTreatmentsAgentSoul = () => _createEmergingTreatmentsAgentSoul();
import { log } from '../lib/logger.js';
import {
  formatOutput,
  formatStatus,
  formatRelativeTime,
  createBox,
  type OutputFormat,
} from '../lib/formatter.js';

const DEFAULT_PID_FILE = '.agent-runtime.pid';

// Agent type definitions
const AGENT_TYPES = {
  epidemiology: {
    name: 'Epidemiology Agent',
    description: '流行病学与危险因素文献检索',
    createSoul: createEpidemiologyAgentSoul,
  },
  pathophysiology: {
    name: 'Pathophysiology Agent',
    description: '病理机制与疼痛通路文献检索',
    createSoul: createPathophysiologyAgentSoul,
  },
  diagnosis: {
    name: 'Diagnosis Agent',
    description: '诊断、筛查与预防文献检索',
    createSoul: createDiagnosisAgentSoul,
  },
  management: {
    name: 'Management Agent',
    description: '疾病管理与治疗文献检索',
    createSoul: createManagementAgentSoul,
  },
  'quality-of-life': {
    name: 'Quality of Life Agent',
    description: '生活质量与社会负担文献检索',
    createSoul: createQualityOfLifeAgentSoul,
  },
  'emerging-treatments': {
    name: 'Emerging Treatments Agent',
    description: '展望与新兴疗法文献检索',
    createSoul: createEmergingTreatmentsAgentSoul,
  },
};

type AgentType = keyof typeof AGENT_TYPES;

/**
 * Register agent commands
 */
export function agentCommands(program: Command): void {
  const agentCmd = program.command('agent').description('Agent 管理');

  // ============================================================
  // agent list
  // ============================================================
  agentCmd
    .command('list')
    .description('列出所有 Agent')
    .option('-s, --status <status>', '过滤状态')
    .option('-t, --type <type>', '过滤类型')
    .option('-o, --output <format>', '输出格式 (table|json|compact)')
    .option('--pid-file <file>', 'Runtime PID 文件', DEFAULT_PID_FILE)
    .action(async (options) => {
      await agentList(options);
    });

  // ============================================================
  // agent create
  // ============================================================
  agentCmd
    .command('create <type>')
    .description('创建 Agent')
    .addHelpText(
      'after',
      `
支持的 Agent 类型:
  epidemiology        流行病学与危险因素文献检索
  pathophysiology     病理机制与疼痛通路文献检索
  diagnosis           诊断、筛查与预防文献检索
  management          疾病管理与治疗文献检索
  quality-of-life     生活质量与社会负担文献检索
  emerging-treatments 展望与新兴疗法文献检索
`,
    )
    .option('-n, --name <name>', 'Agent 名称')
    .option('--sop <file>', 'SOP 文件路径')
    .option('--auto-start', '自动启动')
    .option('-o, --output <format>', '输出格式 (table|json|compact)')
    .option('--pid-file <file>', 'Runtime PID 文件', DEFAULT_PID_FILE)
    .action(async (type, options) => {
      await agentCreate(type, options);
    });

  // ============================================================
  // agent start
  // ============================================================
  agentCmd
    .command('start <instanceId>')
    .description('启动 Agent')
    .option('--pid-file <file>', 'Runtime PID 文件', DEFAULT_PID_FILE)
    .action(async (instanceId, options) => {
      await agentStart(instanceId, options);
    });

  // ============================================================
  // agent stop
  // ============================================================
  agentCmd
    .command('stop <instanceId>')
    .description('停止 Agent')
    .option('-f, --force', '强制停止')
    .option('--pid-file <file>', 'Runtime PID 文件', DEFAULT_PID_FILE)
    .action(async (instanceId, options) => {
      await agentStop(instanceId, options);
    });

  // ============================================================
  // agent destroy
  // ============================================================
  agentCmd
    .command('destroy <instanceId>')
    .description('销毁 Agent')
    .option('--cascade', '级联销毁子 Agent')
    .option('--pid-file <file>', 'Runtime PID 文件', DEFAULT_PID_FILE)
    .action(async (instanceId, options) => {
      await agentDestroy(instanceId, options);
    });

  // ============================================================
  // agent logs
  // ============================================================
  agentCmd
    .command('logs <instanceId>')
    .description('查看 Agent 日志')
    .option('-f, --follow', '持续跟踪日志')
    .option('--tail <n>', '显示最后 n 行', '50')
    .option('--filter <pattern>', '过滤日志内容')
    .option('--pid-file <file>', 'Runtime PID 文件', DEFAULT_PID_FILE)
    .action(async (instanceId, options) => {
      await agentLogs(instanceId, options);
    });
}

/**
 * Get runtime from PID file
 */
function getRuntime(pidFile: string) {
  const pidFilePath = resolve(pidFile);

  if (!existsSync(pidFilePath)) {
    console.error(chalk.red('Error: Runtime is not running'));
    console.error(
      chalk.gray('Start it with: ') + chalk.cyan('agent-cli runtime start'),
    );
    throw new Error('Runtime not running');
  }

  const pid = parseInt(readFileSync(pidFilePath, 'utf-8'));

  // For now, we can't communicate with detached runtime
  // This is a limitation that needs to be addressed with IPC/API
  // For now, throw error
  console.error(chalk.red('Error: Cannot communicate with detached runtime'));
  console.error(chalk.gray('Please use runtime in foreground mode for now'));
  throw new Error('Cannot communicate with detached runtime');
}

/**
 * List agents
 */
async function agentList(options: {
  status?: string;
  type?: string;
  output?: OutputFormat;
  pidFile: string;
}): Promise<void> {
  try {
    getRuntime(options.pidFile);
  } catch {
    return;
  }

  // TODO: Get actual agent list from runtime
  // For now, return empty list
  const agents: AgentMetadata[] = [];

  const output = options.output || 'table';

  if (output === 'table') {
    if (agents.length === 0) {
      console.log(chalk.gray('No agents found'));
      console.log('');
      console.log(
        chalk.gray('Create an agent with: ') +
          chalk.cyan('agent-cli agent create <type>'),
      );
      return;
    }

    console.log('');
    console.log(chalk.bold(`Agents (${agents.length}):`));
    console.log('');

    for (const agent of agents) {
      const status = formatStatus(agent.status);
      const createdAt = formatRelativeTime(agent.createdAt);
      const type = agent.agentType || chalk.gray('N/A');
      const name = agent.name || chalk.gray('N/A');

      console.log(
        `  ${chalk.cyan(agent.instanceId)} ${status}`,
      );
      console.log(`    ${chalk.bold(name)} │ ${type} │ ${createdAt}`);
    }
  } else {
    console.log(formatOutput(agents, output));
  }
}

/**
 * Create agent
 */
async function agentCreate(
  type: string,
  options: {
    name?: string;
    sop?: string;
    autoStart: boolean;
    output?: OutputFormat;
    pidFile: string;
  },
): Promise<void> {
  // Validate agent type
  const agentType = AGENT_TYPES[type as AgentType];
  if (!agentType) {
    console.error(chalk.red(`Error: Unknown agent type "${type}"`));
    console.error('');
    console.error(chalk.gray('Available types:'));
    for (const [key, value] of Object.entries(AGENT_TYPES)) {
      console.error(`  ${chalk.cyan(key.padEnd(20))} ${value.description}`);
    }
    process.exit(1);
  }

  try {
    getRuntime(options.pidFile);
  } catch {
    return;
  }

  log.info(`Creating ${agentType.name} (${type})...`);

  // Create agent soul
  const soulConfig = agentType.createSoul();

  // Override name if provided
  if (options.name && soulConfig.agent) {
    soulConfig.agent.name = options.name;
  }

  // TODO: Send create request to runtime
  // For now, this is a placeholder
  console.log(chalk.green('✓') + ` Agent created: ${type}`);
  console.log(chalk.gray('  Name: ') + (soulConfig.agent?.name || agentType.name));
  console.log(chalk.gray('  Type: ') + type);

  if (options.autoStart) {
    console.log(chalk.gray('  Starting...'));
    // TODO: Start the agent
  }
}

/**
 * Start agent
 */
async function agentStart(
  instanceId: string,
  options: { pidFile: string },
): Promise<void> {
  try {
    getRuntime(options.pidFile);
  } catch {
    return;
  }

  log.info(`Starting agent: ${instanceId}`);

  // TODO: Send start request to runtime
  console.log(chalk.green('✓') + ` Agent started: ${instanceId}`);
}

/**
 * Stop agent
 */
async function agentStop(
  instanceId: string,
  options: { force: boolean; pidFile: string },
): Promise<void> {
  try {
    getRuntime(options.pidFile);
  } catch {
    return;
  }

  log.info(
    `Stopping agent: ${instanceId}` + (options.force ? ' (force)' : ''),
  );

  // TODO: Send stop request to runtime
  console.log(chalk.green('✓') + ` Agent stopped: ${instanceId}`);
}

/**
 * Destroy agent
 */
async function agentDestroy(
  instanceId: string,
  options: { cascade: boolean; pidFile: string },
): Promise<void> {
  try {
    getRuntime(options.pidFile);
  } catch {
    return;
  }

  log.info(
    `Destroying agent: ${instanceId}` +
      (options.cascade ? ' (cascade)' : ''),
  );

  // TODO: Send destroy request to runtime
  console.log(chalk.green('✓') + ` Agent destroyed: ${instanceId}`);

  if (options.cascade) {
    console.log(chalk.gray('  Child agents will also be destroyed'));
  }
}

/**
 * View agent logs
 */
async function agentLogs(
  instanceId: string,
  options: {
    follow: boolean;
    tail: string;
    filter?: string;
    pidFile: string;
  },
): Promise<void> {
  try {
    getRuntime(options.pidFile);
  } catch {
    return;
  }

  const tailLines = parseInt(options.tail);

  console.log(chalk.bold(`Logs for agent: ${instanceId}`));
  console.log(chalk.gray('─'.repeat(50)));

  if (options.follow) {
    console.log(chalk.gray('Following logs... (Ctrl+C to stop)'));
  }

  // TODO: Get logs from runtime
  console.log(chalk.gray('No logs available'));
}
