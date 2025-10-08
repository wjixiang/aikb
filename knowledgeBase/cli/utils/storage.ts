import { connectToDatabase } from '../../lib/mongodb';
import { MongodbEntityContentStorage } from '../../storage/mongodb-entity-content-storage';
import { MongodbKnowledgeContentStorage } from '../../storage/mongodb-knowledge-content-storage';
import { MongodbKnowledgeVectorStorage } from '../../storage/mongodb-knowledge-vector-storage';
import { MongoKnowledgeGraphStorage } from '../../storage/mongodb-knowledge-graph-storage';
import { MongoEntityGraphStorage } from '../../storage/mongodb-entity-graph-storage';
import { ElasticsearchVectorStorage } from '../../storage/elasticsearch-entity-vector-storage';
import EntityStorage from '../../storage/entityStorage';
import KnowledgeStorage from '../../storage/knowledgeStorage';
import { KBStorage } from '../../storage/storage';
import createLoggerWithPrefix from '../../lib/logger';

const logger = createLoggerWithPrefix('CLI-Storage');

/**
 * Check database connection
 * @returns Promise resolving to true if connection is successful, false otherwise
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    logger.info('正在检查数据库连接...');
    const { client, db } = await connectToDatabase();

    // Test a simple ping
    await db.admin().ping();

    // Get database info
    const admin = db.admin();
    const serverStatus = await admin.serverStatus();
    logger.info(`数据库连接成功! MongoDB版本: ${serverStatus.version}`);

    // Don't close the connection as it's cached
    // await client.close();

    return true;
  } catch (error: any) {
    logger.error('数据库连接失败:', error.message);
    console.error('❌ 数据库连接错误:', error.message);

    // Provide more helpful error messages
    if (
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND')
    ) {
      console.error('💡 提示: 请确保MongoDB服务正在运行，并且连接地址正确');
      console.error('   预期连接地址: mongodb://mongodb:27017');
    } else if (error.message.includes('authentication failed')) {
      console.error('💡 提示: 请检查数据库认证信息是否正确');
    }

    return false;
  }
}

/**
 * Initialize storage instances for entity and knowledge operations
 * @returns Promise resolving to initialized KBStorage instance
 */
export async function initializeStorage(): Promise<KBStorage> {
  try {
    logger.info('正在初始化存储系统...');

    // First ensure database connection is available
    await connectToDatabase();

    // Initialize entity storage components
    logger.info('初始化实体存储组件...');
    const entityContentStorage = new MongodbEntityContentStorage();
    const entityGraphStorage = new MongoEntityGraphStorage();

    // Try to initialize Elasticsearch vector storage, fall back to MongoDB if not available
    let entityVectorStorage;
    try {
      entityVectorStorage = new ElasticsearchVectorStorage();
      logger.info('使用Elasticsearch作为实体向量存储');
    } catch (error) {
      logger.warn('Elasticsearch不可用，将跳过实体向量存储功能');
      entityVectorStorage = null;
    }

    // Initialize knowledge storage components
    logger.info('初始化知识存储组件...');
    const knowledgeContentStorage = new MongodbKnowledgeContentStorage();
    const knowledgeGraphStorage = new MongoKnowledgeGraphStorage();
    const knowledgeVectorStorage = new MongodbKnowledgeVectorStorage();

    // Create storage instances
    const entityStorage = new EntityStorage(
      entityContentStorage,
      entityGraphStorage,
      entityVectorStorage,
    );

    const knowledgeStorage = new KnowledgeStorage(
      knowledgeContentStorage,
      knowledgeGraphStorage,
      knowledgeVectorStorage,
    );

    // Create and return KBStorage instance
    const kbStorage = new KBStorage(entityStorage, knowledgeStorage);
    logger.info('存储系统初始化完成');

    return kbStorage;
  } catch (error: any) {
    logger.error('存储系统初始化失败:', error.message);
    console.error('❌ 存储系统初始化失败:', error.message);

    // Provide more helpful error messages
    if (
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND')
    ) {
      console.error('💡 提示: 请确保MongoDB服务正在运行，并且连接地址正确');
      console.error('   预期连接地址: mongodb://mongodb:27017');
    } else if (error.message.includes('authentication failed')) {
      console.error('💡 提示: 请检查数据库认证信息是否正确');
    }

    throw error;
  }
}

/**
 * Get database statistics
 * @returns Promise resolving to database statistics
 */
export async function getDatabaseStats(): Promise<{
  entityCount: number;
  knowledgeCount: number;
}> {
  try {
    logger.info('正在获取数据库统计信息...');
    const storage = await initializeStorage();
    const stats = await storage.getStorageStats();
    logger.info(
      `数据库统计: 实体数量=${stats.entityCount}, 知识数量=${stats.knowledgeCount}`,
    );
    return stats;
  } catch (error: any) {
    logger.error('获取数据库统计信息失败:', error.message);
    console.error('❌ 获取数据库统计信息失败:', error.message);
    return {
      entityCount: 0,
      knowledgeCount: 0,
    };
  }
}

/**
 * Display database connection status
 */
export async function displayDatabaseStatus(): Promise<void> {
  console.log('\n📊 数据库连接状态');
  console.log('='.repeat(50));

  const isConnected = await checkDatabaseConnection();

  if (isConnected) {
    console.log('✅ MongoDB: 已连接');

    try {
      const stats = await getDatabaseStats();
      console.log(`📈 实体数量: ${stats.entityCount}`);
      console.log(`📚 知识数量: ${stats.knowledgeCount}`);
    } catch (error) {
      console.log('⚠️  无法获取数据库统计信息');
    }
  } else {
    console.log('❌ MongoDB: 连接失败');
  }

  console.log('='.repeat(50));
}
