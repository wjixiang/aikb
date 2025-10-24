import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { initializeStorage } from '../utils/storage';
import {
  promptForKnowledgeId,
  promptForOutputPath,
  displaySuccess,
  displayError,
  displayInfo,
} from '../utils/prompts';
import createLoggerWithPrefix from 'lib/logManagement/logger';

const logger = createLoggerWithPrefix('CLI-RenderMarkdown');

/**
 * Render markdown command
 */
export const renderMarkdownCommand = new Command('render-markdown')
  .description('Render knowledge as markdown format')
  .option('-i, --interactive', 'Run in interactive mode', true)
  .option('-k, --knowledge-id <knowledgeId>', 'Knowledge ID to render')
  .option('-o, --output <outputPath>', 'Output file path')
  .option('-p, --print', 'Print to console instead of saving to file')
  .action(async (options) => {
    try {
      displayInfo('正在初始化存储系统...');
      logger.info('开始渲染Markdown...');
      const storage = await initializeStorage();
      logger.info('存储系统初始化成功');

      let knowledgeId: string;
      let outputPath: string | undefined;

      if (options.interactive && !options.print) {
        // Interactive mode - prompt for knowledge ID and output path
        knowledgeId = await promptForKnowledgeId();
        outputPath = await promptForOutputPath();
      } else {
        // Non-interactive mode or print to console
        if (!options.knowledge_id) {
          displayError('必须提供知识ID');
          process.exit(1);
        }

        knowledgeId = options.knowledge_id;

        if (!options.print && !options.output) {
          displayError(
            '在非交互模式下，必须提供 --output 选项或使用 --print 选项',
          );
          process.exit(1);
        }

        outputPath = options.output;
      }

      // Get the knowledge
      displayInfo('正在查找知识...');
      logger.info(`查找知识ID: ${knowledgeId}`);
      const knowledge =
        await storage.knowledgeStorage.get_knowledge_by_id(knowledgeId);

      if (!knowledge) {
        logger.error(`未找到ID为 ${knowledgeId} 的知识`);
        displayError(`未找到ID为 ${knowledgeId} 的知识`);
        displayError('💡 提示: 请先创建知识，或使用正确的知识ID');
        process.exit(1);
      }

      logger.info(`找到知识: ${knowledge.getData().scope}`);
      displayInfo(`找到知识: ${knowledge.getData().scope}`);

      // Render to markdown
      displayInfo('正在渲染Markdown...');
      logger.info('渲染Markdown内容...');
      const markdownContent = knowledge.render_to_markdown_string();
      logger.info(`Markdown渲染完成，内容长度: ${markdownContent.length}`);

      if (options.print) {
        // Print to console
        console.log('\n📄 Markdown内容:');
        console.log('='.repeat(50));
        console.log(markdownContent);
        console.log('='.repeat(50));
      } else {
        // Save to file
        displayInfo(`正在保存到文件: ${outputPath}`);

        // Ensure directory exists
        const dir = path.dirname(outputPath!);
        await fs.mkdir(dir, { recursive: true });

        // Write to file
        await fs.writeFile(outputPath!, markdownContent, 'utf8');

        displaySuccess(`Markdown已成功保存到: ${outputPath}`);
      }

      // Display knowledge details
      console.log('\n📋 知识详情:');
      console.log(`  ID: ${knowledge.get_id()}`);
      console.log(`  范围: ${knowledge.getData().scope}`);
      console.log(`  子知识数量: ${knowledge.getChildren().length}`);
    } catch (error: any) {
      logger.error('渲染Markdown失败:', error.message);
      displayError(`渲染Markdown失败: ${error.message}`);

      // Provide more helpful error messages
      if (
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      ) {
        displayError('💡 提示: 请确保MongoDB服务正在运行，并且连接地址正确');
        displayError('   预期连接地址: mongodb://mongodb:27017');
      } else if (error.message.includes('Cast to ObjectId failed')) {
        displayError('💡 提示: 知识ID格式不正确，请使用有效的知识ID');
      } else if (error.message.includes('ENOENT')) {
        displayError('💡 提示: 输出路径不存在或无法访问');
      } else if (error.message.includes('EACCES')) {
        displayError('💡 提示: 没有权限写入指定路径');
      }

      process.exit(1);
    }
  });
