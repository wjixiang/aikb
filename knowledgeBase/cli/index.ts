#!/usr/bin/env node

import { Command } from 'commander';
import { createEntityCommand } from './commands/create-entity';
import { createKnowledgeCommand } from './commands/create-knowledge';
import { renderMarkdownCommand } from './commands/render-markdown';
import {
  checkDatabaseConnection,
  displayDatabaseStatus,
} from './utils/storage';
import createLoggerWithPrefix from 'lib/logManagement/logger';

const logger = createLoggerWithPrefix('CLI-Main');

const program = new Command();

program
  .name('knowledge-cli')
  .description(
    'CLI for creating and managing knowledge base entities and knowledge',
  )
  .version('1.0.0');

// Add status command
program
  .command('status')
  .description('显示数据库连接状态和统计信息')
  .action(async () => {
    try {
      await displayDatabaseStatus();
    } catch (error: any) {
      logger.error('显示状态失败:', error.message);
      console.error('❌ 显示状态失败:', error.message);
      process.exit(1);
    }
  });

// Add commands
program.addCommand(createEntityCommand);
program.addCommand(createKnowledgeCommand);
program.addCommand(renderMarkdownCommand);

// Global error handler
program.exitOverride();

// Handle unknown commands
program.on('command:*', () => {
  console.error('Invalid command: %s', program.args.join(' '));
  console.log('See --help for a list of available commands.');
  process.exit(1);
});

// Main execution function
async function main() {
  try {
    // Log startup information
    logger.info('启动知识库CLI工具...');

    // Get the command being executed
    const args = process.argv.slice(2);
    const command = args[0];

    // Skip database connection check for status command
    if (command !== 'status') {
      logger.info('检查数据库连接...');
      // Check database connection before running any command
      const dbConnected = await checkDatabaseConnection();
      if (!dbConnected) {
        console.error('❌ 数据库连接失败。请检查配置。');
        console.error('💡 提示: 运行 "knowledge-cli status" 查看详细状态信息');
        process.exit(1);
      }
      logger.info('数据库连接成功');
    }

    // Parse command line arguments
    await program.parseAsync(process.argv);
  } catch (err: any) {
    if (err.code === 'commander.help') {
      process.exit(0);
    }
    logger.error('CLI执行错误:', err.message);
    console.error('❌ 错误:', err.message);
    process.exit(1);
  }
}

// Run the CLI
main();
