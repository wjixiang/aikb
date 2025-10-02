#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function testStorage() {
  console.log('🚀 测试存储功能...');
  
  try {
    // 连接到MongoDB
    const uri = process.env.MONGODB_URI || 'mongodb://mongodb:27017';
    const dbName = process.env.DB_NAME || 'aikb';
    
    console.log(`📡 连接到MongoDB: ${uri}`);
    console.log(`📊 使用数据库: ${dbName}`);
    
    const client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(dbName);
    
    // 测试数据库连接
    await db.admin().ping();
    console.log('✅ MongoDB连接成功');
    
    // 获取集合列表
    const collections = await db.listCollections().toArray();
    console.log(`📋 发现 ${collections.length} 个集合`);
    
    // 测试实体集合
    const entitiesCollection = db.collection('entities');
    const entityCount = await entitiesCollection.countDocuments();
    console.log(`📈 实体数量: ${entityCount}`);
    
    // 测试知识集合
    const knowledgeCollection = db.collection('knowledge');
    const knowledgeCount = await knowledgeCollection.countDocuments();
    console.log(`📚 知识数量: ${knowledgeCount}`);
    
    // 创建测试实体
    console.log('🔧 创建测试实体...');
    const testEntity = {
      name: ['测试实体'],
      tags: ['测试', 'CLI'],
      definition: '这是一个通过CLI创建的测试实体',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const entityResult = await entitiesCollection.insertOne(testEntity);
    console.log(`✅ 实体创建成功，ID: ${entityResult.insertedId}`);
    
    // 创建测试知识
    console.log('🔧 创建测试知识...');
    const testKnowledge = {
      entityId: entityResult.insertedId,
      scope: '测试知识范围',
      content: '这是通过CLI创建的测试知识内容',
      childKnowledgeId: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const knowledgeResult = await knowledgeCollection.insertOne(testKnowledge);
    console.log(`✅ 知识创建成功，ID: ${knowledgeResult.insertedId}`);
    
    // 查询测试数据
    console.log('🔍 查询测试数据...');
    const foundEntity = await entitiesCollection.findOne({ _id: entityResult.insertedId });
    console.log(`📋 找到实体: ${foundEntity.name.join(', ')}`);
    
    const foundKnowledge = await knowledgeCollection.findOne({ _id: knowledgeResult.insertedId });
    console.log(`📚 找到知识: ${foundKnowledge.scope}`);
    
    // 清理测试数据
    console.log('🧹 清理测试数据...');
    await entitiesCollection.deleteOne({ _id: entityResult.insertedId });
    await knowledgeCollection.deleteOne({ _id: knowledgeResult.insertedId });
    console.log('✅ 测试数据清理完成');
    
    // 关闭连接
    await client.close();
    console.log('✅ 数据库连接已关闭');
    
    console.log('\n🎉 所有存储测试通过！');
    console.log('✅ 数据库连接正常');
    console.log('✅ 数据持久化功能正常');
    console.log('✅ 数据查询功能正常');
    
  } catch (error) {
    console.error('❌ 存储测试失败:', error.message);
    
    // 提供有用的错误信息
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      console.error('💡 提示: 请确保MongoDB服务正在运行，并且连接地址正确');
      console.error('   预期连接地址: mongodb://mongodb:27017');
    } else if (error.message.includes('authentication failed')) {
      console.error('💡 提示: 请检查数据库认证信息是否正确');
    }
    
    process.exit(1);
  }
}

// 运行测试
testStorage();