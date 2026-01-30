import { MongoClient } from 'mongodb';
import { promises as fs } from 'fs';
import OramaSyncService from '../oramadb';

// 请根据实际情况配置下面参数
const mongoUri = 'mongodb://localhost:27017';
const dbName = 'test_db';
const collectionName = 'orama_sync_test';

// 注意：下面测试使用真实数据库和文件系统，确保不会误删生产数据
describe('OramaSyncService Integration Tests', () => {
  let mongoClient: MongoClient;
  let oramaService: OramaSyncService;

  beforeAll(async () => {
    // 连接测试用 MongoDB 并准备测试集合
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    const db = mongoClient.db(dbName);
    const coll = db.collection(collectionName);
    // 清空集合并插入测试数据
    await coll.deleteMany({});
    await coll.insertMany([
      { content: 'Hello, Orama! This is a test document.' },
      { content: 'Another document for testing purposes.' },
      { content: 'Jest integration test document.' },
    ]);

    // 初始化 OramaSyncService 实例并创建空的 Orama 索引
    oramaService = new OramaSyncService(mongoUri, dbName, collectionName);
    await oramaService.initOrama();
  });

  afterAll(async () => {
    // 清理测试集合数据并关闭 MongoDB 连接
    const db = mongoClient.db(dbName);
    await db.collection(collectionName).deleteMany({});
    await mongoClient.close();
  });

  test('syncDocuments 应能把 MongoDB 中的数据同步到 Orama 索引', async () => {
    // 执行同步操作
    await oramaService.syncDocuments();

    // 用一个查询语句查找包含“Hello, Orama!”的文档
    const results = await oramaService.query('Hello, Orama!', 10);

    expect(results).toBeDefined();
    // 假设返回的结果中有 points 属性，且每个点具有 content 字段
    const found = results.points.some((point: any) =>
      point.content.includes('Hello, Orama!'),
    );
    expect(found).toBe(true);
  });

  test('saveIndex 与 loadIndex 能正确持久化并恢复 Orama 索引', async () => {
    const filePath = './orama_index_test_dump.json';

    // 保存当前索引状态到文件
    await oramaService.saveIndex(filePath);

    // 创建一个新的 OramaSyncService 实例并加载索引
    const newService = new OramaSyncService(mongoUri, dbName, collectionName);
    await newService.loadIndex(filePath);

    // 通过查询验证加载后的索引中仍有先前添加的数据
    const results = await newService.query('Another document', 10);
    expect(results).toBeDefined();
    const found = results.points.some((point: any) =>
      point.content.includes('Another document'),
    );
    expect(found).toBe(true);

    // 清理测试生成的索引 dump 文件
    await fs.unlink(filePath);
  });
});
