#!/usr/bin/env node

const { MongoClient, ObjectId } = require('mongodb');
const { Command } = require('commander');
require('dotenv').config();

const program = new Command();

// 数据库连接函数
async function connectToDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://mongodb:27017';
  const dbName = process.env.DB_NAME || 'aikb';
  
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  
  return { client, db };
}

// 状态命令
program
  .command('status')
  .description('显示数据库连接状态和统计信息')
  .action(async () => {
    try {
      console.log('\n📊 数据库连接状态');
      console.log('='.repeat(50));
      
      const { client, db } = await connectToDatabase();
      
      // 测试连接
      await db.admin().ping();
      console.log('✅ MongoDB: 已连接');
      
      // 获取统计信息
      const entitiesCollection = db.collection('entities');
      const knowledgeCollection = db.collection('knowledge');
      
      const entityCount = await entitiesCollection.countDocuments();
      const knowledgeCount = await knowledgeCollection.countDocuments();
      
      console.log(`📈 实体数量: ${entityCount}`);
      console.log(`📚 知识数量: ${knowledgeCount}`);
      
      await client.close();
      console.log('='.repeat(50));
      
    } catch (error) {
      console.error('❌ 数据库连接失败:', error.message);
      process.exit(1);
    }
  });

// 创建实体命令
program
  .command('create-entity')
  .description('创建新实体')
  .option('-n, --name <name>', '实体名称')
  .option('-d, --definition <definition>', '实体定义')
  .option('-t, --tags <tags>', '实体标签（逗号分隔）')
  .action(async (options) => {
    try {
      if (!options.name || !options.definition) {
        console.error('❌ 必须提供 --name 和 --definition 选项');
        process.exit(1);
      }
      
      console.log('🔧 创建实体...');
      
      const { client, db } = await connectToDatabase();
      const entitiesCollection = db.collection('entities');
      
      const tags = options.tags ? options.tags.split(',').map(tag => tag.trim()) : [];
      
      const entity = {
        name: [options.name],
        tags,
        definition: options.definition,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await entitiesCollection.insertOne(entity);
      
      console.log('✅ 实体创建成功！');
      console.log(`📋 实体ID: ${result.insertedId}`);
      console.log(`📝 实体名称: ${options.name}`);
      console.log(`🏷️  标签: ${tags.join(', ') || '无'}`);
      console.log(`📖 定义: ${options.definition}`);
      
      await client.close();
      
    } catch (error) {
      console.error('❌ 创建实体失败:', error.message);
      process.exit(1);
    }
  });

// 创建知识命令
program
  .command('create-knowledge')
  .description('创建新知识')
  .option('-e, --entity-id <entityId>', '关联的实体ID')
  .option('-s, --scope <scope>', '知识范围/标题')
  .option('-c, --content <content>', '知识内容')
  .action(async (options) => {
    try {
      if (!options.entityId || !options.scope || !options.content) {
        console.error('❌ 必须提供 --entity-id, --scope 和 --content 选项');
        process.exit(1);
      }
      
      console.log('🔧 创建知识...');
      
      const { client, db } = await connectToDatabase();
      const entitiesCollection = db.collection('entities');
      const knowledgeCollection = db.collection('knowledge');
      
      // 检查实体是否存在
      let entityId;
      try {
        entityId = new ObjectId(options.entityId);
      } catch (error) {
        console.error(`❌ 无效的实体ID格式: ${options.entityId}`);
        await client.close();
        process.exit(1);
      }
      
      const entity = await entitiesCollection.findOne({ _id: entityId });
      if (!entity) {
        console.error(`❌ 未找到ID为 ${options.entityId} 的实体`);
        await client.close();
        process.exit(1);
      }
      
      console.log(`📋 关联实体: ${entity.name.join(', ')}`);
      
      const knowledge = {
        entityId: entityId,
        scope: options.scope,
        content: options.content,
        childKnowledgeId: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await knowledgeCollection.insertOne(knowledge);
      
      console.log('✅ 知识创建成功！');
      console.log(`📚 知识ID: ${result.insertedId}`);
      console.log(`📝 知识范围: ${options.scope}`);
      console.log(`📖 内容预览: ${options.content.substring(0, 100)}${options.content.length > 100 ? '...' : ''}`);
      
      await client.close();
      
    } catch (error) {
      console.error('❌ 创建知识失败:', error.message);
      if (error.message.includes('Cast to ObjectId failed')) {
        console.error('💡 提示: 实体ID格式不正确，请使用有效的实体ID');
      }
      process.exit(1);
    }
  });

// 查询知识命令
program
  .command('list-knowledge')
  .description('列出所有知识')
  .option('-e, --entity-id <entityId>', '按实体ID过滤')
  .action(async (options) => {
    try {
      console.log('🔍 查询知识...');
      
      const { client, db } = await connectToDatabase();
      const knowledgeCollection = db.collection('knowledge');
      const entitiesCollection = db.collection('entities');
      
      let query = {};
      if (options.entityId) {
        try {
          query.entityId = new ObjectId(options.entityId);
        } catch (error) {
          console.error(`❌ 无效的实体ID格式: ${options.entityId}`);
          await client.close();
          process.exit(1);
        }
      }
      
      const knowledge = await knowledgeCollection.find(query).toArray();
      
      if (knowledge.length === 0) {
        console.log('📭 未找到知识');
      } else {
        console.log(`📚 找到 ${knowledge.length} 条知识:`);
        
        for (const item of knowledge) {
          const entity = await entitiesCollection.findOne({ _id: item.entityId });
          const entityName = entity ? entity.name.join(', ') : '未知实体';
          
          console.log(`\n📝 ID: ${item._id}`);
          console.log(`📋 实体: ${entityName}`);
          console.log(`🏷️  范围: ${item.scope}`);
          console.log(`📖 内容: ${item.content.substring(0, 100)}${item.content.length > 100 ? '...' : ''}`);
          console.log(`📅 创建时间: ${item.createdAt ? new Date(item.createdAt).toLocaleString() : '未知'}`);
        }
      }
      
      await client.close();
      
    } catch (error) {
      console.error('❌ 查询知识失败:', error.message);
      process.exit(1);
    }
  });

// 查询实体命令
program
  .command('list-entities')
  .description('列出所有实体')
  .option('-l, --limit <limit>', '限制显示数量', '10')
  .action(async (options) => {
    try {
      console.log('🔍 查询实体...');
      
      const { client, db } = await connectToDatabase();
      const entitiesCollection = db.collection('entities');
      
      const limit = parseInt(options.limit);
      const entities = await entitiesCollection.find({}).limit(limit).toArray();
      
      if (entities.length === 0) {
        console.log('📭 未找到实体');
      } else {
        console.log(`📋 找到 ${entities.length} 个实体:`);
        
        for (const entity of entities) {
          console.log(`\n📝 ID: ${entity._id}`);
          console.log(`🏷️  名称: ${entity.name.join(', ')}`);
          console.log(`🏷️  标签: ${entity.tags.join(', ') || '无'}`);
          console.log(`📖 定义: ${entity.definition.substring(0, 100)}${entity.definition.length > 100 ? '...' : ''}`);
          console.log(`📅 创建时间: ${entity.createdAt ? new Date(entity.createdAt).toLocaleString() : '未知'}`);
        }
      }
      
      await client.close();
      
    } catch (error) {
      console.error('❌ 查询实体失败:', error.message);
      process.exit(1);
    }
  });

// 主函数
async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

// 运行CLI
main();