#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import Library, { S3ElasticSearchLibraryStorage } from '../knowledgeImport/library';
import { embeddingService } from '../../lib/embedding/embedding';
import { ChunkingStrategyType } from '../../lib/chunking/chunkingStrategy';
import createLoggerWithPrefix from '../../lib/logger';

const logger = createLoggerWithPrefix('InteractiveSearch');

const program = new Command();

program
  .name('interactive-search')
  .description('Interactive tool for searching library items and performing semantic search')
  .version('1.0.0');

// Initialize library
let library: Library;

async function initializeLibrary() {
  try {
    // Get vector dimensions from environment or use default
    const vectorDimensions = parseInt(process.env.VECTOR_DIMENSIONS || '1024');
    logger.info(`Using vector dimensions: ${vectorDimensions}`);
    
    const storage = new S3ElasticSearchLibraryStorage(undefined, vectorDimensions);
    library = new Library(storage);
    logger.info('Library initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize library:', error);
    console.error(chalk.red('❌ Failed to initialize library. Please check your configuration.'));
    process.exit(1);
  }
}

// Format item for display
function formatItem(item: any, index: number) {
  return {
    index: index + 1,
    id: item.metadata.id,
    title: item.metadata.title,
    authors: item.metadata.authors.map((a: any) => `${a.lastName}, ${a.firstName}`).join(', '),
    year: item.metadata.publicationYear || 'N/A',
    tags: item.metadata.tags.join(', ') || 'N/A',
    status: item.metadata.pdfProcessingStatus || 'Unknown',
  };
}

// Format chunk for display
function formatChunk(chunk: any, index: number) {
  const content = chunk.content.length > 100 
    ? chunk.content.substring(0, 100) + '...' 
    : chunk.content;
  
  return {
    index: index + 1,
    id: chunk.id,
    title: chunk.title,
    content: content,
    strategy: chunk.strategyMetadata?.chunkingStrategy || 'Unknown',
    similarity: chunk.similarity ? chunk.similarity.toFixed(3) : 'N/A',
  };
}

// List items command
async function listItemsCommand(options: any) {
  try {
    console.log(chalk.blue('📚 搜索库中项目...'));
    
    const filter: any = {};
    if (options.query) {
      filter.query = options.query;
    }
    if (options.tags) {
      filter.tags = options.tags.split(',').map((t: string) => t.trim());
    }
    if (options.authors) {
      filter.authors = options.authors.split(',').map((a: string) => a.trim());
    }
    if (options.fileType) {
      filter.fileType = options.fileType.split(',').map((f: string) => f.trim());
    }
    
    const items = await library.searchItems(filter);
    
    if (items.length === 0) {
      console.log(chalk.yellow('⚠️  未找到匹配的项目'));
      return;
    }
    
    const table = new Table({
      head: ['#', 'ID', '标题', '作者', '年份', '标签', '状态'],
      colWidths: [5, 20, 30, 25, 6, 20, 10],
    });
    
    items.forEach((item, index) => {
      const formatted = formatItem(item, index);
      table.push([
        formatted.index,
        formatted.id.substring(0, 18) + '...',
        formatted.title.length > 28 ? formatted.title.substring(0, 27) + '...' : formatted.title,
        formatted.authors.length > 23 ? formatted.authors.substring(0, 22) + '...' : formatted.authors,
        formatted.year,
        formatted.tags.length > 18 ? formatted.tags.substring(0, 17) + '...' : formatted.tags,
        formatted.status,
      ]);
    });
    
    console.log(table.toString());
    console.log(chalk.green(`✅ 找到 ${items.length} 个项目`));
    
    if (options.interactive) {
      await selectItemInteractively(items);
    }
  } catch (error) {
    logger.error('Error listing items:', error);
    console.error(chalk.red('❌ 列出项目时出错:', error instanceof Error ? error.message : error));
  }
}

