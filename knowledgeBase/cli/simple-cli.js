#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');

// Set up module resolution for TypeScript files
require('ts-node/register');
require('dotenv').config();

const program = new Command();

program
  .name('knowledge-cli')
  .description('CLI for creating and managing knowledge base entities and knowledge')
  .version('1.0.0');

// Create entity command
program
  .command('create-entity')
  .description('Create a new entity in the knowledge base')
  .option('-i, --interactive [mode]', 'Run in interactive mode', true)
  .option('-n, --name <name>', 'Entity name')
  .option('-t, --tags <tags>', 'Entity tags (comma-separated)')
  .option('-d, --definition <definition>', 'Entity definition')
  .action(async (options) => {
    try {
      console.log('🔍 创建新实体');
      console.log('⚠️  注意：由于环境限制，此为演示版本');
      
      if (options.interactive !== 'false') {
        console.log('交互模式已启用');
        console.log('请提供实体信息：');
        console.log(`  名称: ${options.name || '未提供'}`);
        console.log(`  标签: ${options.tags || '未提供'}`);
        console.log(`  定义: ${options.definition || '未提供'}`);
      } else {
        console.log('非交互模式');
        if (!options.name || !options.definition) {
          console.error('❌ 在非交互模式下，必须提供 --name 和 --definition 选项');
          process.exit(1);
        }
        console.log(`创建实体: ${options.name}`);
        console.log(`定义: ${options.definition}`);
      }
      
      console.log('✅ 实体创建成功（演示）');
    } catch (error) {
      console.error('❌ 创建实体失败:', error.message);
      process.exit(1);
    }
  });

// Create knowledge command
program
  .command('create-knowledge')
  .description('Create new knowledge in the knowledge base')
  .option('-i, --interactive [mode]', 'Run in interactive mode', true)
  .option('-e, --entity-id <entityId>', 'Entity ID to link knowledge to')
  .option('-s, --scope <scope>', 'Knowledge scope/title')
  .option('-c, --content <content>', 'Knowledge content')
  .option('-n, --natural-language <text>', 'Create knowledge from natural language text')
  .action(async (options) => {
    try {
      console.log('📚 创建新知识');
      console.log('⚠️  注意：由于环境限制，此为演示版本');
      
      if (options.interactive !== 'false') {
        console.log('交互模式已启用');
        console.log('请提供知识信息：');
        console.log(`  实体ID: ${options.entityId || '未提供'}`);
        console.log(`  范围: ${options.scope || '未提供'}`);
        console.log(`  内容: ${options.content || '未提供'}`);
        console.log(`  自然语言: ${options.naturalLanguage || '未提供'}`);
      } else {
        console.log('非交互模式');
        if (!options.entityId) {
          console.error('❌ 必须提供实体ID');
          process.exit(1);
        }
        console.log(`为实体 ${options.entityId} 创建知识`);
      }
      
      console.log('✅ 知识创建成功（演示）');
    } catch (error) {
      console.error('❌ 创建知识失败:', error.message);
      process.exit(1);
    }
  });

// Render markdown command
program
  .command('render-markdown')
  .description('Render knowledge as markdown format')
  .option('-i, --interactive [mode]', 'Run in interactive mode', true)
  .option('-k, --knowledge-id <knowledgeId>', 'Knowledge ID to render')
  .option('-o, --output <outputPath>', 'Output file path')
  .option('-p, --print', 'Print to console instead of saving to file')
  .action(async (options) => {
    try {
      console.log('📄 渲染Markdown');
      console.log('⚠️  注意：由于环境限制，此为演示版本');
      
      if (options.interactive !== 'false') {
        console.log('交互模式已启用');
        console.log('请提供渲染信息：');
        console.log(`  知识ID: ${options.knowledgeId || '未提供'}`);
        console.log(`  输出路径: ${options.output || '未提供'}`);
        console.log(`  打印到控制台: ${options.print || 'false'}`);
      } else {
        console.log('非交互模式');
        if (!options.knowledgeId) {
          console.error('❌ 必须提供知识ID');
          process.exit(1);
        }
        console.log(`渲染知识 ${options.knowledgeId}`);
      }
      
      if (options.print) {
        console.log('\n📄 Markdown内容（演示）:');
        console.log('='.repeat(50));
        console.log('# 知识标题\n\n这是知识内容的演示。\n\n## 子知识\n\n这是子知识的内容。');
        console.log('='.repeat(50));
      } else {
        console.log(`✅ Markdown已成功保存到: ${options.output || './output.md'}（演示）`);
      }
    } catch (error) {
      console.error('❌ 渲染Markdown失败:', error.message);
      process.exit(1);
    }
  });

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
    // Parse command line arguments first
    await program.parseAsync(process.argv);
    
    // Only show intro if not showing help
    if (!process.argv.includes('--help') && !process.argv.includes('-h')) {
      console.log('🚀 知识库CLI工具');
      console.log('⚠️  注意：由于环境限制，当前运行在演示模式\n');
    }
  } catch (err) {
    // Handle help and other commander errors gracefully
    if (err.code === 'commander.help' || err.code === 'outputHelp') {
      return; // Just exit without error
    }
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

// Run the CLI
main();