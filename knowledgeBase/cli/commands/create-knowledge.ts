import { Command } from 'commander';
import Entity from '../../Entity';
import { TKnowledge } from '../../Knowledge';
import { initializeStorage } from '../utils/storage';
import {
  promptForKnowledgeCreation,
  promptForNaturalLanguageKnowledge,
  displaySuccess,
  displayError,
  displayInfo,
  selectFromOptions
} from '../utils/prompts';
import createLoggerWithPrefix from '../../lib/logger';

const logger = createLoggerWithPrefix('CLI-CreateKnowledge');

/**
 * Create knowledge command
 */
export const createKnowledgeCommand = new Command('create-knowledge')
  .description('Create new knowledge in the knowledge base')
  .option('-i, --interactive', 'Run in interactive mode', true)
  .option('-e, --entity-id <entityId>', 'Entity ID to link knowledge to')
  .option('-s, --scope <scope>', 'Knowledge scope/title')
  .option('-c, --content <content>', 'Knowledge content')
  .option('-n, --natural-language <text>', 'Create knowledge from natural language text')
  .action(async (options) => {
    try {
      displayInfo('正在初始化存储系统...');
      logger.info('开始创建知识...');
      const storage = await initializeStorage();
      logger.info('存储系统初始化成功');
      
      let entityId: string;
      let knowledgeData;
      let useNaturalLanguage = false;
      let naturalLanguageText = '';
      
      if (options.interactive) {
        // Interactive mode - prompt for creation method
        const creationMethod = await selectFromOptions(
          '选择知识创建方式:',
          ['手动输入知识', '从自然语言创建']
        );
        
        useNaturalLanguage = creationMethod === '从自然语言创建';
        
        if (useNaturalLanguage) {
          const result = await promptForNaturalLanguageKnowledge();
          entityId = result.entityId;
          naturalLanguageText = result.naturalLanguageText;
        } else {
          const result = await promptForKnowledgeCreation();
          entityId = result.entityId;
          knowledgeData = result.knowledgeData;
        }
      } else {
        // Non-interactive mode - use command line options
        if (!options.entity_id) {
          displayError('在非交互模式下，必须提供 --entity-id 选项');
          process.exit(1);
        }
        
        entityId = options.entity_id;
        
        if (options.natural_language) {
          useNaturalLanguage = true;
          naturalLanguageText = options.natural_language;
        } else {
          if (!options.scope || !options.content) {
            displayError('在非交互模式下，必须提供 --scope 和 --content 选项，或使用 --natural-language 选项');
            process.exit(1);
          }
          
          knowledgeData = {
            scope: options.scope,
            content: options.content,
            childKnowledgeId: [],
          };
        }
      }
      
      // Get the entity
      displayInfo('正在查找实体...');
      logger.info(`查找实体ID: ${entityId}`);
      const entity = await storage.entityStorage.entityContentStorage.get_entity_by_id(entityId);
      
      if (!entity) {
        logger.error(`未找到ID为 ${entityId} 的实体`);
        displayError(`未找到ID为 ${entityId} 的实体`);
        displayError('💡 提示: 请先创建实体，或使用正确的实体ID');
        process.exit(1);
      }
      
      logger.info(`找到实体: ${entity.name.join(', ')}`);
      displayInfo(`找到实体: ${entity.name.join(', ')}`);
      
      // Create entity instance
      const entityInstance = new Entity(
        entity.id,
        entity,
        storage.entityStorage
      );
      
      if (useNaturalLanguage) {
        // Create knowledge from natural language
        displayInfo('正在从自然语言创建知识...');
        logger.info('从自然语言创建知识...');
        const knowledge = await entityInstance.create_subordinate_knowledge_from_text(
          naturalLanguageText,
          storage.knowledgeStorage
        );
        
        logger.info(`知识创建成功，ID: ${knowledge.get_id()}`);
        displaySuccess(`知识创建成功！`);
        displayInfo(`知识ID: ${knowledge.get_id()}`);
        displayInfo(`知识范围: ${knowledge.getData().scope}`);
        
        // Display knowledge details
        console.log('\n📋 知识详情:');
        console.log(`  ID: ${knowledge.get_id()}`);
        console.log(`  范围: ${knowledge.getData().scope}`);
        console.log(`  内容: ${knowledge.getData().content.substring(0, 100)}${knowledge.getData().content.length > 100 ? '...' : ''}`);
      } else {
        // Create knowledge manually
        displayInfo('正在创建知识...');
        logger.info(`手动创建知识，范围: ${knowledgeData.scope}`);
        const tempKnowledge = new TKnowledge(knowledgeData, entityInstance);
        const savedKnowledge = await tempKnowledge.save(storage.knowledgeStorage);
        
        logger.info(`知识创建成功，ID: ${savedKnowledge.get_id()}`);
        displaySuccess(`知识创建成功！`);
        displayInfo(`知识ID: ${savedKnowledge.get_id()}`);
        displayInfo(`知识范围: ${knowledgeData.scope}`);
        
        // Display knowledge details
        console.log('\n📋 知识详情:');
        console.log(`  ID: ${savedKnowledge.get_id()}`);
        console.log(`  范围: ${knowledgeData.scope}`);
        console.log(`  内容: ${knowledgeData.content.substring(0, 100)}${knowledgeData.content.length > 100 ? '...' : ''}`);
      }
      
    } catch (error: any) {
      logger.error('创建知识失败:', error.message);
      displayError(`创建知识失败: ${error.message}`);
      
      // Provide more helpful error messages
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        displayError('💡 提示: 请确保MongoDB服务正在运行，并且连接地址正确');
        displayError('   预期连接地址: mongodb://mongodb:27017');
      } else if (error.message.includes('Cast to ObjectId failed')) {
        displayError('💡 提示: 实体ID格式不正确，请使用有效的实体ID');
      } else if (error.message.includes('validation failed')) {
        displayError('💡 提示: 知识数据验证失败，请检查输入数据');
      }
      
      process.exit(1);
    }
  });