// Select item interactively
async function selectItemInteractively(items: any[]) {
  const { selectedItem } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedItem',
      message: '选择一个项目进行操作:',
      choices: items.map((item, index) => ({
        name: `${index + 1}. ${item.metadata.title} (${item.metadata.authors.map((a: any) => a.lastName).join(', ')}, ${item.metadata.publicationYear || 'N/A'})`,
        value: index,
      })),
    },
  ]);
  
  const item = items[selectedItem];
  await showItemDetails(item);
}

// Show item details
async function showItemDetails(item: any) {
  console.log(chalk.blue('\n📖 项目详情:'));
  console.log(chalk.white(`标题: ${item.metadata.title}`));
  console.log(chalk.white(`作者: ${item.metadata.authors.map((a: any) => `${a.firstName} ${a.lastName}`).join(', ')}`));
  console.log(chalk.white(`年份: ${item.metadata.publicationYear || 'N/A'}`));
  console.log(chalk.white(`出版社: ${item.metadata.publisher || 'N/A'}`));
  console.log(chalk.white(`标签: ${item.metadata.tags.join(', ') || 'N/A'}`));
  console.log(chalk.white(`状态: ${item.metadata.pdfProcessingStatus || 'Unknown'}`));
  
  if (item.metadata.abstract) {
    console.log(chalk.white(`摘要: ${item.metadata.abstract}`));
  }
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '选择操作:',
      choices: [
        { name: '🔍 语义搜索项目内容', value: 'semantic-search' },
        { name: '📄 查看项目块', value: 'view-chunks' },
        { name: '🔙 返回列表', value: 'back' },
        { name: '❌ 退出', value: 'exit' },
      ],
    },
  ]);
  
  switch (action) {
    case 'semantic-search':
      await semanticSearchInteractively(item);
      break;
    case 'view-chunks':
      await viewChunks(item);
      break;
    case 'back':
      await listItemsCommand({ interactive: true });
      break;
    case 'exit':
      process.exit(0);
  }
}

// Semantic search interactively
async function semanticSearchInteractively(item?: any) {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'query',
      message: '输入搜索查询:',
      validate: (input) => input.trim() !== '' || '请输入有效的查询',
    },
    {
      type: 'input',
      name: 'limit',
      message: '结果数量限制:',
      default: '10',
      validate: (input) => {
        const num = parseInt(input);
        return (!isNaN(num) && num > 0) || '请输入大于0的数字';
      },
      filter: (input) => parseInt(input),
    },
    {
      type: 'input',
      name: 'threshold',
      message: '相似度阈值 (0-1):',
      default: '0.7',
      validate: (input) => {
        const num = parseFloat(input);
        return (!isNaN(num) && num >= 0 && num <= 1) || '请输入0到1之间的数字';
      },
      filter: (input) => parseFloat(input),
    },
    {
      type: 'list',
      name: 'scope',
      message: '搜索范围:',
      choices: item 
        ? [
            { name: '仅在当前项目中搜索', value: 'current' },
            { name: '在所有项目中搜索', value: 'all' },
          ]
        : [
            { name: '在所有项目中搜索', value: 'all' },
          ],
      },
  ]);
  
  try {
    console.log(chalk.blue('🔍 执行语义搜索...'));
    
    // Generate embedding for the query
    const queryEmbedding = await embeddingService.embed(answers.query);
    if (!queryEmbedding || queryEmbedding.length === 0) {
      console.error(chalk.red('❌ Failed to generate embedding for query'));
      return;
    }
    const queryVector = queryEmbedding;
    
    let results;
    if (answers.scope === 'current' && item) {
      results = await library.findSimilarChunksInItem(
        item.metadata.id,
        queryVector,
        answers.limit,
        answers.threshold
      );
    } else {
      results = await library.findSimilarChunks(
        queryVector,
        answers.limit,
        answers.threshold
      );
    }
    
    if (results.length === 0) {
      console.log(chalk.yellow('⚠️  未找到匹配的内容块'));
      return;
    }
    
    const table = new Table({
      head: ['#', 'ID', '标题', '内容预览', '策略', '相似度'],
      colWidths: [5, 20, 25, 40, 12, 8],
    });
    
    results.forEach((chunk, index) => {
      const formatted = formatChunk(chunk, index);
      table.push([
        formatted.index,
        formatted.id.substring(0, 18) + '...',
        formatted.title.length > 23 ? formatted.title.substring(0, 22) + '...' : formatted.title,
        formatted.content,
        formatted.strategy,
        formatted.similarity,
      ]);
    });
    
    console.log(table.toString());
    console.log(chalk.green(`✅ 找到 ${results.length} 个匹配的内容块`));
    
    const { viewContent } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'viewContent',
        message: '是否查看某个内容块的完整内容?',
        default: false,
      },
    ]);
    
    if (viewContent) {
      const { selectedChunk } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedChunk',
          message: '选择要查看的内容块:',
          choices: results.map((chunk, index) => ({
            name: `${index + 1}. ${chunk.title} (相似度: ${(chunk.similarity || 0).toFixed(3)})`,
            value: index,
          })),
        },
      ]);
      
      const chunk = results[selectedChunk];
      console.log(chalk.blue('\n📄 内容块详情:'));
      console.log(chalk.white(`标题: ${chunk.title}`));
      console.log(chalk.white(`策略: ${chunk.strategyMetadata?.chunkingStrategy || 'Unknown'}`));
      console.log(chalk.white(`相似度: ${(chunk.similarity || 0).toFixed(3)}`));
      console.log(chalk.white('\n内容:'));
      console.log(chalk.gray(chunk.content));
    }
  } catch (error) {
    logger.error('Error performing semantic search:', error);
    console.error(chalk.red('❌ 执行语义搜索时出错:', error instanceof Error ? error.message : error));
  }
}

