import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';

export async function POST(req: Request) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('note');

    // 1. 获取所有现有索引
    console.log('获取现有索引信息...');
    const indexInfo = await collection.indexes();
    console.log('现有索引:', indexInfo);

    // 2. 删除所有文本索引
    console.log('正在删除现有文本索引...');
    for (const index of indexInfo) {
      // 检查是否为文本索引
      if (index.key && index.key._fts === 'text') {
        console.log(`删除文本索引: ${index.name}`);
        try {
          await collection.dropIndex(index.name as string);
          console.log(`成功删除索引: ${index.name}`);
        } catch (error) {
          console.error(`删除索引 ${index.name} 时出错:`, error);
          // 继续尝试删除其他索引
        }
      }
    }

    // 3. 创建新的文本索引
    console.log('正在创建新索引...');
    await collection.createIndex(
      {
        fileName: 'text', // 文件名
        'metaData.alias': 'text', // 别名
        'metaData.tags': 'text', // 标签
        'content.fileContent': 'text', // 文件内容
      },
      {
        weights: {
          fileName: 10, // 文件名权重高
          'metaData.alias': 10, // 别名权重高
          'metaData.tags': 3, // 标签权重中等
          'content.fileContent': 1, // 内容权重最低
        },
        name: 'noteTextIndex', // 索引名称
        default_language: 'none', // 禁用语言特定的词干分析
      },
    );

    console.log('索引重建完成');

    // 4. 获取新的索引信息以确认
    const newIndexInfo = await collection.indexes();

    return NextResponse.json(
      {
        success: true,
        message: '索引重建成功',
        indexes: newIndexInfo,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('重建索引失败:', error);
    return NextResponse.json(
      { success: false, message: '重建索引失败', error: String(error) },
      { status: 500 },
    );
  }
}
