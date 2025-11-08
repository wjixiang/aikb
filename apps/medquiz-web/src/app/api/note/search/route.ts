import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { note, SearchResult } from '@/types/noteData.types';
import { FindOptions } from 'mongodb';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ results: [] }, { status: 200 });
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection<note>('note');

    // 确保文本索引已创建 - 根据note结构调整索引字段
    try {
      await collection.createIndex(
        {
          fileName: 'text', // 文件名
          'metaData.alias': 'text',
          'metaData.tags': 'text', // 元数据中的标签
          'content.fileContent': 'text', // 内容数组中的文件内容
        },
        {
          weights: {
            fileName: 10, // 文件名权重次之
            'metaData.alias': 10,
            'metaData.tags': 3, // 标签权重再次
            'metaData.description': 2, // 描述权重较低
            'content.fileContent': 1, // 内容权重最低
          },
          name: 'noteTextIndex', // 给索引命名，便于管理
        },
      );
    } catch (indexError) {
      // 如果索引已存在，可能会抛出错误，但我们可以忽略它
      console.log('索引可能已存在:', indexError);
    }

    // 定义查询选项，包括投影和排序
    const options: FindOptions<note> = {
      projection: {
        oid: 1,
        fileName: 1,
        metaData: 1,
        'content.timeStamp': 1,
        'content.fileContent': 1,
        score: { $meta: 'textScore' },
      } as any, // 使用any来绕过TypeScript的类型检查
    };

    // 执行全文搜索查询
    const searchResults = await collection
      .find({ $text: { $search: query } }, options)
      .sort({ score: { $meta: 'textScore' } } as any)
      .limit(10)
      .toArray();

    // 转换为前端需要的格式
    const results: SearchResult[] = searchResults.map((doc) => {
      // 提取文档标题 - 优先使用元数据中的标题，然后是文件名
      const title = doc.metaData?.title || doc.fileName || '无标题文档';

      // 提取内容摘要
      let excerpt = '';
      if (doc.content && doc.content.length > 0) {
        // 获取最新版本的内容
        const latestContent = doc.content.sort((a, b) => {
          const dateA =
            a.timeStamp instanceof Date ? a.timeStamp : new Date(a.timeStamp);
          const dateB =
            b.timeStamp instanceof Date ? b.timeStamp : new Date(b.timeStamp);
          return dateB.getTime() - dateA.getTime();
        })[0];

        // 从内容中提取摘要（前150个字符）
        if (latestContent && latestContent.fileContent) {
          excerpt =
            latestContent.fileContent
              .replace(/<[^>]*>/g, '') // 移除HTML标签
              .replace(/\s+/g, ' ') // 将多个空白字符替换为单个空格
              .trim()
              .slice(0, 150) +
            (latestContent.fileContent.length > 150 ? '...' : '');
        }
      }

      // 添加元数据信息
      const tags = doc.metaData?.tags
        ? Array.isArray(doc.metaData.tags)
          ? doc.metaData.tags
          : [doc.metaData.tags]
        : [];

      return {
        id: doc.oid,
        title,
        excerpt,
        tags: tags,
        lastUpdated:
          doc.content && doc.content.length > 0
            ? doc.content.sort((a, b) => {
                const dateA =
                  a.timeStamp instanceof Date
                    ? a.timeStamp
                    : new Date(a.timeStamp);
                const dateB =
                  b.timeStamp instanceof Date
                    ? b.timeStamp
                    : new Date(b.timeStamp);
                return dateB.getTime() - dateA.getTime();
              })[0].timeStamp
            : null,
      };
    });

    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { message: 'Internal server error', error: String(error) },
      { status: 500 },
    );
  }
}