// View chunks
async function viewChunks(item: any) {
  try {
    console.log(chalk.blue('📄 获取项目内容块...'));
    
    const chunks = await item.getChunks();
    
    if (chunks.length === 0) {
      console.log(chalk.yellow('⚠️  该项目没有内容块'));
      return;
    }
    
    const table = new Table({
      head: ['#', 'ID', '标题', '策略', '字数'],
      colWidths: [5, 20, 30, 12, 8],
    });
    
    chunks.forEach((chunk: any, index: number) => {
      table.push([
        index + 1,
        chunk.id.substring(0, 18) + '...',
        chunk.title.length > 28 ? chunk.title.substring(0, 27) + '...' : chunk.title,
        chunk.strategyMetadata?.chunkingStrategy || 'Unknown',
        chunk.content.split(/\s+/).length,
      ]);
    });
    
    console.log(table.toString());
    console.log(chalk.green(`✅ 找到 ${chunks.length} 个内容块`));
    
    const { viewChunk } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'viewChunk',
        message: '是否查看某个内容块的完整内容?',
        default: false,
      },
    ]);
    
    if (viewChunk) {
      const { selectedChunk } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedChunk',
          message: '选择要查看的内容块:',
          choices: chunks.map((chunk: any, index: number) => ({
            name: `${index + 1}. ${chunk.title}`,
            value: index,
          })),
        },
      ]);
      
      const chunk = chunks[selectedChunk];
      console.log(chalk.blue('\n📄 内容块详情:'));
      console.log(chalk.white(`标题: ${chunk.title}`));
      console.log(chalk.white(`策略: ${chunk.strategyMetadata?.chunkingStrategy || 'Unknown'}`));
      console.log(chalk.white('\n内容:'));
      console.log(chalk.gray(chunk.content));
    }
  } catch (error) {
    logger.error('Error viewing chunks:', error);
    console.error(chalk.red('❌ 查看内容块时出错:', error instanceof Error ? error.message : error));
  }
}

// Commands
program
  .command('list')
  .description('List library items with optional filtering')
  .option('-q, --query <query>', 'Search query for title, abstract, or notes')
  .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
  .option('-a, --authors <authors>', 'Filter by authors (comma-separated)')
  .option('-f, --file-type <fileType>', 'Filter by file type (comma-separated)')
  .option('-i, --interactive', 'Run in interactive mode', false)
  .action(listItemsCommand);

