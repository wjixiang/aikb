#!/usr/bin/env node
/**
 * Agent CLI - 多Agent框架命令行工具
 *
 * Usage:
 *   agent-cli <command> [options]
 *
 * @module agent-cli
 */

import { program } from 'commander';
import chalk from 'chalk';
import { VERSION } from './lib/version.js';
import { loadConfig } from './lib/config.js';
import { initLogger } from './lib/logger.js';
import { runtimeCommands } from './commands/runtime.js';
import { agentCommands } from './commands/agent.js';
import { testCommands } from './commands/test.js';
import { monitorCommands } from './commands/monitor.js';
import { a2aCommands } from './commands/a2a.js';

// Global CLI state
interface CliState {
  config: any;
  logLevel: string;
  outputFormat: 'table' | 'json' | 'compact';
  noColor: boolean;
  verbose: boolean;
}

const state: CliState = {
  config: {},
  logLevel: 'info',
  outputFormat: 'table',
  noColor: false,
  verbose: false,
};

// Disable colors if requested
if (state.noColor) {
  chalk.level = 0;
}

// ============================================================
// Main Program
// ============================================================

program
  .name('agent-cli')
  .description('多Agent框架命令行工具 - 用于测试、监控和管理Agent运行时')
  .version(VERSION);

// ============================================================
// Global Options
// ============================================================

program
  .option('-c, --config <file>', '配置文件路径', '.agent-clirc')
  .option('-l, --log-level <level>', '日志级别 (debug|info|warn|error)', 'info')
  .option('-o, --output <format>', '输出格式 (table|json|compact)', 'table')
  .option('--no-color', '禁用彩色输出')
  .option('-v, --verbose', '详细输出')
  .hook('preAction', (thisCommand) => {
    // Load config before executing command
    const options = thisCommand.opts();
    state.config = loadConfig(options['config']);
    state.logLevel = options['logLevel'] || state.logLevel;
    state.outputFormat = options['output'] || state.outputFormat;
    state.noColor = options['noColor'] || false;
    state.verbose = options['verbose'] || false;

    // Initialize logger
    initLogger(state.logLevel, state.verbose);
  });

// ============================================================
// Commands
// ============================================================

// Runtime commands
runtimeCommands(program);

// Agent commands
agentCommands(program);

// Test commands
testCommands(program);

// Monitor commands
monitorCommands(program);

// A2A commands
a2aCommands(program);

// ============================================================
// Error Handling
// ============================================================

program.configureOutput({
  writeErr: (str) => {
    if (state.outputFormat === 'json') {
      console.error(JSON.stringify({ error: str.trim() }, null, 2));
    } else {
      console.error(chalk.red(str));
    }
  },
});

// ============================================================
// Parse and Execute
// ============================================================

program.parseAsync(process.argv).catch((error) => {
  if (state.outputFormat === 'json') {
    console.error(JSON.stringify({
      error: error.message,
      stack: error.stack,
    }, null, 2));
  } else {
    console.error(chalk.red('Error:'), error.message);
    if (state.verbose) {
      console.error(error.stack);
    }
  }
  process.exit(1);
});

export { state };
