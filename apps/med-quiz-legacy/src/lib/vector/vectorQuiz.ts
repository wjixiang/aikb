import dotenv from 'dotenv';
import { QdrantClient } from '@qdrant/js-client-rest';
import { connectToDatabase } from '../db/mongodb';
import { ObjectId } from 'mongodb';

dotenv.config();

const QDRANT_URL: string = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME: string = process.env.COLLECTION_NAME || 'a2';

export async function searchSimilarObjects(queryVector: number[]) {
  // 初始化 Qdrant 客户端
  const qdrantClient = new QdrantClient({ url: QDRANT_URL });

  try {
    // 调用 search 方法进行向量相似性检索
    const searchResults = await qdrantClient.search(COLLECTION_NAME, {
      vector: queryVector, // 传入查询向量
      limit: 10, // 限制返回结果个数
      with_payload: true, // 返回点的数据载荷（可选）
      with_vector: false, // 是否返回点的向量（可选）
    });

    return searchResults;
  } catch (error) {
    console.error('搜索出错:', error);
  }
}

export async function retrive(oidList: string[]) {
  const collectionName = 'a2';
  const { client, db } = await connectToDatabase();

  try {
    await client.connect();
    const collection = db.collection(collectionName);

    // 将传入的 OID 字符串转换为 ObjectId 实例
    const objectIds = oidList.map((id) => new ObjectId(id));

    // 使用 $in 运算符查询 _id 匹配的文档
    const documents = await collection
      .find({ _id: { $in: objectIds } })
      .toArray();
    return documents;
  } catch (err) {
    console.error('查询出错:', err);
    throw err;
  } finally {
    await client.close();
  }
}