program
  .command('search')
  .description('Perform semantic search across all items')
  .option('-q, --query <query>', 'Search query')
  .option('-l, --limit <limit>', 'Maximum number of results', '10')
  .option('-t, --threshold <threshold>', 'Similarity threshold (0-1)', '0.7')
  .option('--item-id <itemId>', 'Search within specific item')
  .action(async (options) => {
    if (!options.query) {
      const { query } = await inquirer.prompt([
        {
          type: 'input',
          name: 'query',
          message: '输入搜索查询:',
          validate: (input) => input.trim() !== '' || '请输入有效的查询',
        },
      ]);
      options.query = query;
    }
    
    try {
      console.log(chalk.blue('🔍 执行语义搜索...'));
      
      // Generate embedding for the query
      const queryEmbedding = await embeddingService.embed(options.query);
      if (!queryEmbedding || queryEmbedding.length === 0) {
        console.error(chalk.red('❌ Failed to generate embedding for query'));
        return;
      }
      const queryVector = queryEmbedding;
      
      let results;
      if (options.itemId) {
        results = await library.findSimilarChunksInItem(
          options.itemId,
          queryVector,
          parseInt(options.limit),
          parseFloat(options.threshold)
        );
      } else {
        results = await library.findSimilarChunks(
          queryVector,
          parseInt(options.limit),
          parseFloat(options.threshold)
        );
      }
      
      if (results.length === 0) {
        console.log(chalk.yellow('⚠️  未找到匹配的内容块'));
        return;
      }
      
      const table = new Table({
        head: ['#', 'ID', '标题', '内容预览', '策略', '相似度'],
        colWidths: [5, 20, 25, 40, 12, 8],
      });
      
      results.forEach((chunk, index) => {
        const formatted = formatChunk(chunk, index);
        table.push([
          formatted.index,
          formatted.id.substring(0, 18) + '...',
          formatted.title.length > 23 ? formatted.title.substring(0, 22) + '...' : formatted.title,
          formatted.content,
          formatted.strategy,
          formatted.similarity,
        ]);
      });
      
      console.log(table.toString());
      console.log(chalk.green(`✅ 找到 ${results.length} 个匹配的内容块`));
    } catch (error) {
      logger.error('Error performing semantic search:', error);
      const errorMessage = error instanceof Error ? error.message : error;
      
      if (errorMessage.includes('Vector dimensions mismatch')) {
        console.error(chalk.red('❌ 向量维度不匹配'));
        console.error(chalk.yellow('💡 这可能是因为查询使用的嵌入模型与存储的块使用的模型不同'));
        console.error(chalk.yellow('💡 请检查环境变量 VECTOR_DIMENSIONS 设置'));
        console.error(chalk.yellow(`💡 当前使用的维度: ${process.env.VECTOR_DIMENSIONS || '1024'}`));
        console.error(chalk.yellow('💡 如果存储的块使用1536维度，请设置 VECTOR_DIMENSIONS=1536'));
      } else {
        console.error(chalk.red('❌ 执行语义搜索时出错:', errorMessage));
      }
    }
  });

program
  .command('interactive')
  .description('Run in interactive mode')
  .action(async () => {
    console.log(chalk.blue('🚀 欢迎使用交互式搜索工具'));
    
    while (true) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: '请选择操作:',
          choices: [
            { name: '📚 列出并选择项目', value: 'list-items' },
            { name: '🔍 语义搜索', value: 'semantic-search' },
            { name: '❌ 退出', value: 'exit' },
          ],
        },
      ]);
      
      switch (action) {
        case 'list-items':
          await listItemsCommand({ interactive: true });
          break;
        case 'semantic-search':
          await semanticSearchInteractively();
          break;
        case 'exit':
          console.log(chalk.green('👋 再见!'));
          process.exit(0);
      }
    }
  });

// Main execution function
async function main() {
  try {
    console.log(chalk.blue('🔧 初始化搜索工具...'));
    await initializeLibrary();
    
    await program.parseAsync(process.argv);
  } catch (error: any) {
    if (error.code === 'commander.help') {
      process.exit(0);
    }
    logger.error('CLI execution error:', error.message);
    console.error(chalk.red('❌ 错误:', error.message));
    process.exit(1);
  }
}

// Run the CLI
main();