import { Command } from 'commander';
import Entity from '../../Entity';
import { initializeStorage } from '../utils/storage';
import {
  promptForEntityCreation,
  displaySuccess,
  displayError,
  displayInfo,
} from '../utils/prompts';
import createLoggerWithPrefix from '../../lib/logger';

const logger = createLoggerWithPrefix('CLI-CreateEntity');

/**
 * Create entity command
 */
export const createEntityCommand = new Command('create-entity')
  .description('Create a new entity in the knowledge base')
  .option('-i, --interactive', 'Run in interactive mode', true)
  .option('-n, --name <name>', 'Entity name')
  .option('-t, --tags <tags>', 'Entity tags (comma-separated)')
  .option('-d, --definition <definition>', 'Entity definition')
  .action(async (options) => {
    try {
      displayInfo('正在初始化存储系统...');
      logger.info('开始创建实体...');
      const storage = await initializeStorage();
      logger.info('存储系统初始化成功');

      let entityData;

      if (options.interactive) {
        // Interactive mode - prompt for entity data
        entityData = await promptForEntityCreation();
      } else {
        // Non-interactive mode - use command line options
        if (!options.name || !options.definition) {
          displayError('在非交互模式下，必须提供 --name 和 --definition 选项');
          process.exit(1);
        }

        const tags = options.tags
          ? options.tags
              .split(',')
              .map((tag) => tag.trim())
              .filter((tag) => tag !== '')
          : [];

        entityData = {
          name: [options.name],
          tags,
          definition: options.definition,
        };
      }

      displayInfo('正在创建实体...');
      logger.info(`创建实体: ${entityData.name.join(', ')}`);

      // Create temporary entity using static method
      const tempEntity = Entity.create_entity_with_entity_data(entityData);

      // Save entity to storage
      logger.info('保存实体到数据库...');
      const savedEntity = await tempEntity.save(storage.entityStorage);
      logger.info(`实体保存成功，ID: ${savedEntity.get_id()}`);

      displaySuccess(`实体创建成功！`);
      displayInfo(`实体ID: ${savedEntity.get_id()}`);
      displayInfo(`实体名称: ${savedEntity.get_definition()}`);

      // Display entity details
      console.log('\n📋 实体详情:');
      console.log(`  ID: ${savedEntity.get_id()}`);
      console.log(`  名称: ${entityData.name.join(', ')}`);
      if (entityData.tags.length > 0) {
        console.log(`  标签: ${entityData.tags.join(', ')}`);
      }
      console.log(`  定义: ${entityData.definition}`);
    } catch (error: any) {
      logger.error('创建实体失败:', error.message);
      displayError(`创建实体失败: ${error.message}`);

      // Provide more helpful error messages
      if (
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      ) {
        displayError('💡 提示: 请确保MongoDB服务正在运行，并且连接地址正确');
        displayError('   预期连接地址: mongodb://mongodb:27017');
      } else if (error.message.includes('duplicate key')) {
        displayError('💡 提示: 实体名称已存在，请使用不同的名称');
      }

      process.exit(1);
    }
  });
