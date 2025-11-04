import { NextResponse } from 'next/server';
import knowledgeBase from '@/kgrag/knowledgeBase';
import { connectToDatabase } from '@/lib/db/mongodb';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');
  const collection =
    searchParams.get('collection') ||
    process.env.KB_MONGO_COLLECTION_NAME ||
    'notes';
  const file = searchParams.get('file');

  try {
    // 优先使用MongoDB S3同步的集合
    if (collection === process.env.KB_MONGO_COLLECTION_NAME) {
      const { db } = await connectToDatabase();
      const mongoCollection = db.collection(collection);

      // 构建查询条件
      let query = {};
      if (file) {
        // 使用MongoDB原生正则匹配文件路径
        const escapedFile = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query = { key: { $regex: escapedFile, $options: 'i' } };
      }

      const documents = await mongoCollection
        .find(query)
        .sort({ lastModified: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();

      const total = await mongoCollection.countDocuments(query);

      const results = documents.map((doc) => ({
        path: doc.key,
        title:
          doc.key
            .split('/')
            .pop()
            ?.replace(/\.(md|txt|markdown)$/i, '') || doc.key,
        type: 'document' as const,
        lastModified: doc.lastModified || new Date(),
      }));

      return NextResponse.json(
        {
          results,
          total,
          hasMore: offset + limit < total,
        },
        { status: 200 },
      );
    }

    const kb = new knowledgeBase();
    const documents = await kb.listDocuments(collection);

    // 如果提供了file参数，在结果中过滤
    let filteredDocuments = documents;
    if (file) {
      const regex = new RegExp(file, 'i');
      filteredDocuments = documents.filter((doc) => regex.test(doc.key));
    }

    const results = filteredDocuments.map((doc) => ({
      path: doc.key,
      title: doc.title,
      type: 'document' as const,
      lastModified: doc.lastModified,
    }));

    return NextResponse.json(
      {
        results,
        total: results.length,
        hasMore: false,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error listing documents:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      limit = 100,
      offset = 0,
      collection = process.env.KB_MONGO_COLLECTION_NAME || 'notes',
      file,
    } = body;

    // 优先使用MongoDB S3同步的集合
    if (collection === process.env.KB_MONGO_COLLECTION_NAME) {
      const { db } = await connectToDatabase();
      const mongoCollection = db.collection(collection);

      // 构建查询条件
      let query = {};
      if (file) {
        // 使用MongoDB原生正则匹配文件路径
        const escapedFile = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query = { key: { $regex: escapedFile, $options: 'i' } };
      }

      const documents = await mongoCollection
        .find(query)
        .sort({ lastModified: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();

      const total = await mongoCollection.countDocuments(query);

      const results = documents.map((doc) => ({
        path: doc.key,
        title:
          doc.key
            .split('/')
            .pop()
            ?.replace(/\.(md|txt|markdown)$/i, '') || doc.key,
        type: 'document' as const,
        lastModified: doc.lastModified || new Date(),
      }));

      return NextResponse.json(
        {
          results,
          total,
          hasMore: offset + limit < total,
        },
        { status: 200 },
      );
    }

    const kb = new knowledgeBase();
    const documents = await kb.listDocuments(collection);

    // 如果提供了file参数，在结果中过滤
    let filteredDocuments = documents;
    if (file) {
      const regex = new RegExp(file, 'i');
      filteredDocuments = documents.filter((doc) => regex.test(doc.key));
    }

    const results = filteredDocuments.map((doc) => ({
      path: doc.key,
      title: doc.title,
      type: 'document' as const,
      lastModified: doc.lastModified,
    }));

    return NextResponse.json(
      {
        results,
        total: results.length,
        hasMore: false,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error listing documents:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
